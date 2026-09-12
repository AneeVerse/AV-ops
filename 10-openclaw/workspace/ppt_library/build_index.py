from pathlib import Path
import zipfile, re, xml.etree.ElementTree as ET, csv, json
from pptx import Presentation

src=Path('/root/.openclaw/media/inbound/Original_ppt---71903097-8662-49d5-8a3a-37b73fc5c624.pptx')
base=Path('/root/.openclaw/workspace/ppt_library')
single_manifest=base/'single_slide_uploads.tsv'
image_manifest=base/'slide_image_uploads.tsv'
out_csv=base/'ppt_template_index.csv'
out_json=base/'slide_analysis.json'

single={}
for line in single_manifest.read_text().splitlines():
    name,id,link=line.split('\t')
    n=int(re.search(r'Slide (\d+)', name).group(1)); single[n]=link
images={}
for line in image_manifest.read_text().splitlines():
    name,id,link=line.split('\t')
    n=int(re.search(r'Slide (\d+)', name).group(1)); images[n]=link

ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
EMU=914400
prs=Presentation(str(src))
W,H=prs.slide_width/EMU, prs.slide_height/EMU

def text_capacity(text_count, shape_count, image_count, total_chars):
    if image_count >= 10 or shape_count >= 12: return 'Low to Medium — complex visual layout'
    if text_count <= 3 and image_count <= 2: return 'Medium — short heading plus body copy'
    if total_chars > 500: return 'High — dense explanatory text supported'
    return 'Medium — concise bullets recommended'

def classify(i, low, image_count, text_count):
    if i==1: return 'Cover / Hero', 'Opening title and value proposition', 'Cover / opening slide', 'Long body copy, dense bullets'
    if 'time line' in low or 'timeline' in low or 'where truckstop is going' in low: return 'Process / Timeline', 'Show roadmap, sequence, direction, or momentum', 'Multi-stage product roadmap', 'Deep paragraph content'
    if 'by the numbers' in low: return 'Data / Stats', 'Show headline company/platform metrics', 'Metric proof slide', 'Narrative-heavy content'
    if 'how they book' in low: return 'Data / Research', 'Explain research insight or chart-based finding', 'Market research insight', 'Non-data storytelling'
    if 'work with more brokers' in low: return 'Data / Stats', 'Show key insight with supporting stat cards', 'Insight plus 3 metrics', 'Too many stats or long bullets'
    if 'one place to run' in low: return 'Platform Overview', 'Explain product/platform in one unified view', 'Product workflow overview', 'Detailed feature inventory'
    if 'available today' in low and i==7: return 'Feature Matrix', 'List existing capabilities and product modules', 'Dense feature inventory', 'Emotional storytelling or visuals only'
    if i in (14,15): return 'Section Divider', 'Separate major deck chapters', 'Chapter/section break', 'Detailed explanation'
    if i in (18,19): return 'Content Slide', 'Explain three supporting points with visual', 'Three-part explanation', 'More than 3 ideas'
    if i==21: return 'Visual Only', 'Use as image-led slide or visual break', 'Screenshot/photo showcase', 'Text-heavy content'
    if i==22: return 'Image Gallery', 'Show multiple visuals together', 'Image collection/showcase', 'Detailed bullets'
    if image_count >= 2 and text_count <= 4: return 'Content + Image', 'Pair short copy with image/visual', 'Visual explanation', 'Long paragraphs'
    return 'Content Slide', 'General-purpose content slide', 'Flexible explanation', 'Overcrowded text'

def rule(layout, total_chars):
    if layout == 'Cover / Hero': return 55, 120, 0, 'Headline + short positioning line'
    if 'Timeline' in layout: return 45, 60, 5, '5 stages, each with short title + bullets'
    if 'Stats' in layout or 'Research' in layout: return 45, 80, 3, 'One insight + 3–5 metric labels'
    if layout == 'Feature Matrix': return 45, 350, 12, 'Grouped feature list; concise labels only'
    if layout == 'Section Divider': return 45, 50, 0, 'Chapter title + one-line context'
    if layout == 'Visual Only': return 0, 0, 0, 'Visual only'
    if layout == 'Image Gallery': return 45, 60, 0, 'Short title + multiple visuals'
    return 45, 180, 5, 'Heading + short bullets/body'

