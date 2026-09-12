#!/usr/bin/env python3
"""Google Drive image folder -> WebP automation with a hard max size target.

This script is intentionally non-LLM/script-only. It:
- recursively scans source Google Drive folders for JPG/JPEG/PNG images
- downloads originals
- converts to WebP <= TARGET_KB using adaptive quality and optional resizing
- uploads one separate output folder per source folder
- shares output folders anyone-with-link reader
- writes JSON/Markdown reports with links, counts, and failures

Default source folders are the user's current event folders. Override with
SOURCE_FOLDERS_JSON='[{"label":"Name","folder_id":"..."}]'.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import traceback
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

TOKEN_PATH = Path(os.getenv("GOOGLE_TOKEN_PATH", "/root/.hermes/profiles/leadgen2/google_token.json"))
SCOPES = [
    "https://www.googleapis.com/auth/drive",
]

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload
from PIL import Image, ImageOps

DEFAULT_SOURCES = [
    {"label": "India Maritime week 2025", "folder_id": "1WjaQ5fVBzhIDQr78jpoY9GoeyHFSrVja"},
    {"label": "Global Freight Forum kandla", "folder_id": "1DFUTKHTroSCBFX0jKZKhttI5n5HWNoVF"},
    {"label": "cargo pics shoo - IICS Exhibition 2026", "folder_id": "1yvkE3XaAiFzrl5Vq2mgWD7vnEjrJEazV"},
    {"label": "EXIM - 17th & 18th March 2026", "folder_id": "1Bq5j3ivJzTgwyKq8iZcEL0CzkIFZXukj"},
    {"label": "India Seatrade - 8th March 2026", "folder_id": "17BKRtg6mZdKmrEC5ndmgNzzgl8VY-nLp"},
]
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
IMAGE_MIMES = {"image/jpeg", "image/png"}
FOLDER_MIME = "application/vnd.google-apps.folder"


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
    return (s or "unnamed")[:max_len]


def unique_flat_name(rel_parts: List[str], used: set) -> str:
    stem_parts = [sanitize(p) for p in rel_parts]
    stem_parts[-1] = sanitize(Path(stem_parts[-1]).stem + ".webp")
    candidate = sanitize("__".join(stem_parts), 180)
    base = Path(candidate).stem
    suffix = Path(candidate).suffix or ".webp"
    i = 2
    while candidate.lower() in used:
        candidate = sanitize(f"{base}__{i}{suffix}", 180)
        i += 1
    used.add(candidate.lower())
    return candidate


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
        raise RuntimeError("Google credentials are invalid")
    return creds


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
        yield from resp.get("files", [])
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


def convert_webp_under_kb(src: Path, dst: Path, target_kb: int = 1000, min_quality: int = 40) -> Dict:
    """Create WebP under target_kb.

    Strategy:
    1) keep original dimensions, reduce quality from 95 down to min_quality
    2) if still too big, resize max dimension downward and retry quality ladder
    Returns metadata about chosen quality/dimensions.
    """
    target_bytes = target_kb * 1024
    dst.parent.mkdir(parents=True, exist_ok=True)
    attempts = []
    with Image.open(src) as im0:
        im0 = ImageOps.exif_transpose(im0)
        original_size = im0.size
        has_alpha = im0.mode in ("RGBA", "LA") or (im0.mode == "P" and "transparency" in im0.info)
        im = im0.convert("RGBA" if has_alpha else "RGB")

        best_path = None
        best_meta = None
        # Quality-only: preserve dimensions whenever possible.
        for q in range(95, min_quality - 1, -1):
            tmp = dst.with_suffix(f".q{q}.tmp.webp")
            im.save(tmp, "WEBP", quality=q, method=6)
            size = tmp.stat().st_size
            attempts.append((size, q, im.size, tmp))
            if size <= target_bytes:
                best_path = tmp
                best_meta = {"quality": q, "resized": False, "dimensions": list(im.size), "original_dimensions": list(original_size), "size_bytes": size, "target_kb": target_kb}
                break
        # Resize only if quality-only cannot meet target.
        if best_path is None:
            w, h = im.size
            for maxdim in [6000, 5500, 5000, 4500, 4000, 3500, 3200, 3000, 2800, 2500, 2200, 2000, 1800, 1600, 1400, 1200]:
                ratio = min(1.0, maxdim / max(w, h))
                if ratio >= 1.0:
                    continue
                resized = im.resize((round(w * ratio), round(h * ratio)), Image.Resampling.LANCZOS)
                for q in range(90, min_quality - 1, -1):
                    tmp = dst.with_suffix(f".max{maxdim}.q{q}.tmp.webp")
                    resized.save(tmp, "WEBP", quality=q, method=6)
                    size = tmp.stat().st_size
                    attempts.append((size, q, resized.size, tmp))
                    if size <= target_bytes:
                        best_path = tmp
                        best_meta = {"quality": q, "resized": True, "max_dimension": maxdim, "dimensions": list(resized.size), "original_dimensions": list(original_size), "size_bytes": size, "target_kb": target_kb}
                        break
                if best_path is not None:
                    break
        if best_path is None:
            # Last resort: use smallest attempt even if above target and flag it.
            size, q, dims, tmp = min(attempts, key=lambda x: x[0])
            best_path = tmp
            best_meta = {"quality": q, "resized": True, "dimensions": list(dims), "original_dimensions": list(original_size), "size_bytes": size, "target_kb": target_kb, "over_target": True}
        dst.write_bytes(best_path.read_bytes())
        for _, _, _, tmp in attempts:
            try:
                tmp.unlink()
            except FileNotFoundError:
                pass
        best_meta["final_size_kb"] = round(dst.stat().st_size / 1024, 2)
        return best_meta


def create_drive_folder(service, name: str, parent: Optional[str] = None) -> Tuple[str, str]:
    metadata = {"name": name, "mimeType": FOLDER_MIME}
    if parent:
        metadata["parents"] = [parent]
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


def write_reports(workdir: Path, run_id: str, results: List[FolderResult], target_kb: int):
    report_json = workdir / "report.json"
    report_md = workdir / "report.md"
    data = {"run_id": run_id, "target_kb": target_kb, "workdir": str(workdir), "results": [asdict(r) for r in results]}
    report_json.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    lines = ["# WebP Under Target Google Drive Batch Report", "", f"Run ID: `{run_id}`", f"Target: `{target_kb} KB max per image`", f"Workdir: `{workdir}`", ""]
    for r in results:
        lines += [
            f"## {r.label}",
            f"- Source folder ID: `{r.source_folder_id}`",
            f"- Output folder: {r.output_folder_name}",
            f"- Output folder ID: `{r.output_folder_id}`",
            f"- Output link: {r.output_folder_link}",
            f"- Discovered images: {r.discovered_images}",
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
    report_md.write_text("\n".join(lines))


def load_sources() -> List[Dict[str, str]]:
    raw = os.getenv("SOURCE_FOLDERS_JSON")
    if raw:
        data = json.loads(raw)
        return [{"label": x["label"], "folder_id": x.get("folder_id") or x.get("id")} for x in data]
    return DEFAULT_SOURCES


def run_batch(args) -> int:
    run_id = args.run_id or time.strftime("%Y%m%d-%H%M%S")
    workdir = Path(args.workdir or f"/root/webp_under_{args.target_kb}kb_drive_batch_{run_id}")
    download_dir = workdir / "downloads"
    convert_dir = workdir / "converted"
    workdir.mkdir(parents=True, exist_ok=True)
    print(f"WORKDIR={workdir}", flush=True)
    service = build("drive", "v3", credentials=get_drive_credentials(), cache_discovery=False, static_discovery=False)
    results: List[FolderResult] = []
    sources = load_sources()
    for source in sources:
        label = source["label"]
        folder_id = source["folder_id"]
        res = FolderResult(label=label, source_folder_id=folder_id)
        results.append(res)
        print(f"\n=== {label} ({folder_id}) ===", flush=True)
        try:
            files = discover_images(service, folder_id)
            res.discovered_images = len(files)
            out_name = f"WebP Under {args.target_kb}KB - {label} - {run_id}"
            res.output_folder_name = out_name
            res.output_folder_id, res.output_folder_link = create_drive_folder(service, out_name, args.output_parent)
            share_anyone_reader(service, res.output_folder_id)
            print(f"Discovered {len(files)} images", flush=True)
            print(f"Created/shared output folder: {res.output_folder_link}", flush=True)
            used_names = set()
            for idx, sf in enumerate(files, 1):
                rel_label = "/".join(sf.rel_parts)
                drive_name = unique_flat_name(sf.rel_parts, used_names)
                local_src = download_dir / sanitize(label) / (drive_name + ".src")
                local_dst = convert_dir / sanitize(label) / drive_name
                try:
                    print(f"[{idx}/{len(files)}] {rel_label} -> {drive_name}", flush=True)
                    download_file(service, sf.id, local_src)
                except Exception as e:
                    res.failures.append({"path": rel_label, "file_id": sf.id, "stage": "download", "error": repr(e)})
                    continue
                try:
                    meta = convert_webp_under_kb(local_src, local_dst, target_kb=args.target_kb, min_quality=args.min_quality)
                    res.converted += 1
                except Exception as e:
                    res.failures.append({"path": rel_label, "file_id": sf.id, "stage": "convert", "error": repr(e), "traceback": traceback.format_exc()})
                    continue
                try:
                    uploaded = upload_webp(service, res.output_folder_id, local_dst, drive_name)
                    res.uploaded += 1
                    res.uploaded_files.append({"source_path": rel_label, "source_id": sf.id, "name": uploaded.get("name"), "id": uploaded.get("id"), "link": uploaded.get("webViewLink"), "size": uploaded.get("size"), "compression": meta})
                except Exception as e:
                    res.failures.append({"path": rel_label, "file_id": sf.id, "stage": "upload", "error": repr(e), "traceback": traceback.format_exc()})
                if idx % args.report_every == 0:
                    write_reports(workdir, run_id, results, args.target_kb)
            write_reports(workdir, run_id, results, args.target_kb)
            print(f"Done {label}: converted={res.converted} uploaded={res.uploaded} failures={len(res.failures)}", flush=True)
        except Exception as e:
            res.failures.append({"path": "<folder>", "stage": "folder", "error": repr(e), "traceback": traceback.format_exc()})
            write_reports(workdir, run_id, results, args.target_kb)
            print(f"ERROR in folder {label}: {e!r}", flush=True)
    write_reports(workdir, run_id, results, args.target_kb)
    print(json.dumps({"workdir": str(workdir), "report_json": str(workdir / "report.json"), "report_md": str(workdir / "report.md"), "results": [asdict(r) for r in results]}, indent=2, ensure_ascii=False))
    return 0


def local_test(args) -> int:
    src = Path(args.input).expanduser()
    dst = Path(args.output or src.with_suffix(f".under_{args.target_kb}kb.webp")).expanduser()
    meta = convert_webp_under_kb(src, dst, target_kb=args.target_kb, min_quality=args.min_quality)
    print(json.dumps({"input": str(src), "input_kb": round(src.stat().st_size / 1024, 2), "output": str(dst), "output_kb": round(dst.stat().st_size / 1024, 2), "meta": meta}, indent=2))
    return 0


def main():
    p = argparse.ArgumentParser(description="Convert Google Drive image folders to WebP under a target KB size without using any LLM.")
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("batch", help="Run Google Drive batch conversion/upload")
    b.add_argument("--target-kb", type=int, default=1000)
    b.add_argument("--min-quality", type=int, default=40)
    b.add_argument("--run-id", default="")
    b.add_argument("--workdir", default="")
    b.add_argument("--output-parent", default=os.getenv("OUTPUT_PARENT_FOLDER_ID", ""), help="Optional Drive parent folder ID for output folders")
    b.add_argument("--report-every", type=int, default=10)
    b.set_defaults(func=run_batch)
    t = sub.add_parser("local-test", help="Compress one local image to verify target behavior")
    t.add_argument("input")
    t.add_argument("--output", default="")
    t.add_argument("--target-kb", type=int, default=1000)
    t.add_argument("--min-quality", type=int, default=40)
    t.set_defaults(func=local_test)
    args = p.parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
