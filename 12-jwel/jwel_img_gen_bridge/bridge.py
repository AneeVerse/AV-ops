#!/usr/bin/env python3
import asyncio
import base64
import cgi
import csv
import io
import json
import mimetypes
import os
import re
import subprocess
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

ROOT_ENV = Path('/root/.env')
DEFAULT_OUTPUT_PARENT = '1PqrwDl6-d8GTZ0GEmOlZ-KqNF_3s_cfJ'
DEFAULT_CDP_URL = os.environ.get('JWEL_IMG_GEN_CDP_URL', 'http://[::1]:9244')
MODEL = os.environ.get('JWEL_IMG_GEN_MODEL', 'gemini-browser')


def estimated_cost_usd():
    return float(os.environ.get('JWEL_IMG_GEN_MODEL_COST_USD', '0.039'))


PORT = int(os.environ.get('JWEL_IMG_GEN_BRIDGE_PORT', '8024'))
WORK_DIR = Path('/root/jwel_img_gen_bridge/work')
WORK_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PROMPT = """Use the attached image as a strict reference. Keep the jewelry exactly the same as in the source image: same design, same shape, same size, same proportions, same angle, same position, same tilt, same orientation, same material, same reflections, and same visible details. Do not redesign, reinterpret, rotate, resize, or alter the jewelry in any way.

Only change the background and surface. Place the jewelry on a smooth natural stone/rock surface in a natural garden setting in Central Park, New York City, with soft blurred green foliage, trees, and a hint of a stone pathway in the background (bokeh).

Lighting must be natural sunlight only, warm and soft, golden-hour style. No studio lighting, no flash, no artificial glow. Keep realistic outdoor shadows and highlights.

Use a high-end professional camera look, similar to a Canon EOS R5 or Sony A7R V, with a 100mm macro lens, shallow depth of field, and ultra-sharp focus on the jewelry.

The result must be fully photorealistic, premium, clean, and commercially usable. Preserve the jewelry exactly and improve only the background, surface, and image quality.

Image specifications: square format, 2000 x 2000 pixels, high resolution.

If a hand is visible in the source image, replace any gloves with a normal human hand. If there are no hands in the source image, do not add any hands.

Do not add any text, logos, watermarks, labels, or extra objects.
"""

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
IMAGE_MIMES = {'image/jpeg', 'image/png', 'image/webp'}

def load_env_file(path=ROOT_ENV):
    env = os.environ.copy()
    if not path.exists():
        return env
    for raw in path.read_text(errors='ignore').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k:
            env[k] = v
    return env

ENV = load_env_file()


