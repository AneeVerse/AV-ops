from pathlib import Path
from pptx import Presentation
import csv, json, re

src=Path('/root/.openclaw/workspace/ppt_library/Original-2_Revised_Text_Only.pptx')
base=Path('/root/.openclaw/workspace/ppt_library')

single={}
for line in (base/'revised_single_slide_uploads.tsv').read_text().splitlines():
    name,id,link=line.split('\t')
    n=int(re.search(r'Slide (\d+)', name).group(1)); single[n]=link
images={}
for line in (base/'revised_slide_image_uploads.tsv').read_text().splitlines():
    name,id,link=line.split('\t')
    n=int(re.search(r'Slide (\d+)', name).group(1)); images[n]=link

prs=Presentation(str(src))
EMU=914400

category_map={
1:('Cover','Hero Cover','Cover / Hero','Open the deck with core value proposition.'),
2:('Process / Timeline','Strategic Roadmap','Timeline / Roadmap','Show strategic direction, product evolution, or phased roadmap.'),
3:('Data / Stats','Metric Overview','Metric Cards','Show company/platform scale with key numbers.'),
4:('Data / Stats','Research Chart Insight','Chart + Insight','Explain research-backed market behavior.'),
5:('Data / Stats','Research + Stat Cards','Insight + Stat Cards','Show one insight supported by 3 metrics.'),
6:('Agenda / Overview','Platform Overview','Product Overview','Explain platform promise and workflow at high level.'),
7:('Feature / Capability','Feature Matrix','Dense Feature List','Show current capabilities grouped across product areas.'),
8:('Content Slide','Text-Heavy Insight','Text + Bullets','Explain a strategic point with paragraph/bullets.'),
9:('Content Slide','UI / Product Showcase','Screenshot + Explanation','Explain dashboard, UI, or workflow screenshot.'),
10:('Content Slide','Main + Supporting Text','Two Text Blocks','Use main idea plus supporting context.'),
11:('Content Slide','Content + Image Basic','Text + Image','Pair concise explanation with visual.'),
12:('Content Slide','Content + Image','Text + Image','Explain benefit/outcome with visual support.'),
13:('Content Slide','Standard Content','Long-Form Content','Use for concise paragraph or executive explanation.'),
14:('Section Divider','Section Divider - Pattern','Chapter Divider','Introduce a new section.'),
15:('Section Divider','Section Divider - Diagonal','Chapter Divider','Introduce a new section with alternate visual style.'),
16:('Content Slide','General Content Variant A','Sidebar Content','Explain workflow, process, or feature benefit.'),
17:('Content Slide','Content with Sidebar','Sidebar Content','Explain operational message with supporting sidebar space.'),
18:('Visual / Image Gallery','Visual-Only / Blank','Visual Only','Use as visual break, full image slide, or blank canvas.'),
}

rules={
'Cover / Hero':('35-55',70,'80-130',170,0,0,'N/A','N/A'),
'Timeline / Roadmap':('30-45',55,'250-420',520,5,7,'35-55',75),
'Metric Cards':('25-40',55,'80-140',180,0,0,'N/A','N/A'),
'Chart + Insight':('25-45',60,'120-220',280,1,3,'60-90',110),
'Insight + Stat Cards':('30-50',65,'180-320',420,3,5,'45-70',90),
'Product Overview':('25-40',55,'120-220',300,3,5,'35-60',75),
'Dense Feature List':('25-45',60,'350-550',700,12,18,'25-45',60),
'Text + Bullets':('30-50',65,'280-450',600,3,6,'60-90',120),
'Screenshot + Explanation':('25-45',60,'180-300',420,2,4,'50-80',100),
'Two Text Blocks':('25-45',60,'200-360',480,2,4,'60-90',120),
'Text + Image':('25-45',60,'160-280',380,2,4,'50-80',100),
'Long-Form Content':('25-45',60,'250-420',550,0,4,'60-90',120),
'Chapter Divider':('20-40',55,'40-90',120,0,0,'N/A','N/A'),
'Sidebar Content':('25-45',60,'200-360',500,3,5,'50-80',110),
'Visual Only':('0-35',45,'0-80',120,0,2,'N/A','N/A'),
}

