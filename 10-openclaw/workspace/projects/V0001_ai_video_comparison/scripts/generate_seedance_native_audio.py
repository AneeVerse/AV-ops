from pathlib import Path
import re,time,json,requests,urllib.request
PROJECT=Path('/root/.openclaw/workspace/projects/V0001_ai_video_comparison')
ENV=Path('/root/.openclaw/workspace/.env').read_text()
token=re.search(r'^REPLICATE_API_TOKEN=["\']?([^"\'\n]+)',ENV,re.M).group(1)
headers={'Authorization':f'Bearer {token}','Content-Type':'application/json','Prefer':'wait=5'}
clips=[
('01_hook','Vertical 9:16 cinematic close-up of a software developer typing on a laptop. Generate clear male English voiceover: Most software developers qualify for more job titles than they actually apply to. Professional soft music, no captions, no on-screen text.'),
('02_insight','Vertical 9:16 clean abstract data/stat scene. Generate clear male English voiceover: Ninety five percent of publicly posted jobs stay invisible when candidates do not know what to search. Professional soft music, no captions, no on-screen text.'),
('03_implication','Vertical 9:16 person reviewing job listings on laptop. Generate clear male English voiceover: Your strongest matches may be roles you have never searched. Professional soft music, no captions, no on-screen text.'),
('04_cta','Vertical 9:16 polished SaaS report and dashboard style scene. Generate clear male English voiceover: Start with your Trait DNA Work Style Report, free, fifteen minutes, no credit card. Professional soft music, no captions, no on-screen text.')]
status=[]
outdir=PROJECT/'seedance_native/clips'; outdir.mkdir(parents=True,exist_ok=True)
for name,prompt in clips:
    body={'input':{'prompt':prompt,'duration':5,'resolution':'720p','aspect_ratio':'9:16','generate_audio':True}}
    r=requests.post('https://api.replicate.com/v1/models/bytedance/seedance-2.0/predictions',headers=headers,json=body,timeout=60)
    print('submit',name,r.status_code,r.text[:300],flush=True); r.raise_for_status()
    status.append({'name':name,'id':r.json()['id'],'prompt':prompt})
Path(PROJECT/'seedance_native/predictions.json').write_text(json.dumps(status,indent=2))
for item in status:
    while True:
        rr=requests.get(f"https://api.replicate.com/v1/predictions/{item['id']}",headers={'Authorization':f'Bearer {token}'},timeout=60)
        rr.raise_for_status(); data=rr.json(); print(item['name'],data['status'],flush=True)
        if data['status'] in ('succeeded','failed','canceled'): break
        time.sleep(12)
    item['result']=data
    if data['status']=='succeeded':
        out=data.get('output'); url=out[0] if isinstance(out,list) else out
        item['url']=url
        urllib.request.urlretrieve(url,outdir/f"{item['name']}.mp4")
Path(PROJECT/'seedance_native/predictions_final.json').write_text(json.dumps(status,indent=2))
