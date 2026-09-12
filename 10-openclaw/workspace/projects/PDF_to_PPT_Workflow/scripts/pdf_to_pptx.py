#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pdf_to_ppt.ai_planner import DEFAULT_MODEL, create_ai_deck_plan
from pdf_to_ppt.extract_pdf import extract_pdf, save_extract
from pdf_to_ppt.generate_pptx import generate_pptx
from pdf_to_ppt.plan_deck import create_heuristic_deck_plan, save_deck_plan
from pdf_to_ppt.validate import validate_pptx


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert PDF to editable PPTX MVP")
    parser.add_argument("pdf", type=Path, help="Input PDF")
    parser.add_argument("--slides", type=int, default=10, help="Slide count")
    parser.add_argument("--out", type=Path, default=ROOT / "outputs" / "generated_deck.pptx")
    parser.add_argument("--work-dir", type=Path, default=ROOT / "work" / "latest")
    parser.add_argument("--planner", choices=["ai", "fallback"], default="ai", help="Deck planning mode")
    parser.add_argument("--provider", choices=["gemini", "openrouter"], default="gemini", help="AI provider")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model for AI planner")
    parser.add_argument("--no-fallback", action="store_true", help="Fail if AI planner fails instead of using fallback planner")
    parser.add_argument("--template", type=Path, default=None, help="Optional client template config JSON")
    args = parser.parse_args()

    args.work_dir.mkdir(parents=True, exist_ok=True)
    extract_path = args.work_dir / "extract.json"
    plan_path = args.work_dir / "deck_plan.json"
    validation_path = args.work_dir / "validation.json"

    print(f"Extracting PDF: {args.pdf}")
    extract = extract_pdf(args.pdf, args.work_dir)
    save_extract(extract, extract_path)

    print(f"Creating deck plan: {plan_path}")
    planner_used = args.planner
    if args.planner == "ai":
        try:
            plan = create_ai_deck_plan(extract_path, slide_count=args.slides, model=args.model, provider=args.provider)
        except Exception as exc:
            if args.no_fallback:
                raise
            print(f"AI planner failed, using fallback planner: {exc}")
            planner_used = "fallback_after_ai_error"
            plan = create_heuristic_deck_plan(extract_path, slide_count=args.slides)
    else:
        plan = create_heuristic_deck_plan(extract_path, slide_count=args.slides)
    save_deck_plan(plan, plan_path)

    print(f"Generating PPTX: {args.out}")
    pptx = generate_pptx(plan_path, args.out, template_config_path=args.template)

    print("Validating PPTX")
    validation = validate_pptx(pptx, expected_slides=args.slides)
    validation_path.write_text(json.dumps(validation, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps({
        "pptx": str(pptx),
        "extract": str(extract_path),
        "deck_plan": str(plan_path),
        "planner_used": planner_used,
        "validation": validation,
    }, indent=2, ensure_ascii=False))
    if not validation["ok"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
