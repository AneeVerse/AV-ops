from __future__ import annotations

import json
import re
from pathlib import Path

from .deck_schema import DeckPlan, SlidePlan


def _sentences(text: str) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    return [p.strip() for p in parts if len(p.strip()) > 20]


def _strip_page_markers(text: str) -> str:
    return re.sub(r"\[Page\s+\d+\]", " ", text)


def _title_from_text(text: str, fallback: str = "PDF Summary") -> str:
    text = _strip_page_markers(text)
    lines = [re.sub(r"\s+", " ", x).strip() for x in text.splitlines() if x.strip()]
    for line in lines[:20]:
        if 8 <= len(line) <= 90:
            return line.rstrip(".:;-")
    return fallback


def create_heuristic_deck_plan(extract_json: str | Path, slide_count: int = 10) -> DeckPlan:
    """Create a deterministic fallback deck plan without an AI API.

    This is useful for MVP testing. Later, n8n/AI will replace this planner with
    a stronger JSON-generating model step.
    """
    data = json.loads(Path(extract_json).read_text(encoding="utf-8"))
    full_text = _strip_page_markers(data.get("full_text", ""))
    title = _title_from_text(full_text)
    sentences = _sentences(full_text)
    if not sentences:
        sentences = ["No extractable text was found in the PDF. OCR may be required."]

    slides: list[SlidePlan] = []
    slides.append(SlidePlan(
        slide_number=1,
        layout="title",
        title=title[:80],
        subtitle="Editable presentation generated from the supplied PDF",
        visual_direction="Clean title slide with subtle document-inspired background.",
        source_pages=[1],
    ))

    content_slots = max(1, slide_count - 2)
    chunk_size = max(1, len(sentences) // content_slots)
    cursor = 0
    for n in range(2, slide_count):
        chunk = sentences[cursor: cursor + chunk_size]
        cursor += chunk_size
        if not chunk:
            chunk = sentences[-3:]
        slide_title = chunk[0][:74].rstrip(".,;:")
        bullets = [s[:150].rstrip(".,;:") for s in chunk[1:4]]
        if not bullets:
            bullets = [chunk[0][:150].rstrip(".,;:")]
        slides.append(SlidePlan(
            slide_number=n,
            layout="content" if n % 3 else "two_column",
            title=slide_title,
            bullets=bullets,
            visual_direction="Use simple icon/card layout; keep text editable.",
            source_pages=[],
        ))

    slides.append(SlidePlan(
        slide_number=slide_count,
        layout="cta",
        title="Key Takeaways",
        bullets=[s[:150].rstrip(".,;:") for s in sentences[-3:]],
        body="Use this slide as the closing summary or next-step recommendation.",
        visual_direction="Strong closing slide with 3 concise takeaway cards.",
    ))

    return DeckPlan(
        deck_title=title[:100],
        slide_count=slide_count,
        slides=slides[:slide_count],
    )


def save_deck_plan(plan: DeckPlan, out_path: str | Path) -> None:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(plan.model_dump_json(indent=2) + "\n", encoding="utf-8")
