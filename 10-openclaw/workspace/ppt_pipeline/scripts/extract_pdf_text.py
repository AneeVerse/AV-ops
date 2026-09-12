#!/usr/bin/env python3
"""Extract text from all pages of a PDF and chunk it for downstream AI.

Usage:
  python extract_pdf_text.py input.pdf output_dir

Outputs:
  extracted_text.txt
  chunks.json
  extraction_metadata.json
"""
from __future__ import annotations
from pathlib import Path
import json, sys, subprocess, shutil, re


def run_pdftotext(pdf: Path, out_txt: Path) -> None:
    if not shutil.which('pdftotext'):
        raise RuntimeError('pdftotext not found. Install poppler-utils.')
    # -layout preserves some reading order; no page range means all pages.
    subprocess.run(['pdftotext', '-layout', str(pdf), str(out_txt)], check=True)


def count_pages(pdf: Path) -> int | None:
    if not shutil.which('pdfinfo'):
        return None
    try:
        r = subprocess.run(['pdfinfo', str(pdf)], check=True, capture_output=True, text=True)
        m = re.search(r'^Pages:\s+(\d+)', r.stdout, re.M)
        return int(m.group(1)) if m else None
    except Exception:
        return None


def chunk_text(text: str, max_chars: int = 12000, overlap: int = 800):
    text = re.sub(r'\n{4,}', '\n\n\n', text).strip()
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + max_chars, n)
        # Try to end on paragraph boundary.
        if end < n:
            cut = text.rfind('\n\n', start, end)
            if cut > start + int(max_chars * 0.55):
                end = cut
        chunk = text[start:end].strip()
        if chunk:
            chunks.append({
                'chunk_index': len(chunks) + 1,
                'start_char': start,
                'end_char': end,
                'char_count': len(chunk),
                'text': chunk,
            })
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


def main():
    if len(sys.argv) != 3:
        print('Usage: extract_pdf_text.py input.pdf output_dir', file=sys.stderr)
        sys.exit(2)
    pdf = Path(sys.argv[1]).resolve()
    out_dir = Path(sys.argv[2]).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    if pdf.suffix.lower() != '.pdf':
        raise ValueError('Input must be a PDF')

    text_path = out_dir / 'extracted_text.txt'
    run_pdftotext(pdf, text_path)
    text = text_path.read_text(errors='replace')
    chunks = chunk_text(text)
    pages = count_pages(pdf)
    metadata = {
        'source_pdf': str(pdf),
        'source_size_bytes': pdf.stat().st_size,
        'page_count': pages,
        'text_char_count': len(text),
        'chunk_count': len(chunks),
        'extract_all_pages': True,
        'status': 'ok' if text.strip() else 'empty_text',
    }
    (out_dir / 'chunks.json').write_text(json.dumps({'chunks': chunks}, indent=2, ensure_ascii=False), encoding='utf-8')
    (out_dir / 'extraction_metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(json.dumps(metadata, indent=2))

if __name__ == '__main__':
    main()
