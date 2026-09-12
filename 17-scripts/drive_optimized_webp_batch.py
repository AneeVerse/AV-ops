#!/usr/bin/env python3
import io
import json
import os
import re
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Use the explicitly requested Google Workspace token, independent of the
# currently active Hermes profile.
TOKEN_PATH = Path("/root/.hermes/profiles/leadgen2/google_token.json")
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
]

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload
from googleapiclient.errors import HttpError
from PIL import Image, ImageOps

SOURCES = [
    ("India Maritime week 2025", "1WjaQ5fVBzhIDQr78jpoY9GoeyHFSrVja"),
    ("Global Freight Forum kandla", "1DFUTKHTroSCBFX0jKZKhttI5n5HWNoVF"),
    ("cargo pics shoo - IICS Exhibition 2026", "1yvkE3XaAiFzrl5Vq2mgWD7vnEjrJEazV"),
    ("EXIM - 17th & 18th March 2026", "1Bq5j3ivJzTgwyKq8iZcEL0CzkIFZXukj"),
    ("India Seatrade - 8th March 2026", "17BKRtg6mZdKmrEC5ndmgNzzgl8VY-nLp"),
]
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
IMAGE_MIMES = {"image/jpeg", "image/png"}
FOLDER_MIME = "application/vnd.google-apps.folder"
RUN_ID = time.strftime("%Y%m%d-%H%M%S")
WORKDIR = Path(f"/root/webp_optimized_drive_batch_{RUN_ID}")
DOWNLOAD_DIR = WORKDIR / "downloads"
CONVERT_DIR = WORKDIR / "converted"
REPORT_JSON = WORKDIR / "report.json"
REPORT_MD = WORKDIR / "report.md"

@dataclass
class SourceFile:
    id: str
    name: str
    mimeType: str
    rel_parts: List[str]
    size: Optional[int] = None

@dataclass
class FolderResult:
    label: str
    source_folder_id: str
    output_folder_name: str = ""
    output_folder_id: str = ""
    output_folder_link: str = ""
    discovered_images: int = 0
    converted: int = 0
    uploaded: int = 0
    failures: List[Dict] = field(default_factory=list)
    uploaded_files: List[Dict] = field(default_factory=list)


def sanitize(s: str, max_len: int = 120) -> str:
    s = re.sub(r"[\\/:*?\"<>|\r\n\t]+", "_", s).strip(" .")
    s = re.sub(r"\s+", " ", s)
    if not s:
        s = "unnamed"
    return s[:max_len]


def unique_flat_name(rel_parts: List[str], used: set) -> str:
    stem_parts = [sanitize(p) for p in rel_parts]
    # Replace the source extension with .webp on the final component, flatten with __.
    final = Path(stem_parts[-1]).stem + ".webp"
    stem_parts[-1] = sanitize(final)
    candidate = "__".join(stem_parts)
    candidate = sanitize(candidate, 180)
    base = Path(candidate).stem
    suffix = Path(candidate).suffix or ".webp"
    i = 2
    while candidate.lower() in used:
        candidate = sanitize(f"{base}__{i}{suffix}", 180)
        i += 1
    used.add(candidate.lower())
    return candidate


def list_children(service, folder_id: str):
    page_token = None
    while True:
        resp = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="nextPageToken, files(id,name,mimeType,size)",
            pageSize=1000,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            pageToken=page_token,
        ).execute()
        for f in resp.get("files", []):
            yield f
        page_token = resp.get("nextPageToken")
        if not page_token:
            break


def discover_images(service, folder_id: str, prefix: Optional[List[str]] = None) -> List[SourceFile]:
    prefix = prefix or []
    found: List[SourceFile] = []
    for f in list_children(service, folder_id):
        name = f.get("name", "")
        mime = f.get("mimeType", "")
        if mime == FOLDER_MIME:
            found.extend(discover_images(service, f["id"], prefix + [name]))
        else:
            ext = Path(name).suffix.lower()
            if mime in IMAGE_MIMES or ext in IMAGE_EXTS:
                if ext in IMAGE_EXTS or mime in IMAGE_MIMES:
                    found.append(SourceFile(f["id"], name, mime, prefix + [name], int(f["size"]) if f.get("size") else None))
    return found


def download_file(service, file_id: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    with dest.open("wb") as fh:
        downloader = MediaIoBaseDownload(fh, request, chunksize=1024 * 1024)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def convert_optimized_webp(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        # Respect EXIF orientation for JPEGs while retaining lossless WebP encoding of the resulting pixels.
        im = ImageOps.exif_transpose(im)
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        if has_alpha:
            im = im.convert("RGBA")
        elif im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        im.save(dst, "WEBP", quality=85, method=6)


def create_drive_folder(service, name: str) -> Tuple[str, str]:
    metadata = {"name": name, "mimeType": FOLDER_MIME}
    folder = service.files().create(body=metadata, fields="id, webViewLink", supportsAllDrives=True).execute()
    return folder["id"], folder.get("webViewLink", f"https://drive.google.com/drive/folders/{folder['id']}")


def share_anyone_reader(service, folder_id: str):
    service.permissions().create(
        fileId=folder_id,
        body={"type": "anyone", "role": "reader"},
        fields="id",
        supportsAllDrives=True,
    ).execute()


def upload_webp(service, folder_id: str, local_path: Path, drive_name: str) -> Dict:
    media = MediaFileUpload(str(local_path), mimetype="image/webp", resumable=True, chunksize=1024 * 1024)
    body = {"name": drive_name, "parents": [folder_id], "mimeType": "image/webp"}
    req = service.files().create(body=body, media_body=media, fields="id,name,webViewLink,size", supportsAllDrives=True)
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    return resp


def get_drive_credentials():
    if not TOKEN_PATH.exists():
        raise FileNotFoundError(f"Google token not found: {TOKEN_PATH}")
    token_data = json.loads(TOKEN_PATH.read_text())
    scopes = token_data.get("scopes") if isinstance(token_data.get("scopes"), list) else SCOPES
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), scopes)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        refreshed = json.loads(creds.to_json())
        refreshed.setdefault("type", "authorized_user")
        TOKEN_PATH.write_text(json.dumps(refreshed, indent=2))
    if not creds.valid:
        raise RuntimeError("Google credentials are invalid after refresh attempt")
    return creds


