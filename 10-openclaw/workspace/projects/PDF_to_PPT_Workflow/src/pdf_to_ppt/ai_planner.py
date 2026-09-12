from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from pydantic import ValidationError

from .deck_schema import DeckPlan


DEFAULT_MODEL = "gemini-2.5-flash"
DEFAULT_OPENROUTER_MODEL = "google/gemini-3-flash-preview"


SYSTEM_PROMPT = """You are a senior presentation strategist and business copywriter.
Convert extracted PDF content into a clean, editable presentation plan.
You must create both PPT structure and copy structure.
Return only valid JSON matching the requested schema. No markdown."""


def _load_env() -> None:
    for p in [Path.cwd() / ".env", Path.cwd().parent / ".env", Path("/root/.openclaw/workspace/.env")]:
        if p.exists():
            load_dotenv(p, override=False)


def _trim_text(text: str, max_chars: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    head = text[: int(max_chars * 0.7)]
    tail = text[-int(max_chars * 0.3):]
    return head + "\n\n[...middle truncated...]\n\n" + tail


def _schema_instruction(slide_count: int) -> str:
    return f"""
Return JSON with this exact shape:
{{
  "deck_title": "string",
  "deck_subtitle": "string",
  "audience": "general business audience",
  "tone": "clear, professional, concise",
  "slide_count": {slide_count},
  "slides": [
    {{
      "slide_number": 1,
      "layout": "title|section|content|two_column|quote|data|cta",
      "title": "short slide headline, max 12 words",
      "subtitle": "optional short subheadline",
      "bullets": ["3-5 concise bullets, max 16 words each"],
      "body": "optional paragraph/callout, max 35 words",
      "visual_direction": "specific visual/layout suggestion",
      "speaker_notes": "optional copy/narrative note",
      "source_pages": [1]
    }}
  ]
}}

Rules:
- Create exactly {slide_count} slides.
- Slide 1 must be a title/intro slide.
- Final slide must be summary, recommendation, or CTA.
- Do not dump PDF paragraphs into slides.
- Make the copy presentation-ready.
- Prefer clear business language.
- Keep all text editable; visual_direction is instruction, not image generation.
- Include source page numbers when known.
""".strip()


def build_user_prompt(extract: dict[str, Any], slide_count: int) -> str:
    pages = extract.get("pages", [])
    page_summaries = []
    for p in pages[:80]:
        txt = re.sub(r"\s+", " ", p.get("text") or "").strip()
        if txt:
            page_summaries.append(f"Page {p.get('page_number')}: {txt[:1200]}")
    content = "\n\n".join(page_summaries) or extract.get("full_text", "")
    content = _trim_text(content, 45000)
    return f"""
Task: Turn this extracted PDF content into an editable {slide_count}-slide presentation plan.

Required output: deck plan JSON only.

{_schema_instruction(slide_count)}

Extracted PDF content:
{content}
""".strip()


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def _call_openrouter(system_prompt: str, user_prompt: str, model: str, timeout: int) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not found")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.35,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aneeverse.com",
        "X-Title": "PDF to PPT Workflow",
    }
    r = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    return data["choices"][0]["message"]["content"]


def _call_gemini(system_prompt: str, user_prompt: str, model: str, timeout: int) -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not found")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.35,
            "responseMimeType": "application/json",
        },
    }
    r = requests.post(url, json=payload, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def create_ai_deck_plan(
    extract_json: str | Path,
    slide_count: int = 10,
    model: str = DEFAULT_MODEL,
    provider: str = "gemini",
    timeout: int = 120,
) -> DeckPlan:
    _load_env()
    extract = json.loads(Path(extract_json).read_text(encoding="utf-8"))
    user_prompt = build_user_prompt(extract, slide_count)

    if provider == "gemini":
        content = _call_gemini(SYSTEM_PROMPT, user_prompt, model, timeout)
    elif provider == "openrouter":
        content = _call_openrouter(SYSTEM_PROMPT, user_prompt, model, timeout)
    else:
        raise ValueError("provider must be 'gemini' or 'openrouter'")
    raw = _extract_json(content)

    try:
        plan = DeckPlan.model_validate(raw)
    except ValidationError as exc:
        raise RuntimeError(f"AI returned invalid deck plan: {exc}\nRaw: {json.dumps(raw)[:2000]}") from exc

    if len(plan.slides) != slide_count:
        raise RuntimeError(f"AI returned {len(plan.slides)} slides, expected {slide_count}")
    return plan
