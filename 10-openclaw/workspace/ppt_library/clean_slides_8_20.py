from pathlib import Path
from pptx import Presentation
import re, shutil

src_dir = Path('/root/.openclaw/workspace/ppt_library/single_slide_ppts')
out_dir = Path('/root/.openclaw/workspace/ppt_library/final_templates')
out_dir.mkdir(parents=True, exist_ok=True)

mapping = {
8: {
    'name': 'Slide 08 - Title + Bullets Text Insight.pptx',
    'replacements': {
        '2025 data shows carriers are onboarded to far more brokers than they actively haul for. Being onboarded is not the same as being chosen. Carriers are registered with far more brokers than they actively work with Only 43% of onboarded brokers receive a load in any given month Carriers are expanding their broker network to diversify load access': 'Use this slide for one clear text-led insight. Keep the message focused, concise, and easy to scan.',
        "What's Available Today.": 'Text Insight Slide',
    }
},
9: {
    'name': 'Slide 09 - Laptop Mockup UI Showcase.pptx',
    'replacements': {
        "What's Available Today.": 'UI / Product Showcase',
        'text': 'Add a short explanation for the product screenshot, dashboard, or workflow shown here.',
    }
},
10: {
    'name': 'Slide 10 - Main + Supporting Text.pptx',
    'replacements': {
        'Conten  +  secondery  text': 'Main + Supporting Text',
        'text': 'Add supporting copy here.',
    }
},
11: {
    'name': 'Slide 11 - Content + Image Basic.pptx',
    'replacements': {
        'Content + image': 'Content + Image Basic',
        'text': 'Add short supporting copy here.',
    }
},
12: {
    'name': 'Slide 12 - Content + Image.pptx',
    'replacements': {
        'Content + image': 'Content + Image',
        'text': 'Add short supporting copy here.',
    }
},
13: {
    'name': 'Slide 13 - Standard Content.pptx',
    'replacements': {
        'Content': 'Standard Content',
        'text': 'Add body content here.',
    }
},
14: {
    'name': 'Slide 14 - Section Divider Pattern.pptx',
    'replacements': {
        'Chapter slide = not  not': 'Section Divider',
        'text': 'Add section subtitle here.',
    }
},
15: {
    'name': 'Slide 15 - Section Divider Diagonal.pptx',
    'replacements': {
        'chapter slide = not now': 'Section Divider',
        'text': 'Add section subtitle here.',
    }
},
16: {
    'name': 'Slide 16 - General Content Variant A.pptx',
    'replacements': {
        'Contemt  slide': 'General Content Variant A',
        'text': 'Add body content here.',
    }
},
17: {
    'name': 'Slide 17 - Content with Sidebar.pptx',
    'replacements': {
        'Contemt slide': 'Content with Sidebar',
        'text': 'Add body content here.',
    }
},
18: {
    'name': 'Slide 18 - Image + Three Key Points.pptx',
    'replacements': {
        'Contemt  slide with 3 sub content + image': 'Image + Three Key Points',
        'text': 'Add supporting context here.',
        'Test': 'Key point',
    }
},
19: {
    'name': 'Slide 19 - Three-Point Content Variant.pptx',
    'replacements': {
        'Contemt  slide with 3 sub content + image': 'Three-Point Content Variant',
        'text': 'Add key point here.',
    }
},
20: {
    'name': 'Slide 20 - Blank Flexible Content.pptx',
    'replacements': {
        'Blank content slide': 'Blank Flexible Content',
        'text': 'Add custom content here.',
        'test': 'Optional supporting note.',
    }
},
}

def replace_text_frame(tf, repl):
    full = '\n'.join(p.text for p in tf.paragraphs)
    if not full:
        return
    new = full
    # exact replacements first; case-sensitive for title issues
    for old, val in repl.items():
        if old in new:
            new = new.replace(old, val)
    if new != full:
        # put whole updated text into first paragraph/run, clear others
        for pi, p in enumerate(tf.paragraphs):
            if pi == 0:
                if p.runs:
                    p.runs[0].text = new
                    for r in p.runs[1:]: r.text = ''
                else:
                    p.text = new
            else:
                p.text = ''

def clean_file(n):
    src = next(src_dir.glob(f'Slide {n:02d} - *.pptx'))
    prs = Presentation(str(src))
    repl = mapping[n]['replacements']
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, 'text_frame') and shape.has_text_frame:
                replace_text_frame(shape.text_frame, repl)
            if shape.shape_type == 6:  # group
                for sub in shape.shapes:
                    if hasattr(sub, 'text_frame') and sub.has_text_frame:
                        replace_text_frame(sub.text_frame, repl)
    out = out_dir / mapping[n]['name']
    prs.save(out)
    return out

created=[]
for n in range(8,21):
    created.append(clean_file(n))

print('\n'.join(str(p) for p in created))