def write_reports(results: List[FolderResult]):
    WORKDIR.mkdir(parents=True, exist_ok=True)
    data = {
        "run_id": RUN_ID,
        "workdir": str(WORKDIR),
        "report_json": str(REPORT_JSON),
        "report_md": str(REPORT_MD),
        "results": [r.__dict__ for r in results],
    }
    REPORT_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    lines = [f"# Optimized WebP Google Drive Batch Report", "", f"Run ID: `{RUN_ID}`", f"Workdir: `{WORKDIR}`", ""]
    for r in results:
        lines += [
            f"## {r.label}",
            f"- Source folder ID: `{r.source_folder_id}`",
            f"- Output folder: {r.output_folder_name}",
            f"- Output folder ID: `{r.output_folder_id}`",
            f"- Output link: {r.output_folder_link}",
            f"- Discovered JPG/JPEG/PNG images: {r.discovered_images}",
            f"- Converted: {r.converted}",
            f"- Uploaded: {r.uploaded}",
            f"- Failures: {len(r.failures)}",
            "",
        ]
        if r.failures:
            lines.append("Failures:")
            for fail in r.failures:
                lines.append(f"- `{fail.get('path')}` ({fail.get('stage')}): {fail.get('error')}")
            lines.append("")
    REPORT_MD.write_text("\n".join(lines))


def main():
    WORKDIR.mkdir(parents=True, exist_ok=True)
    print(f"WORKDIR={WORKDIR}", flush=True)
    service = build("drive", "v3", credentials=get_drive_credentials(), cache_discovery=False, static_discovery=False)
    results: List[FolderResult] = []
    for label, folder_id in SOURCES:
        res = FolderResult(label=label, source_folder_id=folder_id)
        results.append(res)
        print(f"\n=== {label} ({folder_id}) ===", flush=True)
        try:
            files = discover_images(service, folder_id)
            res.discovered_images = len(files)
            print(f"Discovered {len(files)} images", flush=True)
            out_name = f"WebP Optimized Q85 - {label} - {RUN_ID}"
            res.output_folder_name = out_name
            res.output_folder_id, res.output_folder_link = create_drive_folder(service, out_name)
            share_anyone_reader(service, res.output_folder_id)
            print(f"Created/shared output folder {res.output_folder_id}: {res.output_folder_link}", flush=True)
            used_names = set()
            for idx, sf in enumerate(files, 1):
                rel_label = "/".join(sf.rel_parts)
                drive_name = unique_flat_name(sf.rel_parts, used_names)
                local_src = DOWNLOAD_DIR / sanitize(label) / (drive_name + ".src")
                local_dst = CONVERT_DIR / sanitize(label) / drive_name
                try:
                    print(f"[{idx}/{len(files)}] {rel_label} -> {drive_name}", flush=True)
                    download_file(service, sf.id, local_src)
                except Exception as e:
                    res.failures.append({"path": rel_label, "file_id": sf.id, "stage": "download", "error": repr(e)})
                    continue
                try:
                    convert_optimized_webp(local_src, local_dst)
                    res.converted += 1
                except Exception as e:
                    res.failures.append({"path": rel_label, "file_id": sf.id, "stage": "convert", "error": repr(e), "traceback": traceback.format_exc()})
                    continue
                try:
                    uploaded = upload_webp(service, res.output_folder_id, local_dst, drive_name)
                    res.uploaded += 1
                    res.uploaded_files.append({"source_path": rel_label, "source_id": sf.id, "name": uploaded.get("name"), "id": uploaded.get("id"), "link": uploaded.get("webViewLink")})
                except Exception as e:
                    res.failures.append({"path": rel_label, "file_id": sf.id, "stage": "upload", "error": repr(e), "traceback": traceback.format_exc()})
                if idx % 10 == 0:
                    write_reports(results)
            write_reports(results)
            print(f"Done {label}: converted={res.converted} uploaded={res.uploaded} failures={len(res.failures)}", flush=True)
        except Exception as e:
            res.failures.append({"path": "<folder>", "stage": "folder", "error": repr(e), "traceback": traceback.format_exc()})
            write_reports(results)
            print(f"ERROR in folder {label}: {e!r}", flush=True)
    write_reports(results)
    print(f"\nREPORT_JSON={REPORT_JSON}")
    print(f"REPORT_MD={REPORT_MD}")
    print(json.dumps({"report_json": str(REPORT_JSON), "report_md": str(REPORT_MD), "results": [r.__dict__ for r in results]}, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
