from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
import pdfplumber


@dataclass
class PageExtract:
    page_number: int
    text: str
    tables: list[list[list[str | None]]]
    preview_image: str | None


@dataclass
class PdfExtract:
    source_pdf: str
    page_count: int
    pages: list[PageExtract]
    full_text: str


def extract_pdf(pdf_path: str | Path, work_dir: str | Path, render_previews: bool = True) -> PdfExtract:
    pdf_path = Path(pdf_path).resolve()
    work_dir = Path(work_dir).resolve()
    preview_dir = work_dir / "page_previews"
    preview_dir.mkdir(parents=True, exist_ok=True)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    pages: list[PageExtract] = []

    with pdfplumber.open(pdf_path) as plumber_pdf:
        for i, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            tables: list[list[list[str | None]]] = []
            if i - 1 < len(plumber_pdf.pages):
                try:
                    tables = plumber_pdf.pages[i - 1].extract_tables() or []
                except Exception:
                    tables = []

            preview_path: str | None = None
            if render_previews:
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                img_path = preview_dir / f"page_{i:03d}.png"
                pix.save(img_path)
                preview_path = str(img_path)

            pages.append(PageExtract(
                page_number=i,
                text=text.strip(),
                tables=tables,
                preview_image=preview_path,
            ))

    full_text = "\n\n".join(f"[Page {p.page_number}]\n{p.text}" for p in pages if p.text)
    return PdfExtract(
        source_pdf=str(pdf_path),
        page_count=len(pages),
        pages=pages,
        full_text=full_text,
    )


def save_extract(extract: PdfExtract, out_path: str | Path) -> None:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    data: dict[str, Any] = asdict(extract)
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
