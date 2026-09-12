from __future__ import annotations

from pathlib import Path

from pptx import Presentation


def validate_pptx(path: str | Path, expected_slides: int = 10) -> dict:
    path = Path(path)
    if not path.exists():
        return {"ok": False, "error": f"File not found: {path}"}
    prs = Presentation(path)
    slide_count = len(prs.slides)
    titles = []
    for slide in prs.slides:
        slide_text = []
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                txt = shape.text.strip()
                if txt:
                    slide_text.append(txt)
        titles.append(slide_text[0] if slide_text else "")
    issues = []
    if slide_count != expected_slides:
        issues.append(f"Expected {expected_slides} slides, found {slide_count}")
    empty = [i + 1 for i, t in enumerate(titles) if not t]
    if empty:
        issues.append(f"Slides with no text: {empty}")
    return {
        "ok": not issues,
        "slide_count": slide_count,
        "titles": titles,
        "issues": issues,
    }
