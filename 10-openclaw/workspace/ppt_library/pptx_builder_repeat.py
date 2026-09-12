#!/usr/bin/env python3
"""PPTX builder with repeated-template support.

Uses the revised source deck as template bank. It creates a final deck by
cloning requested source slides in payload order, then replacing approved text
and image placeholders only.
"""
from pathlib import Path
import copy, json, os, sys
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

from zipfile import ZipFile, ZIP_DEFLATED


def dedupe_pptx_zip(path):
    """Rewrite pptx archive with one entry per name to avoid duplicate zip members."""
    path = Path(path)
    tmp = path.with_suffix(path.suffix + '.dedupe')
    with ZipFile(path, 'r') as zin:
        infos = zin.infolist()
        latest = {}
        for info in infos:
            latest[info.filename] = info
        with ZipFile(tmp, 'w', ZIP_DEFLATED) as zout:
            for name, info in latest.items():
                data = zin.read(info.filename)
                zout.writestr(info, data)
    tmp.replace(path)

WORKSPACE = Path(os.getenv('PPT_WORKSPACE', '/root/.openclaw/workspace'))
BASE = Path(os.getenv('PPT_LIBRARY_BASE', str(WORKSPACE / 'ppt_library')))
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
    if picture_shape.shape_type != MSO_SHAPE_TYPE.PICTURE:
        raise ValueError('shape is not a picture')
    blip = picture_shape._element.blipFill.blip
    r_embed = getattr(blip, 'rEmbed', None) or blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
    if not r_embed:
        raise ValueError('picture shape has no embedded image relationship')
    image_part = picture_shape.part.related_part(r_embed)
    image_part._blob = Path(image_path).read_bytes()


def clone_slide(prs, source_slide):
    """Clone source_slide into prs, preserving shapes and relationships."""
    blank_layout = prs.slide_layouts[6]
    dest = prs.slides.add_slide(blank_layout)

    # Remove default shapes from blank slide if any.
    for shp in list(dest.shapes):
        dest.shapes._spTree.remove(shp._element)

    # Copy slide background where present, then copy shapes in exact order.
    # Avoid replacing the whole slide XML because that breaks python-pptx's
    # cached shape tree. Copying shape elements preserves shape indexes.
    try:
        src_bg = source_slide._element.cSld.bg
        if src_bg is not None:
            dest._element.cSld.insert(0, copy.deepcopy(src_bg))
    except Exception:
        pass

    for shape in source_slide.shapes:
        dest.shapes._spTree.insert_element_before(copy.deepcopy(shape._element), 'p:extLst')

    # Copy relationships used by copied XML. python-pptx may assign new rIds,
    # so update copied XML references from old rId -> new rId.
    ns_r = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
    rid_map = {}
    for rId, rel in source_slide.part.rels.items():
        if 'notesSlide' in rel.reltype:
            continue
        if rel.is_external:
            new_rid = dest.part.relate_to(rel.target_ref, rel.reltype, is_external=True)
        else:
            new_rid = dest.part.relate_to(rel._target, rel.reltype)
        rid_map[rId] = new_rid
    for elem in dest._element.iter():
        for attr, val in list(elem.attrib.items()):
            if attr.startswith(ns_r) and val in rid_map:
                elem.attrib[attr] = rid_map[val]
    return dest


def remove_all_slides(prs):
    sldIdLst = prs.slides._sldIdLst
    for sldId in list(sldIdLst):
        prs.part.drop_rel(sldId.rId)
        sldIdLst.remove(sldId)


def build(payload_path, output_path):
    payload = json.loads(Path(payload_path).read_text())
    placeholder_map = json.loads(MAP.read_text())
    by_template = {t['template_id']: t for t in placeholder_map['templates']}

    source_prs = Presentation(str(SOURCE))
    out_prs = Presentation(str(SOURCE))
    remove_all_slides(out_prs)

    ordered_items = sorted(payload['slides'], key=lambda x: x['order'])
    replacements = {'text': 0, 'images': 0}
    selected_source_slides = []
    warnings = []

    for item in ordered_items:
        template_id = item['template_id']
        if template_id not in by_template:
            raise ValueError(f'Missing template_id in placeholder map: {template_id}')
        spec = by_template[template_id]
        slide_no = spec['slide_no']
        selected_source_slides.append(slide_no)
        slide = clone_slide(out_prs, source_prs.slides[slide_no - 1])

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
        allowed_image_roles = {ph['role'] for ph in spec.get('image_placeholders', [])}
        unexpected = set(supplied_images.keys()) - allowed_image_roles
        if unexpected:
            warnings.append(
                f"Slide {slide_no} ignored unmapped/protected image roles: {sorted(unexpected)}"
            )
        for ph in spec.get('image_placeholders', []):
            role = ph['role']
            img = supplied_images.get(role)
            if not img:
                continue
            if not ph.get('replace', False):
                warnings.append(f"Slide {slide_no} image role {role} is protected; skipped")
                continue
            image_path = img.get('path') if isinstance(img, dict) else str(img)
            if not image_path or not Path(image_path).exists():
                raise ValueError(f'Slide {slide_no} image for {role} missing: {image_path}')
            shape = slide.shapes[ph['shape_index']]
            replace_picture_blob(shape, image_path)
            replacements['images'] += 1

    out_prs.save(str(output_path))
    dedupe_pptx_zip(output_path)
    return {
        'success': True,
        'run_id': payload.get('run_id'),
        'output_pptx_path': str(output_path),
        'slide_count': len(ordered_items),
        'selected_source_slides': selected_source_slides,
        'replacements': replacements,
        'warnings': warnings,
        'errors': []
    }


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: pptx_builder_repeat.py payload.json output.pptx', file=sys.stderr)
        sys.exit(2)
    try:
        print(json.dumps(build(sys.argv[1], sys.argv[2]), indent=2))
    except Exception as e:
        print(json.dumps({'success': False, 'errors': [str(e)]}, indent=2), file=sys.stderr)
        sys.exit(1)