def json_response(handler, status, payload):
    data = json.dumps(payload, indent=2).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    handler.send_header('Content-Length', str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def extract_drive_folder_id(value):
    value = str(value or '').strip()
    if not value:
        return ''
    patterns = [
        r'/folders/([A-Za-z0-9_-]+)',
        r'[?&]id=([A-Za-z0-9_-]+)',
        r'^([A-Za-z0-9_-]{10,})$',
    ]
    for pat in patterns:
        m = re.search(pat, value)
        if m:
            return m.group(1)
    return value


def safe_name(raw, default='image'):
    raw = str(raw or default)
    raw = re.sub(r'[^A-Za-z0-9_.-]+', '_', raw).strip('_')
    return raw[:120] or default


def http_json(method, url, body=None, headers=None, timeout=60):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode('utf-8')
        return json.loads(raw) if raw else {}


def download_url(url, out_path):
    req = urllib.request.Request(url, headers={'User-Agent': 'jwel-img-gen-bridge/1.0'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        out_path.write_bytes(resp.read())
        ctype = resp.headers.get_content_type()
    return ctype


def data_url_from_file(path, mime=None):
    mime = mime or mimetypes.guess_type(str(path))[0] or 'image/jpeg'
    b64 = base64.b64encode(path.read_bytes()).decode('ascii')
    return f'data:{mime};base64,{b64}'


async def gemini_generate_browser(image_path, prompt=None, cdp_url=DEFAULT_CDP_URL):
    prompt = prompt or DEFAULT_PROMPT
    ref_img = Image.open(image_path).convert('RGBA')
    out_path = WORK_DIR / f'gemini_output_{int(time.time())}.png'
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(cdp_url)
        pages = browser.contexts[0].pages
        page = pages[1] if len(pages) > 1 else pages[0]

        await page.goto('https://gemini.google.com/app', wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(1500)

        await click_gemini_upload_files(page, reference_image_path)
        await page.wait_for_timeout(1200)

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

        send_btn = page.get_by_role('button', name=re.compile(r'Send|Generate|Submit|Run'))
        if await send_btn.count() > 0:
            await send_btn.first.click(timeout=15000)
        else:
            await page.keyboard.press('Enter')

        found = False
        for _ in range(48):
            await page.wait_for_timeout(5000)
            locator = page.locator('img[src^="blob:"]')
            if await locator.count() == 0:
                continue
            handle = await locator.last.element_handle()
            if not handle:
                continue
            dims = await handle.evaluate("(el) => ({w: el.naturalWidth || 0, h: el.naturalHeight || 0})")
            if dims['w'] < 256 or dims['h'] < 256:
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
            _, b64 = data_url.split(',', 1)
            out_path.write_bytes(base64.b64decode(b64))
            try:
                cand_img = Image.open(out_path).convert('RGBA')
                same_size = cand_img.size == ref_img.size
                identical = same_size and ImageChops.difference(cand_img, ref_img).getbbox() is None
                if identical:
                    out_path.unlink(missing_ok=True)
                    continue
                found = True
                break
            except Exception:
                found = True
                break
        await browser.close()
        if not found:
            raise RuntimeError('Gemini output image not found')
    return out_path


def run_gog(args, timeout=300):
    env = ENV.copy()
    env.setdefault('HOME', '/root')
    p = subprocess.run(['gog', 'drive', *args, '--json', '--no-input'], text=True, capture_output=True, timeout=timeout, env=env)
    if p.returncode != 0:
        raise RuntimeError(f'gog drive {args[0]} failed: {p.stderr.strip() or p.stdout.strip()}')
    out = p.stdout.strip()
    return json.loads(out) if out else {}


def list_drive_images(folder_id):
    data = run_gog(['ls', '--parent', folder_id, '--max', '1000'], timeout=120)
    files = data.get('files') or data.get('result') or data.get('data') or []
    images = []
    for f in files:
        name = f.get('name') or f.get('filename') or ''
        mime = f.get('mimeType') or f.get('mime_type') or ''
        ext = Path(name).suffix.lower()
        if mime in IMAGE_MIMES or ext in IMAGE_EXTS:
            images.append(f)
    return images


def mkdir_drive(name, parent_id):
    data = run_gog(['mkdir', name, '--parent', parent_id], timeout=120)
    folder = data.get('file') or data.get('folder') or data.get('result') or data
    folder_id = folder.get('id')
    if not folder_id:
        raise RuntimeError(f'Could not parse created folder id from gog output: {data}')
    try:
        share_drive(folder_id)
    except Exception:
        pass
    link = folder.get('webViewLink') or f'https://drive.google.com/drive/folders/{folder_id}?usp=sharing'
    return folder_id, link


def download_drive_file(file_id, out_path):
    # gog writes the file to --out. JSON output can vary; the file existence is authoritative.
    env = ENV.copy(); env.setdefault('HOME', '/root')
    p = subprocess.run(['gog', 'drive', 'download', file_id, '--out', str(out_path), '--json', '--no-input'], text=True, capture_output=True, timeout=300, env=env)
    if p.returncode != 0:
        raise RuntimeError(f'gog drive download failed: {p.stderr.strip() or p.stdout.strip()}')
    if not out_path.exists() or out_path.stat().st_size == 0:
        # Some gog versions treat --out as directory; try to find latest file there.
        if out_path.is_dir():
            candidates = sorted(out_path.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
            if candidates:
                return candidates[0]
        raise RuntimeError(f'Downloaded file missing/empty for Drive file {file_id}')
    return out_path


def upload_and_share(local_path, parent_folder_id):
    data = run_gog(['upload', str(local_path), '--parent', parent_folder_id], timeout=300)
    file_obj = data.get('file') or data.get('result') or data
    file_id = file_obj.get('id')
    if not file_id:
        raise RuntimeError(f'Could not parse uploaded file id from gog output: {data}')
    link = share_drive(file_id) or file_obj.get('webViewLink') or f'https://drive.google.com/file/d/{file_id}/view?usp=sharing'
    return file_id, link, file_obj


def safe_unlink(path: Optional[Path]) -> None:
    if not path:
        return
    try:
        path.unlink(missing_ok=True)
    except Exception:
        pass


async def click_gemini_upload_files(page, reference_image_path) -> None:
    upload_btn = page.get_by_role('button', name=re.compile(r'Upload & tools|Attach|Add files|Tools|More uploads'))
    if await upload_btn.count() == 0:
        raise RuntimeError('Gemini upload button not found')
    await upload_btn.first.click(timeout=15000)
    await page.wait_for_timeout(1200)

    text_fallbacks = ['Upload files', 'Files', 'Upload']
    for label in text_fallbacks:
        clickable = page.get_by_text(label, exact=True)
        try:
            if await clickable.count() == 0:
                continue
            async with page.expect_file_chooser(timeout=4000) as fc_info:
                await clickable.first.click(timeout=4000)
            chooser = await fc_info.value
            await chooser.set_files(str(reference_image_path))
            return
        except Exception:
            continue

    shot = WORK_DIR / f'gemini_upload_menu_{int(time.time())}.png'
    await page.screenshot(path=str(shot), full_page=False)
    proc = subprocess.run(['tesseract', str(shot), 'stdout', 'tsv'], text=True, capture_output=True)
    upload_word = None
    files_word = None
    for row in csv.DictReader(io.StringIO(proc.stdout), delimiter='\t'):
        if row.get('level') != '5' or not row.get('text'):
            continue
        text = row['text'].strip().lower()
        if text not in {'upload', 'files'}:
            continue
        try:
            left = float(row['left'])
            top = float(row['top'])
            width = float(row['width'])
            height = float(row['height'])
        except Exception:
            continue
        if top < 300 or left < 350:
            continue
        box = (left, top, left + width, top + height)
        if text == 'upload':
            upload_word = box
        elif text == 'files':
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
        for _ in range(8):
            loc = page.locator('input[type="file"]')
            if await loc.count() > 0:
                await loc.first.set_input_files(str(reference_image_path))
                return
            await page.wait_for_timeout(100)
    raise RuntimeError('Gemini file input not found after opening upload menu')


def share_drive(file_id):
    data = run_gog(['share', file_id, '--to', 'anyone', '--role', 'reader', '--force'], timeout=120)
    return data.get('link') or data.get('webViewLink')


def compose_prompt(base_prompt, listing_title=''):
    title = (listing_title or '').strip()
    if not title:
        return base_prompt
    return f'Listing title: {title}\n\n{base_prompt}'


def process_local_image(image_path, output_folder_id, prompt=None, source_name=None, listing_title=None):
    start_gen = time.time()
    prompt = compose_prompt(prompt or DEFAULT_PROMPT, listing_title)
    out = asyncio.run(gemini_generate_browser(image_path, prompt=prompt, cdp_url=DEFAULT_CDP_URL))
    duration_seconds = round(time.time() - start_gen, 2)
    drive_file_id, drive_link, drive_meta = upload_and_share(out, output_folder_id)
    safe_unlink(image_path)
    safe_unlink(out)
    return {
        'success': True,
        'source_name': source_name or image_path.name,
        'generation_provider': 'gemini_browser',
        'generated_local_path': str(out),
        'drive_file_id': drive_file_id,
        'drive_link': drive_link,
        'drive_name': drive_meta.get('name'),
        'duration_seconds': duration_seconds,
        'estimated_cost_usd': estimated_cost_usd(),
        'model': MODEL,
    }


def handle_single_file(file_bytes, filename, content_type, fields):
    parent = extract_drive_folder_id(fields.get('output_folder_url') or fields.get('output_folder_id') or DEFAULT_OUTPUT_PARENT)
    prompt = fields.get('prompt') or DEFAULT_PROMPT
    suffix = Path(filename or 'input.jpg').suffix.lower() or '.jpg'
    if suffix not in IMAGE_EXTS:
        suffix = '.jpg'
    src = WORK_DIR / f'input_{datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")}{suffix}'
    src.write_bytes(file_bytes)
    result = process_local_image(src, parent, prompt=prompt, source_name=filename or src.name, listing_title=fields.get('listing_title') or fields.get('title'))
    result['mode'] = 'single'
    return result


def handle_single_json(payload):
    parent = extract_drive_folder_id(payload.get('output_folder_url') or payload.get('output_folder_id') or DEFAULT_OUTPUT_PARENT)
    prompt = payload.get('prompt') or DEFAULT_PROMPT
    data_url = payload.get('image_data_url') or payload.get('image') or ''
    filename = payload.get('filename') or 'input.jpg'
    if not data_url.startswith('data:') or ';base64,' not in data_url:
        raise ValueError('image_data_url must be a data URL like data:image/jpeg;base64,...')
    header, b64 = data_url.split(',', 1)
    mime = header.split(';', 1)[0].replace('data:', '') or 'image/jpeg'
    suffix = mimetypes.guess_extension(mime) or Path(filename).suffix or '.jpg'
    if suffix == '.jpe':
        suffix = '.jpg'
    src = WORK_DIR / f'input_{datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")}{suffix}'
    src.write_bytes(base64.b64decode(b64))
    result = process_local_image(src, parent, prompt=prompt, source_name=filename, listing_title=payload.get('listing_title') or payload.get('title'))
    result['mode'] = 'single'
    return result


def handle_batch(payload):
    input_folder = extract_drive_folder_id(payload.get('input_folder_url') or payload.get('input_folder_id') or payload.get('folder_url') or payload.get('folder'))
    if not input_folder:
        raise ValueError('input_folder_url or input_folder_id is required')
    output_parent = extract_drive_folder_id(payload.get('output_parent_folder_url') or payload.get('output_parent_folder_id') or DEFAULT_OUTPUT_PARENT)
    prompt = payload.get('prompt') or DEFAULT_PROMPT
    limit = int(payload.get('limit') or 100)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    out_folder_name = safe_name(payload.get('output_folder_name') or f'jwel_img_gen_outputs_{stamp}', 'jwel_img_gen_outputs')
    output_folder_id, output_folder_link = mkdir_drive(out_folder_name, output_parent)
    images = list_drive_images(input_folder)[:limit]
    results = []
    batch_dir = WORK_DIR / out_folder_name
    batch_dir.mkdir(parents=True, exist_ok=True)
    for idx, f in enumerate(images, 1):
        name = f.get('name') or f'image_{idx}.jpg'
        file_id = f.get('id')
        try:
            suffix = Path(name).suffix.lower() if Path(name).suffix.lower() in IMAGE_EXTS else '.jpg'
            src = batch_dir / f'{idx:03d}_{safe_name(Path(name).stem)}{suffix}'
            download_drive_file(file_id, src)
            results.append(process_local_image(src, output_folder_id, prompt=prompt, source_name=name, listing_title=f.get('listing_title') or f.get('title')))
        except Exception as e:
            results.append({'success': False, 'source_name': name, 'drive_file_id': file_id, 'error': str(e)})
    return {
        'success': all(r.get('success') for r in results) if results else False,
        'mode': 'batch',
        'input_folder_id': input_folder,
        'output_folder_id': output_folder_id,
        'output_folder_link': output_folder_link,
        'total_images_found': len(images),
        'total_processed': sum(1 for r in results if r.get('success')),
        'results': results,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print('%s - %s' % (self.address_string(), fmt % args), flush=True)

    def do_OPTIONS(self):
        json_response(self, 204, {})

    def do_GET(self):
        if self.path.startswith('/health'):
            json_response(self, 200, {'ok': True, 'service': 'jwel-img-gen-bridge', 'model': MODEL})
        else:
            json_response(self, 404, {'ok': False, 'error': 'not_found'})

    def do_POST(self):
        try:
            path = urllib.parse.urlparse(self.path).path
            ctype, pdict = cgi.parse_header(self.headers.get('content-type', ''))
            if path == '/single':
                if ctype == 'application/json':
                    length = int(self.headers.get('content-length', '0'))
                    raw = self.rfile.read(length).decode('utf-8') if length else '{}'
                    result = handle_single_json(json.loads(raw or '{}'))
                    json_response(self, 200, result)
                    return
                if ctype != 'multipart/form-data':
                    raise ValueError('single mode requires multipart/form-data or JSON with image_data_url')
                pdict['boundary'] = bytes(pdict['boundary'], 'utf-8')
                fs = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers.get('content-type')})
                fileitem = fs['image'] if 'image' in fs else (fs['file'] if 'file' in fs else None)
                if fileitem is None or not getattr(fileitem, 'file', None):
                    raise ValueError('Missing image/file upload field')
                fields = {}
                for key in fs.keys():
                    item = fs[key]
                    if key not in {'image', 'file'} and not getattr(item, 'filename', None):
                        fields[key] = item.value
                content = fileitem.file.read()
                if not content:
                    raise ValueError('Uploaded image is empty')
                result = handle_single_file(content, fileitem.filename, fileitem.type, fields)
                json_response(self, 200, result)
            elif path == '/batch':
                length = int(self.headers.get('content-length', '0'))
                raw = self.rfile.read(length).decode('utf-8') if length else '{}'
                payload = json.loads(raw or '{}')
                result = handle_batch(payload)
                json_response(self, 200, result)
            else:
                json_response(self, 404, {'ok': False, 'error': 'not_found'})
        except Exception as e:
            traceback.print_exc()
            json_response(self, 500, {'success': False, 'error': str(e)})


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'jwel-img-gen-bridge listening on http://127.0.0.1:{PORT}', flush=True)
    server.serve_forever()
