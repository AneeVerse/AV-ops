from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SlidePlan(BaseModel):
    slide_number: int
    layout: Literal["title", "section", "content", "two_column", "quote", "data", "cta"] = "content"
    title: str
    subtitle: str = ""
    bullets: list[str] = Field(default_factory=list)
    body: str = ""
    visual_direction: str = ""
    speaker_notes: str = ""
    source_pages: list[int] = Field(default_factory=list)


class DeckPlan(BaseModel):
    deck_title: str
    deck_subtitle: str = ""
    audience: str = "general business audience"
    tone: str = "clear, professional, concise"
    slide_count: int
    slides: list[SlidePlan]
