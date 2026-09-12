from pathlib import Path
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
import json, re

TEMPLATE_DIR=Path('/root/.openclaw/workspace/ppt_library/revised_single_slide_ppts')
LIB_JSON=Path('/root/.openclaw/workspace/ppt_library/ppt_template_library.json')
OUT=Path('/root/.openclaw/workspace/ppt_library/pptx_placeholder_map.json')
EMU=914400

lib=json.loads(LIB_JSON.read_text())
by_slide={t['slide_no']:t for t in lib['templates']}

# Explicit role mapping from previous inspections + design intent.
role_map={
 1:{'text':{2:'heading',3:'supporting_text',4:'section_label'}, 'images':{'hero_image':'largest_picture'}},
 2:{'text':{5:'heading',6:'subheading',7:'timeline_block_1',9:'timeline_block_2',11:'timeline_block_3',13:'timeline_block_4',15:'timeline_block_5',17:'timeline_block_6',19:'closing_line',20:'section_label'}, 'images':{}},
 3:{'text':{4:'heading',5:'subheading',6:'section_label',7:'metric_1_value',8:'metric_1_label',9:'metric_2_value',10:'metric_2_label',11:'metric_3_value',12:'metric_3_label',13:'metric_4_value',14:'metric_4_label',20:'metric_5_value',21:'metric_5_label'}, 'images':{}},
 4:{'text':{6:'heading',7:'subheading',8:'section_label',9:'source',10:'chart_title',12:'key_insight',13:'metric_value',14:'metric_label'}, 'images':{}},
 5:{'text':{4:'heading',5:'body',6:'section_label',7:'metric_1_value',8:'metric_1_label',9:'metric_2_value',10:'metric_2_label',13:'metric_3_value',14:'metric_3_label',16:'source'}, 'images':{}},
 6:{'text':{4:'heading',5:'section_label',6:'body',7:'subheading',8:'benefit_row',9:'closing_line'}, 'images':{}},
 7:{'text':{4:'heading',5:'subheading',6:'section_label',7:'feature_list_left',8:'feature_list_right'}, 'images':{}},
 8:{'text':{5:'heading',4:'body'}, 'images':{}},
 9:{'text':{4:'heading',7:'body'}, 'images':{'main_image':'largest_picture'}},
 10:{'text':{3:'heading',5:'body_left',6:'body_right'}, 'images':{}},
 11:{'text':{2:'heading',5:'body'}, 'images':{'main_image':'largest_picture'}},
 12:{'text':{4:'heading',5:'body'}, 'images':{'main_image':'largest_picture'}},
 13:{'text':{2:'heading',4:'body'}, 'images':{}},
 14:{'text':{3:'heading',4:'subheading'}, 'images':{}},
 15:{'text':{3:'heading',4:'subheading'}, 'images':{}},
 16:{'text':{2:'heading',5:'body'}, 'images':{}},
 17:{'text':{4:'heading',6:'body'}, 'images':{}},
 18:{'text':{}, 'images':{'full_slide_image':'largest_picture'}},
}

def clean_text(shape):
    if not (hasattr(shape,'text_frame') and shape.has_text_frame): return ''
    return '\n'.join(p.text for p in shape.text_frame.paragraphs if p.text.strip()).strip()

def loc(shape):
    return {
        'left_in': round(shape.left/EMU,3),
        'top_in': round(shape.top/EMU,3),
        'width_in': round(shape.width/EMU,3),
        'height_in': round(shape.height/EMU,3),
    }

def is_picture(shape):
    return shape.shape_type == MSO_SHAPE_TYPE.PICTURE

def safe_name(shape):
    try: return shape.name
    except Exception: return ''

def get_template_file(slide_no):
    return next(TEMPLATE_DIR.glob(f'Slide {slide_no:02d} - *.pptx'))

maps=[]
for slide_no in range(1,19):
    meta=by_slide[slide_no]
    pptx=get_template_file(slide_no)
    prs=Presentation(str(pptx))
    slide=prs.slides[0]
    text_shapes=[]; pictures=[]; all_shapes=[]
    for idx,sh in enumerate(slide.shapes):
        entry={'shape_index':idx,'name':safe_name(sh),'shape_type':str(sh.shape_type),'location':loc(sh)}
        txt=clean_text(sh)
        if txt:
            entry['current_text']=txt[:500]
            text_shapes.append(entry.copy())
        if is_picture(sh):
            pictures.append(entry.copy())
        all_shapes.append(entry)
    # largest picture helper
    largest=None
    if pictures:
        largest=max(pictures, key=lambda x:x['location']['width_in']*x['location']['height_in'])
    txt_roles=[]
    for idx,role in role_map.get(slide_no,{}).get('text',{}).items():
        sh=slide.shapes[idx]
        txt_roles.append({
            'role':role,
            'shape_index':idx,
            'shape_name':safe_name(sh),
            'current_text':clean_text(sh),
            'location':loc(sh),
            'replace': True,
            'preserve_formatting': True,
            'notes':'Replace text only; do not move/resize/recolor.'
        })
    img_roles=[]
    for role,selector in role_map.get(slide_no,{}).get('images',{}).items():
        if selector=='largest_picture' and largest:
            img_roles.append({
                'role':role,
                'shape_index':largest['shape_index'],
                'shape_name':largest['name'],
                'location':largest['location'],
                'replace': True,
                'fit':'cover',
                'provider':'replicate_primary_chatgpt_fallback',
                'protected_from_logo_replacement': True,
                'notes':'Replace only this intended image area; do not touch logos/brand assets.'
            })
    maps.append({
        'template_id': meta['template_id'],
        'slide_no': slide_no,
        'template_name': meta['template_name'],
        'category': meta['category'],
        'sub_category': meta['sub_category'],
        'final_template_file_name': meta['assets'].get('final_template_file_name',''),
        'source_local_file': str(pptx),
        'text_placeholders': txt_roles,
        'image_placeholders': img_roles,
        'detected_text_shape_count': len(text_shapes),
        'detected_picture_count': len(pictures),
        'protected_elements_rule':'Do not modify fonts, font colors, logos, icons, brand assets, layout, decorative shapes, or backgrounds.',
        'all_detected_text_shapes': text_shapes,
        'all_detected_picture_shapes': pictures,
    })

out={
    'project':'PDF to PPT Automation',
    'version':'placeholder_map_v1',
    'description':'Shape-level mapping for replacing only approved text and intended image placeholders in PPTX templates.',
    'template_count':len(maps),
    'rules':{
        'preserve_design':True,
        'pptx_only':True,
        'do_not_use_google_slides_for_build':True,
        'replace_text_only_in_existing_shapes':True,
        'replace_only_intended_image_placeholders':True,
        'do_not_touch_brand_assets':True,
        'image_provider_primary':'replicate',
        'image_provider_fallback':'chatgpt_image_model'
    },
    'templates':maps
}
OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(OUT)
print('templates',len(maps))
print('text_placeholders',sum(len(m['text_placeholders']) for m in maps))
print('image_placeholders',sum(len(m['image_placeholders']) for m in maps))
