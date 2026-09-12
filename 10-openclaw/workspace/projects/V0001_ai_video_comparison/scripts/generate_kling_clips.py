from pathlib import Path
import re,time,json,requests,urllib.request,base64,mimetypes
PROJECT=Path('/root/.openclaw/workspace/projects/V0001_ai_video_comparison')
ENV=Path('/root/.openclaw/workspace/.env').read_text()
token=re.search(r'^REPLICATE_API_TOKEN=["\']?([^"\'\n]+)',ENV,re.M).group(1)
headers={'Authorization':f'Bearer {token}','Content-Type':'application/json','Prefer':'wait=5'}
def data_uri(path):
    data=Path(path).read_bytes(); mime=mimetypes.guess_type(str(path))[0] or 'image/jpeg'
    return f"data:{mime};base64,"+base64.b64encode(data).decode()
clips=[
('01_hook','A software developer typing on a laptop in a modern workspace, subtle cinematic camera movement, professional lighting, no text, no logos.'),
('02_insight','Clean abstract data visualization background with moving charts and network lines, professional off-white and navy palette, no readable text, no logos.'),
('03_implication','Professional person reviewing job listings on laptop, thoughtful career search mood, gentle motion, no readable text, no logos.'),
('04_cta','Polished SaaS product report style background, abstract UI cards floating over purple orange gradient, professional, no readable text, no logos.')]
status=[]
outdir=PROJECT/'kling/assets/bg_clips'; outdir.mkdir(parents=True,exist_ok=True)
for name,prompt in clips:
    img=data_uri(PROJECT/f'kling/assets/start_frames/{name}.jpg')
    body={'input':{'mode':'standard','prompt':prompt,'duration':5,'start_image':img,'negative_prompt':'blur, distortion, unreadable text, watermark, logo, subtitles, captions'}}
    r=requests.post('https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions',headers=headers,json=body,timeout=90)
    print('submit',name,r.status_code,r.text[:300],flush=True); r.raise_for_status()
    status.append({'name':name,'id':r.json()['id'],'prompt':prompt})
Path(PROJECT/'kling/predictions.json').write_text(json.dumps(status,indent=2))
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
Path(PROJECT/'kling/predictions_final.json').write_text(json.dumps(status,indent=2))
