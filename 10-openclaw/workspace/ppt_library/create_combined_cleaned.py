from pathlib import Path
from pptx import Presentation

src = Path('/root/.openclaw/media/inbound/Original_ppt---71903097-8662-49d5-8a3a-37b73fc5c624.pptx')
out = Path('/root/.openclaw/workspace/ppt_library/Combined Cleaned PPT Template Review.pptx')
prs = Presentation(str(src))

# Clean slide 8-20 placeholders/typos inside the full 22-slide deck.
replacements_by_slide = {
    8: {
        '2025 data shows carriers are onboarded to far more brokers than they actively haul for. Being onboarded is not the same as being chosen. Carriers are registered with far more brokers than they actively work with Only 43% of onboarded brokers receive a load in any given month Carriers are expanding their broker network to diversify load access': 'Use this slide for one clear text-led insight. Keep the message focused, concise, and easy to scan.',
        "What's Available Today.": 'Text Insight Slide',
    },
    9: {"What's Available Today.": 'UI / Product Showcase', 'text': 'Add a short explanation for the product screenshot, dashboard, or workflow shown here.'},
    10: {'Conten  +  secondery  text': 'Main + Supporting Text', 'Conten + secondery text': 'Main + Supporting Text', 'Conten + secondery': 'Main + Supporting Text', 'text': 'Add supporting copy here.'},
    11: {'Content + image': 'Content + Image Basic', 'text': 'Add short supporting copy here.'},
    12: {'Content + image': 'Content + Image', 'text': 'Add short supporting copy here.'},
    13: {'Content': 'Standard Content', 'text': 'Add body content here.'},
    14: {'Chapter slide = not  not': 'Section Divider', 'text': 'Add section subtitle here.'},
    15: {'chapter slide = not now': 'Section Divider', 'text': 'Add section subtitle here.'},
    16: {'Contemt  slide': 'General Content Variant A', 'Contemt slide': 'General Content Variant A', 'text': 'Add body content here.'},
    17: {'Contemt slide': 'Content with Sidebar', 'text': 'Add body content here.'},
    18: {'Contemt  slide with 3 sub content + image': 'Image + Three Key Points', 'Contemt slide with 3 sub content + image': 'Image + Three Key Points', 'text': 'Add supporting context here.', 'Test': 'Key point'},
    19: {'Contemt  slide with 3 sub content + image': 'Three-Point Content Variant', 'Contemt slide with 3 sub content + image': 'Three-Point Content Variant', 'text': 'Add key point here.'},
    20: {'Blank content slide': 'Blank Flexible Content', 'text': 'Add custom content here.', 'test': 'Optional supporting note.'},
}

# More direct full-shape fixes where spacing differs after pptx parsing.
direct_bad = {
    10: [('Conten', 'Main + Supporting Text'), ('secondery', 'Main + Supporting Text')],
    14: [('Chapter slide', 'Section Divider'), ('not  not', 'Section Divider')],
    16: [('Contemt', 'General Content Variant A')],
    18: [('Contemt', 'Image + Three Key Points')],
    19: [('Contemt', 'Three-Point Content Variant')],
}

def all_shapes(shape_collection):
    for shape in shape_collection:
        yield shape
        if getattr(shape, 'shape_type', None) == 6:  # group
            yield from all_shapes(shape.shapes)

def set_text(shape, text):
    tf = shape.text_frame
    for i, p in enumerate(tf.paragraphs):
        if i == 0:
            p.text = text
        else:
            p.text = ''

def replace_shape_text(shape, repl, direct=None):
    if not (hasattr(shape, 'text_frame') and shape.has_text_frame):
        return
    txt = '\n'.join(p.text for p in shape.text_frame.paragraphs).strip()
    if not txt:
        return
    new = txt
    for old, val in repl.items():
        if old in new:
            new = new.replace(old, val)
    if new != txt:
        set_text(shape, new)
        return
    if direct:
        for needle, replacement in direct:
            if needle in txt:
                set_text(shape, replacement)
                return

for slide_no, slide in enumerate(prs.slides, start=1):
    repl = replacements_by_slide.get(slide_no)
    if not repl:
        continue
    for shape in all_shapes(slide.shapes):
        replace_shape_text(shape, repl, direct_bad.get(slide_no))

prs.save(out)
print(out)
