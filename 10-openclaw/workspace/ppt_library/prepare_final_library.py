import json, subprocess, re
from pathlib import Path

FINAL_ROOT='1UGqr1GfjficNygMZ2JM86xgaMZIkWr6Q'
LOCAL=Path('/root/.openclaw/workspace/ppt_library/revised_single_slide_ppts')
MANIFEST=Path('/root/.openclaw/workspace/ppt_library/final_library_uploads.tsv')

slides={
1:('Cover','Slide 01 - Hero Cover.pptx'),
2:('Process Timeline','Slide 02 - Strategic Roadmap.pptx'),
3:('Data Stats','Slide 03 - Metric Overview.pptx'),
4:('Data Stats','Slide 04 - Research Chart Insight.pptx'),
5:('Data Stats','Slide 05 - Research + Stat Cards.pptx'),
6:('Agenda Overview','Slide 06 - Platform Overview.pptx'),
7:('Feature Capability','Slide 07 - Feature Matrix.pptx'),
8:('Content Slide','Slide 08 - Text Heavy Insight.pptx'),
9:('Content Slide','Slide 09 - UI Product Showcase.pptx'),
10:('Content Slide','Slide 10 - Main + Supporting Text.pptx'),
11:('Content Slide','Slide 11 - Content + Image Basic.pptx'),
12:('Content Slide','Slide 12 - Content + Image.pptx'),
13:('Content Slide','Slide 13 - Standard Content.pptx'),
14:('Section Divider','Slide 14 - Section Divider Pattern.pptx'),
15:('Section Divider','Slide 15 - Section Divider Diagonal.pptx'),
16:('Content Slide','Slide 16 - General Content Variant A.pptx'),
17:('Content Slide','Slide 17 - Content with Sidebar.pptx'),
18:('Visual Image Gallery','Slide 18 - Image Only Slide.pptx'),
}

def run(args):
    return subprocess.check_output(args, text=True)

def get_obj_id(raw):
    d=json.loads(raw)
    obj=d.get('folder') or d.get('file') or d
    return obj['id']

def find_folder(name,parent):
    q=f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and '{parent}' in parents and trashed = false"
    data=json.loads(run(['gog','drive','search',q,'--max','1','--json','--no-input']))
    if data.get('files'): return data['files'][0]['id']
    return get_obj_id(run(['gog','drive','mkdir',name,'--parent',parent,'--json','--no-input']))

categories=sorted(set(cat for cat,_ in slides.values()))
folder_ids={cat:find_folder(cat, FINAL_ROOT) for cat in categories}

lines=[]
for n,(cat,final_name) in slides.items():
    src=next(LOCAL.glob(f'Slide {n:02d} - *.pptx'))
    parent=folder_ids[cat]
    raw=run(['gog','drive','upload',str(src),'--parent',parent,'--name',final_name,'--json','--no-input'])
    d=json.loads(raw)['file']
    lines.append(f"{n}\t{cat}\t{final_name}\t{d['id']}\t{d.get('webViewLink','')}")
    print(f"uploaded {final_name}")
MANIFEST.write_text('\n'.join(lines)+'\n')
Path('/root/.openclaw/workspace/ppt_library/final_category_folders.json').write_text(json.dumps(folder_ids,indent=2))
print('DONE', len(lines))
