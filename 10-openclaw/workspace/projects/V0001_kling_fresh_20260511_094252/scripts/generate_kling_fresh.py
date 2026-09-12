from pathlib import Path
import re,time,json,requests,urllib.request,base64,mimetypes
PROJECT=Path('/root/.openclaw/workspace/projects/V0001_kling_fresh_current').resolve()
ENV=Path('/root/.openclaw/workspace/.env').read_text()
token=re.search(r'^REPLICATE_API_TOKEN=["\']?([^"\'\n]+)',ENV,re.M).group(1)
headers={'Authorization':f'Bearer {token}','Content-Type':'application/json','Prefer':'wait=5'}
def data_uri(path):
    data=Path(path).read_bytes(); mime=mimetypes.guess_type(str(path))[0] or 'image/jpeg'
    return f"data:{mime};base64,"+base64.b64encode(data).decode()
clips=[
('01_hook','Cinematic vertical video of a software developer typing on laptop in a modern workspace, professional lighting, subtle camera movement, no on-screen text, no watermark. If audio is supported, include male voiceover: Most software developers qualify for more job titles than they apply to.'),
('02_insight','Clean abstract data visualization vertical video with moving charts and digital job network lines, professional off-white/navy palette, no readable text, no watermark. If audio is supported, include male voiceover: Ninety five percent of public jobs stay invisible when candidates search the wrong titles.'),
('03_implication','Professional vertical video of person reviewing job listings on laptop, thoughtful career search mood, gentle motion, no readable text, no watermark. If audio is supported, include male voiceover: Your strongest matches may be roles you have never searched.'),
('04_cta','Polished SaaS work-style report vertical video background, modern dashboard UI cards floating over purple orange gradient, no readable text, no watermark. If audio is supported, include male voiceover: Start your Trait DNA report, free, fifteen minutes, no credit card.')]
status=[]
for name,prompt in clips:
    body={'input':{'mode':'standard','prompt':prompt,'duration':5,'start_image':data_uri(PROJECT/f'start_frames/{name}.jpg'),'negative_prompt':'blur, distortion, watermark, logo, subtitles, captions, gibberish text'}}
    r=requests.post('https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions',headers=headers,json=body,timeout=90)
    print('submit',name,r.status_code,r.text[:300],flush=True); r.raise_for_status()
    status.append({'name':name,'id':r.json()['id'],'prompt':prompt})
(PROJECT/'source/kling_predictions.json').write_text(json.dumps(status,indent=2))
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
        urllib.request.urlretrieve(url,PROJECT/f'bg_clips/{item["name"]}.mp4')
(PROJECT/'source/kling_predictions_final.json').write_text(json.dumps(status,indent=2))
