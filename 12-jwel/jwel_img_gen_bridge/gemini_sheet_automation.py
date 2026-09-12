#!/usr/bin/env python3
"""Reusable Google Sheet -> eBay first image -> Gemini browser -> Google Drive -> Sheet update workflow.

Goals:
- Reuse the already logged-in Gemini Chromium/noVNC browser session via CDP.
- Keep the prompt frozen exactly as supplied by the user.
- Process only pending rows unless a serial is explicitly requested.
- Update Sheet column C (status) and D (Drive link).
- Minimize AI credits by skipping rows that are already Done / already linked.

Typical use:
  python3 gemini_sheet_automation.py --serial IMG0001
  python3 gemini_sheet_automation.py --all-pending

n8n use:
- Execute Command node that calls this script.
- Pass --serial or --all-pending depending on the trigger.
- Parse stdout JSON for row/file/link details.
"""

from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

from PIL import Image, ImageChops
from playwright.async_api import async_playwright
import asyncio

SPREADSHEET_ID = "1fINWAYjv4znTI4EzDIkMpCXZHEfu9EALEyx7eBJeRBw"
SHEET_NAME = "Sheet1"
DEFAULT_OUTPUT_PARENT = "1PqrwDl6-d8GTZ0GEmOlZ-KqNF_3s_cfJ"
DEFAULT_CDP_URL = "http://localhost:9244"
DEFAULT_ACCOUNT = "anees@aneeverse.com"
DEFAULT_PROMPT = """Use the attached image as a strict reference. Keep the jewelry exactly the same as in the source image: same design, same shape, same size, same proportions, same angle, same position, same tilt, same orientation, same material, same reflections, and same visible details. Do not redesign, reinterpret, rotate, resize, or alter the jewelry in any way.

Only change the background and surface. Place the jewelry on a smooth natural stone/rock surface in a natural garden setting in Central Park, New York City, with soft blurred green foliage, trees, and a hint of a stone pathway in the background (bokeh).

Lighting must be natural sunlight only, warm and soft, golden-hour style. No studio lighting, no flash, no artificial glow. Keep realistic outdoor shadows and highlights.

Use a high-end professional camera look, similar to a Canon EOS R5 or Sony A7R V, with a 100mm macro lens, shallow depth of field, and ultra-sharp focus on the jewelry.

The result must be fully photorealistic, premium, clean, and commercially usable. Preserve the jewelry exactly and improve only the background, surface, and image quality.

Image specifications: square format, 2000 x 2000 pixels, high resolution.

If a hand is visible in the source image, replace any gloves with a normal human hand. If there are no hands in the source image, do not add any hands.

Do not add any text, logos, watermarks, labels, or extra objects.
"""

ROOT_ENV = Path("/root/.env")
WORK_DIR = Path("/root/jwel_img_gen_bridge/work")
WORK_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}


def load_env_file(path: Path = ROOT_ENV) -> dict:
    env = os.environ.copy()
    if not path.exists():
        return env
    for raw in path.read_text(errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            env[key] = value
    return env


ENV = load_env_file()


def run_gog(args: List[str], timeout: int = 300, plain: bool = False) -> str:
    cmd = ["gog", *args]
    if plain:
        cmd.append("--plain")
    else:
        cmd.append("--json")
    cmd.append("--no-input")
    env = ENV.copy()
    env.setdefault("HOME", "/root")
    proc = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout, env=env)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or f"gog failed: {' '.join(args)}")
    return proc.stdout.strip()


def sheets_get(range_a1: str) -> List[List[str]]:
    out = run_gog([
        "sheets", "get", SPREADSHEET_ID, range_a1, "--account", DEFAULT_ACCOUNT
    ], timeout=300, plain=True)
    rows: List[List[str]] = []
    for row in csv.reader(out.splitlines(), delimiter="\t"):
        rows.append(row)
    return rows


def sheets_update(range_a1: str, values_2d: list[list[str]]) -> None:
    run_gog([
        "sheets", "update", SPREADSHEET_ID, range_a1,
        "--values-json", json.dumps(values_2d),
        "--account", DEFAULT_ACCOUNT,
    ], timeout=300, plain=True)


