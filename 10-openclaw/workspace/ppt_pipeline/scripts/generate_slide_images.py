#!/usr/bin/env python3
"""Generate approved slide images for PDF -> PPT build payload.

Current brand-protected placeholder map only allows slide_01_hero_cover.hero_image.
This script therefore generates/replaces only allowed image roles present in the
placeholder map and leaves all logos/decorative/brand images untouched.
"""
from __future__ import annotations

from pathlib import Path
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

from PIL import Image, ImageDraw, ImageFilter

WORKSPACE = Path(os.getenv("PPT_WORKSPACE", "/root/.openclaw/workspace"))
BASE = Path(os.getenv("PPT_PIPELINE_BASE", str(WORKSPACE / "ppt_pipeline")))
LIBRARY = Path(os.getenv("PPT_LIBRARY_BASE", str(WORKSPACE / "ppt_library")))
PLACEHOLDER_JSON = BASE / "schemas/pptx_placeholder_map.json"


def load_env() -> None:
    candidates = [
        Path(os.getenv("PPT_ENV_FILE", "")) if os.getenv("PPT_ENV_FILE") else None,
        WORKSPACE / ".env",
        Path("/root/.env"),
    ]
    for p in [x for x in candidates if x]:
        try:
            if not p.exists():
                continue
            for line in p.read_text(errors="ignore").splitlines():
                if "=" not in line or line.strip().startswith("#"):
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except PermissionError:
            continue


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def allowed_image_roles(placeholder_map):
    allowed = {}
    for t in placeholder_map.get("templates", []):
        roles = {
            ph["role"]
            for ph in t.get("image_placeholders", [])
            if ph.get("replace") is True
        }
        allowed[t["template_id"]] = roles
    return allowed


def harden_prompt(prompt: str, slide_text: dict | None = None) -> str:
    # Do not pass company/product names from the deck into the image model. In testing,
    # brand-like terms caused the model to render text/logos, which violates slide 1 rules.
    raw = (prompt or "business operations platform").strip()
    banned = ["truckstop", "partner", "playbook", "logo", "brand", "text", "title"]
    words = []
    for word in raw.replace("/", " ").replace("-", " ").split():
        clean = "".join(ch for ch in word if ch.isalnum()).lower()
        if clean and clean not in banned and len(clean) > 2:
            words.append(clean)
    semantic_hint = " ".join(words[:10]) or "freight logistics technology operations"
    return (
        "Premium 16:9 abstract business presentation hero image for "
        f"{semantic_hint}. "
        "Use non-branded abstract logistics/technology visuals: soft network lines, subtle geometric forms, "
        "generic cargo/freight silhouettes only if needed. "
        "STRICTLY NO text, NO letters, NO numbers, NO words, NO captions, NO signs, NO labels, "
        "NO UI text, NO license plates, NO logos, NO brand marks, NO watermark, NO readable symbols. "
        "Composition requirement: left 45 percent must be clean, empty, dark, low-detail negative space; "
        "main visual detail must be concentrated on the right side. "
        "Modern cinematic lighting, professional enterprise style, dark blue palette, clean background."
    )


def http_json(url: str, payload: dict | None, headers: dict, timeout: int = 120, method: str = "POST"):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_file(url: str, dest: Path, timeout: int = 180) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "pdf-to-ppt-image-generator/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        dest.write_bytes(resp.read())


def generate_with_replicate(prompt: str, out_path: Path) -> dict:
    token = os.getenv("REPLICATE_API_TOKEN") or os.getenv("REPLICATE_API_KEY")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN missing")
    model = os.getenv("PPT_REPLICATE_IMAGE_MODEL", "black-forest-labs/flux-schnell")
    url = f"https://api.replicate.com/v1/models/{model}/predictions"
    payload = {
        "input": {
            "prompt": prompt,
            "aspect_ratio": os.getenv("PPT_IMAGE_ASPECT_RATIO", "16:9"),
            "output_format": "png",
            "output_quality": 90,
            "num_outputs": 1,
            "go_fast": True,
        }
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "wait=10",
    }
    pred = http_json(url, payload, headers, timeout=60)
    get_url = pred.get("urls", {}).get("get")
    status = pred.get("status")
    deadline = time.time() + int(os.getenv("PPT_IMAGE_TIMEOUT_SECONDS", "300"))
    while status not in {"succeeded", "failed", "canceled"} and get_url and time.time() < deadline:
        time.sleep(3)
        pred = http_json(get_url, None, {"Authorization": f"Bearer {token}"}, timeout=60, method="GET")
        status = pred.get("status")
    if status != "succeeded":
        raise RuntimeError(f"Replicate image generation failed/status={status}: {pred.get('error')}")
    output = pred.get("output")
    if isinstance(output, list):
        output_url = output[0]
    elif isinstance(output, str):
        output_url = output
    else:
        raise RuntimeError("Replicate returned no image URL")
    download_file(output_url, out_path)
    return {"provider": "replicate", "model": model, "source_url": output_url, "prediction_id": pred.get("id")}


