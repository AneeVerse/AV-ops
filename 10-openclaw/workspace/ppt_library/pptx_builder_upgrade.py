#!/usr/bin/env python3
"""PPTX builder upgrade: text + image replacement, supports arbitrary order via slide reordering.

Approach:
- Uses the revised 18-slide source deck as template bank.
- Replaces text only in mapped shapes.
- Replaces intended picture placeholders only.
- Deletes unselected slides.
- Reorders selected slides by payload order using the slide id list.

Known limitation:
- Does not yet duplicate/reuse the same template multiple times in one output. It detects and errors.
"""
from pathlib import Path
import json, sys, shutil
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

BASE = Path('/root/.openclaw/workspace/ppt_library')
SOURCE = BASE / 'Original-2_Revised_Text_Only.pptx'
MAP = BASE / 'pptx_placeholder_map.json'


def set_text_preserve(shape, text):
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


def replace_picture_blob(picture_shape, image_path):
    """Replace a picture's image blob while preserving shape position/size/cropping."""
    if picture_shape.shape_type != MSO_SHAPE_TYPE.PICTURE:
        raise ValueError('shape is not a picture')
    blip = picture_shape._element.blipFill.blip
    r_embed = getattr(blip, 'rEmbed', None) or blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
    if not r_embed:
        raise ValueError('picture shape has no embedded image relationship')
    image_part = picture_shape.part.related_part(r_embed)
    image_part._blob = Path(image_path).read_bytes()


def reorder_and_delete_slides(prs, ordered_source_slide_numbers):
    """Keep selected source slides and order them according to requested order."""
    # python-pptx slides are controlled by presentation.xml sldIdLst.
    sldIdLst = prs.slides._sldIdLst
    original_sldIds = list(sldIdLst)
    selected_indexes = [n - 1 for n in ordered_source_slide_numbers]
    selected_set = set(selected_indexes)

    # remove unselected rels/list entries
    for idx in reversed(range(len(original_sldIds))):
        if idx not in selected_set:
            rId = original_sldIds[idx].rId
            prs.part.drop_rel(rId)
            sldIdLst.remove(original_sldIds[idx])

    # reorder remaining entries
    remaining_by_original_idx = {idx: original_sldIds[idx] for idx in selected_indexes}
    for child in list(sldIdLst):
        sldIdLst.remove(child)
    for idx in selected_indexes:
        sldIdLst.append(remaining_by_original_idx[idx])


def build(payload_path, output_path):
    payload = json.loads(Path(payload_path).read_text())
    placeholder_map = json.loads(MAP.read_text())
    by_template = {t['template_id']: t for t in placeholder_map['templates']}

    ordered_items = sorted(payload['slides'], key=lambda x: x['order'])
    template_ids = [x['template_id'] for x in ordered_items]
    if len(set(template_ids)) != len(template_ids):
        dupes = sorted({x for x in template_ids if template_ids.count(x) > 1})
        raise ValueError(f'MVP does not yet support repeated templates: {dupes}')

    prs = Presentation(str(SOURCE))
    ordered_source_slide_numbers = []
    warnings = []
    replacements = {'text': 0, 'images': 0}

    for item in ordered_items:
        template_id = item['template_id']
        if template_id not in by_template:
            raise ValueError(f'Missing template_id in placeholder map: {template_id}')
        spec = by_template[template_id]
        slide_no = spec['slide_no']
        ordered_source_slide_numbers.append(slide_no)
        slide = prs.slides[slide_no - 1]

        supplied_text = item.get('text', {})
        for ph in spec.get('text_placeholders', []):
            role = ph['role']
            if role not in supplied_text:
                continue
            shape = slide.shapes[ph['shape_index']]
            if not (hasattr(shape, 'text_frame') and shape.has_text_frame):
                raise ValueError(f'Slide {slide_no} shape {ph["shape_index"]} for {role} is not text')
            set_text_preserve(shape, supplied_text[role])
            replacements['text'] += 1

        supplied_images = item.get('images', {})
        for ph in spec.get('image_placeholders', []):
            role = ph['role']
            img = supplied_images.get(role)
            if not img:
                continue
            image_path = img.get('path') if isinstance(img, dict) else str(img)
            if not image_path or not Path(image_path).exists():
                raise ValueError(f'Slide {slide_no} image for {role} missing: {image_path}')
            shape = slide.shapes[ph['shape_index']]
            replace_picture_blob(shape, image_path)
            replacements['images'] += 1

    reorder_and_delete_slides(prs, ordered_source_slide_numbers)
    prs.save(str(output_path))

    return {
        'success': True,
        'run_id': payload.get('run_id'),
        'output_pptx_path': str(output_path),
        'slide_count': len(ordered_items),
        'selected_source_slides': ordered_source_slide_numbers,
        'replacements': replacements,
        'warnings': warnings,
        'errors': []
    }


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: pptx_builder_upgrade.py payload.json output.pptx', file=sys.stderr)
        sys.exit(2)
    try:
        result = build(sys.argv[1], sys.argv[2])
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({'success': False, 'errors': [str(e)]}, indent=2), file=sys.stderr)
        sys.exit(1)