def drive_upload(local_path: Path, parent_id: str) -> tuple[str, str]:
    out = run_gog([
        "drive", "upload", str(local_path), "--parent", parent_id,
        "--account", DEFAULT_ACCOUNT,
    ], timeout=300)
    data = json.loads(out or "{}")
    file_obj = data.get("file") or data.get("result") or data
    file_id = file_obj.get("id")
    if not file_id:
        raise RuntimeError(f"Could not parse Drive upload result: {data}")
    share = run_gog([
        "drive", "share", file_id, "--to", "anyone", "--role", "reader", "--force",
        "--account", DEFAULT_ACCOUNT,
    ], timeout=300)
    try:
        share_data = json.loads(share or "{}")
        link = share_data.get("link") or file_obj.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view?usp=drivesdk"
    except Exception:
        link = file_obj.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view?usp=drivesdk"
    return file_id, link


def mkdir_drive(name: str, parent_id: str) -> tuple[str, str]:
    out = run_gog([
        "drive", "mkdir", name, "--parent", parent_id,
        "--account", DEFAULT_ACCOUNT,
    ], timeout=300)
    data = json.loads(out or "{}")
    folder_obj = data.get("file") or data.get("folder") or data.get("result") or data
    folder_id = folder_obj.get("id")
    if not folder_id:
        raise RuntimeError(f"Could not parse Drive mkdir result: {data}")
    try:
        run_gog([
            "drive", "share", folder_id, "--to", "anyone", "--role", "reader", "--force",
            "--account", DEFAULT_ACCOUNT,
        ], timeout=300)
    except Exception:
        pass
    folder_link = folder_obj.get("webViewLink") or f"https://drive.google.com/drive/folders/{folder_id}?usp=sharing"
    return folder_id, folder_link


def safe_unlink(path: Optional[Path]) -> None:
    if not path:
        return
    try:
        path.unlink(missing_ok=True)
    except Exception:
        pass


async def click_gemini_upload_files(page, reference_image_path: Path) -> None:
    """Open Gemini's upload menu, try direct button/file-chooser fallbacks first, then OCR/coordinate fallbacks."""
    # Use DOM click to bypass overlay-intercept issues in Gemini's sidebar.
    await page.evaluate("""() => {
      const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '') === 'Upload & tools');
      if (!btn) throw new Error('Gemini upload button not found');
      btn.click();
    }""")
    await page.wait_for_timeout(1200)

    text_fallbacks = ['Files', 'Upload files', 'Upload', 'Add from Drive', 'More uploads']
    for label in text_fallbacks:
        clickable = page.locator('button').filter(has_text=re.compile(re.escape(label)))
        if await clickable.count() == 0:
            clickable = page.get_by_text(label, exact=True)
        try:
            if await clickable.count() == 0:
                continue
            async with page.expect_file_chooser(timeout=7000) as fc_info:
                await clickable.first.click(timeout=7000)
            chooser = await fc_info.value
            await chooser.set_files(str(reference_image_path))
            return
        except Exception:
            pass

    # If Gemini inserted a hidden file input instead of emitting a chooser, use it directly.
    for _ in range(40):
        loc = page.locator('input[type="file"]')
        if await loc.count() > 0:
            await loc.first.set_input_files(str(reference_image_path))
            return
        await page.wait_for_timeout(150)

    # OCR-based coordinate fallback: the upload menu may render without a usable file chooser.
    shot = WORK_DIR / f"gemini_upload_menu_{int(time.time())}.png"
    await page.screenshot(path=str(shot), full_page=False)
    proc = subprocess.run(["tesseract", str(shot), "stdout", "tsv"], text=True, capture_output=True)
    upload_word = None
    files_word = None
    for row in csv.DictReader(io.StringIO(proc.stdout), delimiter="\t"):
        if row.get("level") != "5" or not row.get("text"):
            continue
        text = row["text"].strip().lower()
        if text not in {"upload", "files"}:
            continue
        try:
            left = float(row["left"])
            top = float(row["top"])
            width = float(row["width"])
            height = float(row["height"])
        except Exception:
            continue
        if top < 300 or left < 350:
            continue
        box = (left, top, left + width, top + height)
        if text == "upload":
            upload_word = box
        elif text == "files":
            files_word = box

    dpr = float(await page.evaluate('window.devicePixelRatio || 1'))
    candidates = [
        (422.0, 348.0),
        (426.0, 348.0),
        (422.0, 352.0),
        (426.0, 352.0),
        (430.0, 348.0),
        (430.0, 352.0),
    ]
    if upload_word:
        left, top, right, bottom = upload_word
        candidates.insert(0, ((left + 4.0) / dpr, (top + 4.0) / dpr))
    if files_word:
        left, top, right, bottom = files_word
        candidates.insert(0, ((left + 4.0) / dpr, (top + 4.0) / dpr))
    for click_x, click_y in candidates:
        await page.mouse.click(click_x, click_y)
        for _ in range(20):
            loc = page.locator('input[type="file"]')
            if await loc.count() > 0:
                await loc.first.set_input_files(str(reference_image_path))
                return
            await page.wait_for_timeout(150)
    raise RuntimeError('Gemini file input not found after opening upload menu')