def get_text_shapes(slide):
    rows=[]
    for idx,sh in enumerate(slide.shapes):
        if hasattr(sh,'text_frame') and sh.has_text_frame:
            paras=[p.text.strip() for p in sh.text_frame.paragraphs if p.text.strip()]
            if paras:
                x=y=w=h=''
                try:
                    x=round(sh.left/EMU,2); y=round(sh.top/EMU,2); w=round(sh.width/EMU,2); h=round(sh.height/EMU,2)
                except Exception: pass
                rows.append({'idx':idx,'paras':paras,'chars':sum(len(p) for p in paras),'loc':f'x={x}, y={y}, w={w}, h={h}'})
    return rows


heading_overrides={
1:'Keep Freight Moving. With Less Friction.',
2:'Where Truckstop Is Going',
3:'Truckstop by the Numbers',
4:'Carriers: How They Book Loads',
5:'Carriers Work with More Brokers Than You Think.',
6:'One Place To Run Your Freight',
7:"What's Available Today.",
8:'Why Carrier Networks Matter',
9:'Live Dashboard Visibility',
10:'Simplify Freight Operations',
11:'Compliance Built Into Workflow',
12:'Faster Load Coverage',
13:'Operational Control',
14:'Platform Capabilities',
15:'Market Intelligence',
16:'Smarter Broker Workflows',
17:'Connected Freight Operations',
18:''
}

def current_counts(text_shapes, slide_no):
    if not text_shapes: return ('',0,0,0)
    meaningful=[r for r in text_shapes if not (len(r['paras'])==1 and r['paras'][0].isdigit())]
    heading=heading_overrides.get(slide_no,'')
    body_paras=[]
    for r in meaningful:
        for para in r['paras']:
            norm=' '.join(para.split())
            hnorm=' '.join(heading.split())
            if hnorm and norm == hnorm:
                continue
            if norm:
                body_paras.append(norm)
    bullet_count=len(body_paras)
    body_chars=sum(len(p) for p in body_paras)
    return (heading,len(heading),body_chars,bullet_count)

rows=[]
analysis=[]
for i,slide in enumerate(prs.slides,1):
    parent,sub,layout,purpose=category_map.get(i,('Uncategorized','Needs Review','Unknown','Needs manual review.'))
    r=rules.get(layout,('25-45',60,'150-300',420,3,5,'50-80',110))
    text_shapes=get_text_shapes(slide)
    heading,current_heading_chars,current_body_chars,current_bullets=current_counts(text_shapes, i)
    image_count=sum(1 for sh in slide.shapes if getattr(sh,'shape_type',None)==13)
    if i==18 and not text_shapes:
        status='Visual-only / needs optional label if used as template'
    else:
        status='Analyzed - ready for review'
    row={
        'Slide No.':i,
        'Template Name':f'Slide {i:02d} - {sub}',
        'Parent Category':parent,
        'Sub Category':sub,
        'Layout Type':layout,
        'Purpose':purpose,
        'Best Use Case':purpose,
        'Current Heading':heading,
        'Current Heading Characters':current_heading_chars,
        'Current Body Characters':current_body_chars,
        'Current Bullet/Paragraph Count':current_bullets,
        'Ideal Heading Characters':r[0],
        'Max Heading Characters':r[1],
        'Ideal Body Characters':r[2],
        'Max Body Characters':r[3],
        'Ideal Bullet/Paragraph Count':r[4],
        'Max Bullet/Paragraph Count':r[5],
        'Ideal Characters Per Bullet/Paragraph':r[6],
        'Max Characters Per Bullet/Paragraph':r[7],
        'Text Areas':'; '.join(f"shape {x['idx']} ({x['loc']})" for x in text_shapes[:6]),
        'Image/Icon Areas':f'{image_count} picture objects detected',
        'Text Capacity': 'High' if int(r[3])>=500 else ('Medium' if int(r[3])>=280 else 'Low'),
        'What To Avoid':'Overloading this layout beyond max count; adding unrelated messages; using dense copy where visual space is limited.',
        'Preview Image Link':images.get(i,''),
        'Single Slide PPT Link':single.get(i,''),
        'Status':status,
        'Notes':'Counts are recommended writing limits; final fit should still be checked visually.'
    }
    rows.append(row)
    analysis.append({'slide':i,'text_shapes':text_shapes,'row':row})

csvp=base/'ppt_template_index_revised_18_slides.csv'
headers=list(rows[0].keys())
with csvp.open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=headers); w.writeheader(); w.writerows(rows)
(base/'ppt_template_index_revised_18_slides.json').write_text(json.dumps(analysis,indent=2),encoding='utf-8')
print(csvp)
print(len(rows), len(headers))