rows=[]; analysis=[]
with zipfile.ZipFile(src) as z:
    slides=sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)], key=lambda x:int(re.search(r'slide(\d+)',x).group(1)))
    for i,s in enumerate(slides,1):
        root=ET.fromstring(z.read(s))
        texts=[]; shape_count=0; text_boxes=[]
        for sp in root.findall('.//p:sp',ns):
            shape_count += 1
            parts=[t.text for t in sp.findall('.//a:t',ns) if t.text]
            txt=' '.join(parts).strip()
            if txt:
                texts.append(txt)
                xfrm=sp.find('.//a:xfrm',ns); loc='unknown'
                if xfrm is not None:
                    off=xfrm.find('a:off',ns); ext=xfrm.find('a:ext',ns)
                    if off is not None and ext is not None:
                        x=int(off.attrib.get('x',0))/EMU; y=int(off.attrib.get('y',0))/EMU; cx=int(ext.attrib.get('cx',0))/EMU; cy=int(ext.attrib.get('cy',0))/EMU
                        loc=f'x={x:.1f}, y={y:.1f}, w={cx:.1f}, h={cy:.1f}'
                text_boxes.append(loc)
        image_count=len(root.findall('.//a:blip',ns))
        meaningful=[t for t in texts if not re.fullmatch(r'\d+|text|test', t.strip(), re.I)]
        title=meaningful[0] if meaningful else 'Untitled / visual-only'
        low=' '.join(texts).lower()
        layout,purpose,best_fit,avoid=classify(i, low, image_count, len(texts))
        max_h,max_body,max_bullets,structure=rule(layout, sum(map(len,texts)))
        cleanup=[]
        if any(re.search(r'\b(text|test)\b', t, re.I) for t in texts): cleanup.append('Replace placeholder text')
        if any(re.search(r'Contemt|Conten\b|secondery|not\s+not|statics', t, re.I) for t in texts): cleanup.append('Fix typo/placeholder title')
        if i==8: cleanup.append('Review duplicate content from slide 5')
        if not texts: cleanup.append('Confirm image-only usage')
        row={
            'Slide No.': i,
            'Template Name': f'Slide {i:02d} - {layout}',
            'Parent Category': 'Pending Task 6',
            'Sub Category': 'Pending Task 6',
            'Layout Type': layout,
            'Purpose': purpose,
            'Best Use Case': best_fit,
            'Heading Area': text_boxes[0] if text_boxes else 'None detected',
            'Body Text Area': '; '.join(text_boxes[1:4]) if len(text_boxes)>1 else 'None/limited',
            'Image/Icon Areas': f'{image_count} image/icon objects detected',
            'Text Capacity': text_capacity(len(texts), shape_count, image_count, sum(map(len,texts))),
            'Max Heading Length': max_h,
            'Max Body Text': max_body,
            'Max Bullet Count': max_bullets,
            'Best Content Structure': structure,
            'Content It Can Handle': best_fit,
            'What To Avoid': avoid,
            'Cleanup Needed': '; '.join(cleanup) if cleanup else 'None',
            'Single-slide PPT Link': single.get(i,''),
            'Preview Image Link': images.get(i,''),
            'Final Template Link': '',
            'Status': 'Analyzed; pending categorization/final cleanup'
        }
        rows.append(row); analysis.append({'slide':i,'texts':texts,'row':row})

headers=list(rows[0].keys())
with out_csv.open('w', newline='', encoding='utf-8') as f:
    w=csv.DictWriter(f, fieldnames=headers); w.writeheader(); w.writerows(rows)
out_json.write_text(json.dumps(analysis, indent=2), encoding='utf-8')
print(out_csv)
print(len(rows), 'rows')