@dataclass
class RowTask:
    row_num: int
    serial: str
    image_no: str
    listing_url: str
    status: str
    output_link: str
    prompt: str
    type: str


def parse_image_no_list(raw: str) -> list[int]:
    values: list[int] = []
    for part in (raw or '').split(','):
        piece = part.strip()
        if not piece:
            continue
        if not piece.isdigit():
            raise ValueError(f'Invalid Image No value: {raw!r}')
        n = int(piece)
        if n <= 0:
            raise ValueError(f'Image No must be positive: {raw!r}')
        values.append(n)
    return values or [1]


async def ebay_listing_title(listing_url: str, cdp_url: str = DEFAULT_CDP_URL) -> str:
    """Fetch the eBay listing title for secondary prompt context."""
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(cdp_url)
        page = await browser.contexts[0].new_page()
        try:
            await page.goto(listing_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(2500)
            og = await page.locator('meta[property="og:title"]').evaluate_all("""els => els.map(e => e.content).filter(Boolean)""")
            if og:
                title = og[0].strip()
            else:
                h1 = await page.locator('h1').evaluate_all("""els => els.map(e => (e.innerText || e.textContent || '').trim()).filter(Boolean)""")
                title = h1[0].strip() if h1 else ''
            if not title:
                title = (await page.title()).strip()
            return title
        finally:
            await page.close()
            await browser.close()


async def ebay_listing_image_urls(listing_url: str, cdp_url: str = DEFAULT_CDP_URL) -> list[str]:
    """Resolve ordered eBay image URLs from the live listing page."""
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(cdp_url)
        page = await browser.contexts[0].new_page()
        try:
            await page.goto(listing_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)
            imgs = await page.locator("img").evaluate_all(
                """(els) => els.map((e, i) => ({
                    i,
                    src: e.currentSrc || e.src || '',
                    alt: e.alt || '',
                    w: e.naturalWidth || 0,
                    h: e.naturalHeight || 0,
                })).filter(x => x.src)"""
            )
            seen: set[str] = set()
            ordered: list[str] = []
            for x in imgs:
                src = x.get('src') or ''
                if 'i.ebayimg.com' not in src or 'thumbs/' in src:
                    continue
                if src in seen:
                    continue
                seen.add(src)
                ordered.append(src)
            if ordered:
                return ordered
            og = await page.locator('meta[property="og:image"]').evaluate_all(
                """els => els.map(e => e.content).filter(Boolean)"""
            )
            if og:
                return og[:]
            raise RuntimeError(f"No image candidates found on eBay listing: {listing_url}")
        finally:
            await page.close()
            await browser.close()


async def first_ebay_image_url(listing_url: str, cdp_url: str = DEFAULT_CDP_URL) -> str:
    """Resolve the first eBay image using the live browser because it is more reliable than raw HTTP."""
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(cdp_url)
        page = await browser.contexts[0].new_page()
        try:
            await page.goto(listing_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)
            # Prefer the actual gallery image for "Picture 1 of ..." rather than any thumbnail or UI image.
            imgs = await page.locator("img").evaluate_all(
                """(els) => els.map((e, i) => ({
                    i,
                    src: e.currentSrc || e.src || '',
                    alt: e.alt || '',
                    w: e.naturalWidth || 0,
                    h: e.naturalHeight || 0,
                    rect: e.getBoundingClientRect ? {w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height} : null,
                })).filter(x => x.src)"""
            )
            candidates = [x for x in imgs if "i.ebayimg.com" in x["src"] and "thumbs/" not in x["src"]]
            if candidates:
                def is_picture_number_only(x):
                    alt = (x.get("alt") or "").strip().lower()
                    return bool(re.fullmatch(r"picture\s+\d+\s+of\s+\d+", alt))

                def score(x):
                    alt = (x.get("alt") or "").lower()
                    src = x.get("src") or ""
                    natural = (x.get("w") or 0) * (x.get("h") or 0)
                    rect = x.get("rect") or {}
                    rendered = (rect.get("w") or 0) * (rect.get("h") or 0)
                    picture1 = 1 if "picture 1 of" in alt else 0
                    hi_res = 1 if any(tag in src for tag in ("s-l1600", "s-l1200", "s-l960")) else 0
                    # Prefer real product imagery over numbered gallery thumbnails.
                    return (hi_res, natural, rendered, picture1)

                product_like = [x for x in candidates if not is_picture_number_only(x)]
                pool = product_like or candidates
                pool.sort(key=score, reverse=True)
                return pool[0]["src"]

            # fallback to open graph image
            og = await page.locator('meta[property="og:image"]').evaluate_all(
                """els => els.map(e => e.content).filter(Boolean)"""
            )
            if og:
                return og[0]
            # fallback to any image
            if imgs:
                return imgs[0]["src"]
            raise RuntimeError(f"No image candidates found on eBay listing: {listing_url}")
        finally:
            await page.close()
            await browser.close()


async def gemini_generate(reference_image_path: Path, prompt: str, cdp_url: str = DEFAULT_CDP_URL) -> Path:
    """Upload the reference image into the live Gemini browser and capture the generated output as a PNG."""
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(cdp_url)
        # Prefer the primary fresh Gemini conversation tab in this workspace.
        pages = browser.contexts[0].pages
        page = pages[1] if len(pages) > 1 else (pages[0] if pages else await browser.contexts[0].new_page())
        await page.bring_to_front()

        await page.goto("https://gemini.google.com/app", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1500)

        # Start a fresh chat so earlier conversation history does not steer the result.
        for fresh in [
            page.locator('a,button').filter(has_text=re.compile(r'^New chat$')),
            page.get_by_text('New chat', exact=True),
        ]:
            try:
                if await fresh.count() > 0:
                    await fresh.first.click(timeout=10000)
                    await page.wait_for_timeout(1500)
                    break
            except Exception:
                pass

        # Upload file via the UI.
        await click_gemini_upload_files(page, reference_image_path)

        # Write exact prompt text into the editor.
        await page.evaluate(
            """
            (text) => {
              const el = document.querySelector('[aria-label="Enter a prompt for Gemini"]')
                       || document.querySelector('[data-placeholder="Ask Gemini"]')
                       || document.querySelector('[contenteditable="true"]');
              if (!el) throw new Error('prompt box not found');
              el.focus();
              el.textContent = text;
              el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
            }
            """,
            prompt,
        )
        await page.wait_for_timeout(700)

        send_btn = page.get_by_role("button", name=re.compile(r"Send|Generate|Submit|Run"))
        if await send_btn.count() > 0:
            await send_btn.first.click(timeout=15000)
        else:
            await page.keyboard.press("Enter")

        # Wait for a result image to appear and then capture it as a full PNG.
        ref_img = Image.open(reference_image_path).convert('RGBA')
        out_path = WORK_DIR / f"gemini_output_{int(time.time())}.png"
        img_handle = None
        for _ in range(72):  # ~6 minutes
            await page.wait_for_timeout(5000)
            # If Gemini has rendered a small preview for the AI result, open it so the full image becomes available.
            try:
                ai_preview = page.locator('img[alt=", AI generated"]')
                if await ai_preview.count() > 0:
                    await ai_preview.first.evaluate("el => (el.closest('button') || el).click()")
                    await page.wait_for_timeout(1500)
            except Exception:
                pass

            # Prefer the full-size image in the open preview dialog / viewer.
            full_candidates = page.locator('img[src^="blob:"]')
            if await full_candidates.count() == 0:
                continue
            for idx in range(await full_candidates.count()):
                handle = await full_candidates.nth(idx).element_handle()
                if not handle:
                    continue
                dims = await handle.evaluate(
                    "(el) => ({w: el.naturalWidth || 0, h: el.naturalHeight || 0, alt: el.alt || '', src: el.src || ''})"
                )
                if dims["w"] < 512 or dims["h"] < 512:
                    continue
                if (dims.get('alt') or '').strip() == 'Uploaded image preview':
                    continue
                if (dims.get('alt') or '').strip() == ', AI generated' and dims["w"] < 512:
                    continue
                data_url = await handle.evaluate(
                    """
                    async (img) => {
                      if (img.decode) { try { await img.decode(); } catch (e) {} }
                      const w = img.naturalWidth || img.width;
                      const h = img.naturalHeight || img.height;
                      const canvas = document.createElement('canvas');
                      canvas.width = w;
                      canvas.height = h;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, w, h);
                      return canvas.toDataURL('image/png');
                    }
                    """
                )
                header, b64 = data_url.split(",", 1)
                out_path.write_bytes(base64.b64decode(b64))
                try:
                    cand_img = Image.open(out_path).convert('RGBA')
                    same_size = cand_img.size == ref_img.size
                    identical = False
                    if same_size:
                        identical = ImageChops.difference(cand_img, ref_img).getbbox() is None
                    if identical:
                        out_path.unlink(missing_ok=True)
                        continue
                    img_handle = handle
                    break
                except Exception:
                    out_path.unlink(missing_ok=True)
                    continue
            if img_handle:
                break
        if not img_handle or not out_path.exists():
            raise RuntimeError("Gemini output image not found")


        await browser.close()
        return out_path


def read_sheet_tasks(serial: Optional[str] = None, all_pending: bool = False) -> List[RowTask]:
    rows = sheets_get("A:G")
    if not rows:
        return []
    tasks: List[RowTask] = []
    for idx, row in enumerate(rows[1:], start=2):
        if len(row) < 3:
            continue
        serial_val = row[0].strip() if len(row) > 0 else ""
        image_no_val = row[1].strip() if len(row) > 1 else ""
        link_val = row[2].strip() if len(row) > 2 else ""
        status_val = row[3].strip() if len(row) > 3 else ""
        output_val = row[4].strip() if len(row) > 4 else ""
        prompt_val = row[5].strip() if len(row) > 5 else ""
        type_val = row[6].strip() if len(row) > 6 else ""
        task = RowTask(idx, serial_val, image_no_val, link_val, status_val, output_val, prompt_val, type_val)
        if serial and serial_val == serial:
            tasks.append(task)
        elif all_pending and status_val.lower() not in {"done", "in-progress", "in progress"}:
            tasks.append(task)
    return tasks


def compose_prompt(base_prompt: str, listing_title: str = '') -> str:
    title = (listing_title or '').strip()
    if not title:
        return base_prompt
    return f"Listing title: {title}\n\n{base_prompt}"


async def process_task(task: RowTask, prompt: str, drive_parent: str, cdp_url: str) -> dict:
    # Skip completed rows to conserve AI credits.
    if task.output_link and task.status.lower() == "done":
        return {"serial": task.serial, "row": task.row_num, "skipped": True, "reason": "already_done", "output_link": task.output_link}

    # Mark in progress before making external calls.
    sheets_update(f"{SHEET_NAME}!D{task.row_num}", [["IN-Progress"]])

    image_numbers = parse_image_no_list(task.image_no)
    listing_image_urls = await ebay_listing_image_urls(task.listing_url, cdp_url=cdp_url)
    if max(image_numbers) > len(listing_image_urls):
        raise RuntimeError(
            f"Listing only has {len(listing_image_urls)} usable image(s), but Image No requested {image_numbers!r}"
        )

    effective_prompt = (task.prompt or "").strip() or prompt
    prompt_with_title = compose_prompt(effective_prompt, await ebay_listing_title(task.listing_url, cdp_url=cdp_url))
    generated_items: list[dict] = []
    folder_id = ''
    folder_link = ''
    try:
        multi = len(image_numbers) > 1
        if multi:
            folder_id, folder_link = mkdir_drive(task.serial, drive_parent)

        for image_no in image_numbers:
            image_url = listing_image_urls[image_no - 1]
            suffix = Path(urllib.parse.urlparse(image_url).path).suffix.lstrip('.') or 'jpg'
            ref_path = WORK_DIR / f"{task.serial}_img{image_no}_reference.{suffix}"
            out_path: Optional[Path] = None
            try:
                req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    ref_path.write_bytes(resp.read())
                out_path = await gemini_generate(ref_path, prompt_with_title, cdp_url=cdp_url)
                if multi:
                    file_id, drive_link = drive_upload(out_path, folder_id)
                else:
                    file_id, drive_link = drive_upload(out_path, drive_parent)
                    folder_link = drive_link
                generated_items.append({
                    "image_no": image_no,
                    "listing_image_url": image_url,
                    "output_file": str(out_path),
                    "drive_file_id": file_id,
                    "drive_link": drive_link,
                })
            finally:
                safe_unlink(ref_path)
                safe_unlink(out_path)

        sheets_update(f"{SHEET_NAME}!D{task.row_num}:E{task.row_num}", [["Done", folder_link]])
        return {
            "serial": task.serial,
            "row": task.row_num,
            "listing_url": task.listing_url,
            "image_nos": image_numbers,
            "generated": generated_items,
            "output_link": folder_link,
            "folder_id": folder_id,
            "folder_link": folder_link,
            "status": "Done",
        }
    except Exception:
        raise


async def main_async(args: argparse.Namespace) -> int:
    tasks = read_sheet_tasks(serial=args.serial, all_pending=args.all_pending)
    if not tasks:
        print(json.dumps({"ok": True, "message": "No matching rows"}, indent=2))
        return 0

    results = []
    for task in tasks:
        try:
            result = await process_task(task, args.prompt, args.drive_parent, args.cdp_url)
            results.append(result)
            print(json.dumps(result, indent=2))
            if args.serial:
                break
        except Exception as e:
            # If a failure happens after IN-Progress, mark error so it doesn't keep burning credits on retries.
            try:
                sheets_update(f"{SHEET_NAME}!D{task.row_num}", [[f"Error: {e}"]])
            except Exception:
                pass
            err = {"serial": task.serial, "row": task.row_num, "error": str(e)}
            results.append(err)
            print(json.dumps(err, indent=2))
            if args.serial:
                break
    print(json.dumps({"ok": all("error" not in r for r in results), "results": results}, indent=2))
    return 0 if all("error" not in r for r in results) else 1


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="IMG automation: Sheet B -> eBay first image -> Gemini browser -> Drive -> Sheet D")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--serial", help="Process one row by serial number, e.g. IMG0001")
    g.add_argument("--all-pending", action="store_true", help="Process all rows whose status is not Done / In-Progress")
    p.add_argument("--prompt", default=DEFAULT_PROMPT, help="Prompt to send to Gemini. Default is the locked jewelry prompt.")
    p.add_argument("--drive-parent", default=DEFAULT_OUTPUT_PARENT, help="Google Drive folder ID for output files")
    p.add_argument("--cdp-url", default=DEFAULT_CDP_URL, help="Chrome DevTools URL for the live Gemini browser")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