def fallback_image(prompt: str, out_path: Path) -> dict:
    # Deterministic emergency fallback so PPTX builds remain testable if provider quota/network fails.
    img = Image.new("RGB", (1600, 900), "#101827")
    draw = ImageDraw.Draw(img)
    # dark left negative space
    draw.rectangle([0, 0, 680, 900], fill="#07111f")
    # right abstract visual detail
    colors = ["#2563eb", "#06b6d4", "#8b5cf6", "#22c55e"]
    for i, c in enumerate(colors):
        x0 = 760 + i * 95
        y0 = 120 + i * 70
        draw.ellipse([x0, y0, x0 + 520, y0 + 520], fill=c)
    for i in range(18):
        x = 850 + (i * 37) % 650
        y = 80 + (i * 71) % 740
        draw.line([x, y, 1500, 450], fill="#ffffff", width=2)
    img = img.filter(ImageFilter.GaussianBlur(radius=18))
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([0, 0, 760, 900], fill=(0, 0, 0, 90))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    img.save(out_path, "PNG")
    return {"provider": "local_fallback", "reason": "provider unavailable", "prompt_excerpt": prompt[:240]}


def generate_image(prompt: str, out_path: Path) -> dict:
    provider = os.getenv("PPT_IMAGE_PROVIDER", "replicate").lower().strip()
    errors = []
    if provider in {"replicate", "auto"}:
        try:
            return generate_with_replicate(prompt, out_path)
        except Exception as e:
            errors.append(f"replicate: {e}")
    if os.getenv("PPT_IMAGE_ALLOW_PLACEHOLDER_FALLBACK", "true").lower() not in {"0", "false", "no"}:
        meta = fallback_image(prompt, out_path)
        meta["errors"] = errors
        return meta
    raise RuntimeError("; ".join(errors) or "No enabled image provider")


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: generate_slide_images.py build_payload.json output_dir", file=sys.stderr)
        sys.exit(2)
    load_env()
    payload_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = read_json(payload_path)
    placeholder_map = read_json(PLACEHOLDER_JSON)
    allowed = allowed_image_roles(placeholder_map)
    manifest = {"status": "ok", "generated": [], "skipped": [], "errors": []}

    for slide in payload.get("slides", []):
        tid = slide.get("template_id")
        image_roles = slide.get("images") or {}
        for role, spec in list(image_roles.items()):
            if role not in allowed.get(tid, set()):
                manifest["skipped"].append({"order": slide.get("order"), "template_id": tid, "role": role, "reason": "not_replaceable_in_placeholder_map"})
                slide["images"].pop(role, None)
                continue
            prompt = ""
            if isinstance(spec, dict):
                prompt = spec.get("prompt") or spec.get("description") or ""
            elif isinstance(spec, str):
                prompt = spec
            final_prompt = harden_prompt(prompt, slide.get("text") or {})
            filename = f"slide_{int(slide.get('order', 0)):02d}_{role}.png"
            out_path = out_dir / filename
            try:
                meta = generate_image(final_prompt, out_path)
                slide.setdefault("images", {})[role] = {"path": str(out_path), "prompt": final_prompt, **meta}
                manifest["generated"].append({"order": slide.get("order"), "template_id": tid, "role": role, "path": str(out_path), **meta})
            except Exception as e:
                manifest["errors"].append({"order": slide.get("order"), "template_id": tid, "role": role, "error": str(e)})
                raise

    write_json(payload_path, payload)
    write_json(out_dir / "generated_images_manifest.json", manifest)
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
