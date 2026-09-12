#!/usr/bin/env python3
"""Create a deterministic slide plan/build payload from extracted PDF text.

This is the local backend skeleton. Later n8n will replace the simple heuristic
planner with AI nodes, but this script defines the JSON contract and proves the
pipeline can reach the PPTX builder.
"""
from __future__ import annotations
from pathlib import Path
import json, sys, re

BASE = Path('/root/.openclaw/workspace/ppt_pipeline')
TEMPLATE_JSON = BASE / 'schemas/ppt_template_library.json'

# Stable 10-slide default structure. Reuses templates intentionally.
DEFAULT_TEMPLATE_SEQUENCE = [
    'slide_01_hero_cover',
    'slide_14_section_divider_pattern',
    'slide_08_text_heavy_insight',
    'slide_10_main_supporting_text',
    'slide_12_content_image',
    'slide_03_metric_overview',
    'slide_08_text_heavy_insight',
    'slide_10_main_supporting_text',
    'slide_18_image_only_slide',
    'slide_15_section_divider_diagonal',
]


def sentences(text: str):
    text = re.sub(r'\s+', ' ', text).strip()
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if len(p.strip()) > 40]


def trim(s: str, n: int):
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= n else s[: max(0, n - 1)].rstrip() + '…'


def make_payload(text_path: Path, output_path: Path, run_id='local_pipeline_test_001', target_slide_count=10):
    library = json.loads(TEMPLATE_JSON.read_text())
    by_id = {t['template_id']: t for t in library['templates']}
    text = text_path.read_text(errors='replace')
    sents = sentences(text)
    if not sents:
        sents = ['The source document was processed successfully, but limited readable text was available for generation.']
    title = trim(sents[0].replace('\n', ' '), 48)
    topic_a = trim(' '.join(sents[1:3]) if len(sents) > 2 else sents[0], 420)
    topic_b = trim(' '.join(sents[3:5]) if len(sents) > 4 else topic_a, 420)
    topic_c = trim(' '.join(sents[5:7]) if len(sents) > 6 else topic_b, 420)

    slides = [
        {
            'order': 1,
            'template_id': 'slide_01_hero_cover',
            'text': {
                'heading': title,
                'supporting_text': trim(topic_a, 130),
                'section_label': 'GENERATED FROM PDF'
            },
            'images': {'hero_image': {'path': '/root/.openclaw/workspace/ppt_library/test_images/hero.png'}}
        },
        {
            'order': 2,
            'template_id': 'slide_14_section_divider_pattern',
            'text': {'heading': 'Key Findings', 'subheading': 'A concise overview generated from the source PDF.'}
        },
        {
            'order': 3,
            'template_id': 'slide_08_text_heavy_insight',
            'text': {'heading': 'Main Insight', 'body': topic_a}
        },
        {
            'order': 4,
            'template_id': 'slide_10_main_supporting_text',
            'text': {
                'heading': 'What This Means',
                'body_left': trim(topic_b, 220),
                'body_right': trim(topic_c, 220)
            }
        },
        {
            'order': 5,
            'template_id': 'slide_12_content_image',
            'text': {'heading': 'Supporting Context', 'body': trim(topic_b, 280)}
            # no image passed: current brand-protected map ignores non-explicit image roles
        },
        {
            'order': 6,
            'template_id': 'slide_03_metric_overview',
            'text': {
                'heading': 'Document Snapshot',
                'subheading': 'Basic extraction and planning signals from the uploaded PDF.',
                'section_label': 'CONTENT SUMMARY',
                'metric_1_value': str(len(text)),
                'metric_1_label': 'Extracted characters',
                'metric_2_value': str(len(sents)),
                'metric_2_label': 'Usable statements',
                'metric_3_value': str(target_slide_count),
                'metric_3_label': 'Target slides',
                'metric_4_value': 'PPTX',
                'metric_4_label': 'Output format',
                'metric_5_value': 'AI',
                'metric_5_label': 'Next rewrite stage'
            }
        },
        {'order': 7, 'template_id': 'slide_08_text_heavy_insight', 'text': {'heading': 'Additional Detail', 'body': topic_c}},
        {'order': 8, 'template_id': 'slide_10_main_supporting_text', 'text': {'heading': 'Recommended Direction', 'body_left': trim(topic_a, 220), 'body_right': trim(topic_b, 220)}},
        {'order': 9, 'template_id': 'slide_18_image_only_slide', 'text': {}},
        {'order': 10, 'template_id': 'slide_15_section_divider_diagonal', 'text': {'heading': 'Next Steps', 'subheading': 'Review, refine, and finalize the generated presentation.'}},
    ]
    # Remove image-only slide if no image is available in current skeleton? Keep as template test.
    payload = {
        'run_id': run_id,
        'project_name': 'Local PDF to PPT Pipeline Test',
        'output_file_name': 'local_pipeline_output.pptx',
        'target_slide_count': target_slide_count,
        'actual_slide_count': len(slides),
        'planner_mode': 'heuristic_skeleton_ai_to_replace',
        'slides': slides,
    }
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
    return payload


def main():
    if len(sys.argv) != 3:
        print('Usage: generate_slide_plan.py extracted_text.txt build_payload.json', file=sys.stderr)
        sys.exit(2)
    payload = make_payload(Path(sys.argv[1]), Path(sys.argv[2]))
    print(json.dumps({'status': 'ok', 'slides': len(payload['slides']), 'output': sys.argv[2]}, indent=2))

if __name__ == '__main__':
    main()
