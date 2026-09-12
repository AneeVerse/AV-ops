#!/usr/bin/env python3
"""PPTX builder MVP: text-only replacement using approved placeholder map.

MVP limitation: uses the revised source deck and keeps selected slides from it.
It preserves existing slide design and replaces text only inside mapped shapes.
"""
from pathlib import Path
import json, sys
from pptx import Presentation

BASE = Path('/root/.openclaw/workspace/ppt_library')
SOURCE = BASE / 'Original-2_Revised_Text_Only.pptx'
MAP = BASE / 'pptx_placeholder_map.json'


def set_text_preserve(shape, text):
    """Replace text while preserving the first run/paragraph formatting."""
    tf = shape.text_frame
    lines = str(text).split('\n')
    existing = list(tf.paragraphs)
    if not existing:
        return
    for i, line in enumerate(lines):
        p = existing[i] if i < len(existing) else tf.add_paragraph()
        if p.runs:
            p.runs[0].text = line
            for r in p.runs[1:]:
                r.text = ''
        else:
            p.text = line
    for p in existing[len(lines):]:
        if p.runs:
            for r in p.runs:
                r.text = ''
        else:
            p.text = ''


def delete_unselected_slides(prs, keep_slide_numbers):
    keep_indexes = {n - 1 for n in keep_slide_numbers}
    sldIdLst = prs.slides._sldIdLst
    slides = list(sldIdLst)
    for idx in reversed(range(len(slides))):
        if idx not in keep_indexes:
            rId = slides[idx].rId
            prs.part.drop_rel(rId)
            sldIdLst.remove(slides[idx])


def build(payload_path, output_path):
    payload = json.loads(Path(payload_path).read_text())
    placeholder_map = json.loads(MAP.read_text())
    by_template = {t['template_id']: t for t in placeholder_map['templates']}

    prs = Presentation(str(SOURCE))
    selected_slide_numbers = []
    warnings = []

    # Replace text in original source slide positions first.
    for item in sorted(payload['slides'], key=lambda x: x['order']):
        template_id = item['template_id']
        if template_id not in by_template:
            raise ValueError(f'Missing template_id in placeholder map: {template_id}')
        spec = by_template[template_id]
        slide_no = spec['slide_no']
        selected_slide_numbers.append(slide_no)
        slide = prs.slides[slide_no - 1]
        supplied_text = item.get('text', {})
        for ph in spec.get('text_placeholders', []):
            role = ph['role']
            if role not in supplied_text:
                continue
            shape_index = ph['shape_index']
            try:
                shape = slide.shapes[shape_index]
            except IndexError:
                raise ValueError(f'Slide {slide_no} missing shape index {shape_index} for role {role}')
            if not (hasattr(shape, 'text_frame') and shape.has_text_frame):
                raise ValueError(f'Slide {slide_no} shape {shape_index} for {role} is not text')
            set_text_preserve(shape, supplied_text[role])

    # MVP supports source-order selected slides. Later builder will support arbitrary composition.
    if selected_slide_numbers != sorted(selected_slide_numbers):
        warnings.append('MVP kept source slide order; arbitrary order requires phase 2 composer.')
        selected_slide_numbers = sorted(selected_slide_numbers)

    delete_unselected_slides(prs, selected_slide_numbers)
    prs.save(str(output_path))

    return {
        'success': True,
        'run_id': payload.get('run_id'),
        'output_pptx_path': str(output_path),
        'slide_count': len(selected_slide_numbers),
        'selected_source_slides': selected_slide_numbers,
        'warnings': warnings,
        'errors': []
    }


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: pptx_builder_mvp.py payload.json output.pptx', file=sys.stderr)
        sys.exit(2)
    result = build(sys.argv[1], sys.argv[2])
    print(json.dumps(result, indent=2))
