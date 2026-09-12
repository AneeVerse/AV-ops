from pathlib import Path
from pptx import Presentation

dir=Path('/root/.openclaw/workspace/ppt_library/final_templates')
fixes={
 'Slide 10 - Main + Supporting Text.pptx': [('Conten', 'Main + Supporting Text'), ('secondery', 'Main + Supporting Text')],
 'Slide 14 - Section Divider Pattern.pptx': [('Chapter slide', 'Section Divider'), ('not  not', 'Section Divider')],
 'Slide 16 - General Content Variant A.pptx': [('Contemt', 'General Content Variant A')],
 'Slide 18 - Image + Three Key Points.pptx': [('Contemt', 'Image + Three Key Points')],
 'Slide 19 - Three-Point Content Variant.pptx': [('Contemt', 'Three-Point Content Variant')],
}

def set_shape_text(shape, text):
    tf=shape.text_frame
    for i,p in enumerate(tf.paragraphs):
        if i==0:
            p.text=text
        else:
            p.text=''

for fname, rules in fixes.items():
    p=dir/fname
    prs=Presentation(str(p))
    for slide in prs.slides:
        for shape in slide.shapes:
            shapes = list(shape.shapes) if getattr(shape, 'shape_type', None) == 6 else [shape]
            for sh in shapes:
                if hasattr(sh,'text_frame') and sh.has_text_frame:
                    txt=' '.join(par.text for par in sh.text_frame.paragraphs).strip()
                    for needle, replacement in rules:
                        if needle in txt:
                            set_shape_text(sh, replacement)
                            break
    prs.save(str(p))
print('fixed')
