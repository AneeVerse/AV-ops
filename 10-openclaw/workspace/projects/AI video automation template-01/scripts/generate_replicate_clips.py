from pathlib import Path
import os, re, time, json, requests, sys, urllib.request
PROJECT=Path('/root/.openclaw/workspace/projects/V0001_ai_video_poc')
ENV=Path('/root/.openclaw/workspace/.env').read_text()
m=re.search(r'^REPLICATE_API_TOKEN=["\']?([^"\'\n]+)', ENV, re.M)
if not m: raise SystemExit('REPLICATE_API_TOKEN missing')
TOKEN=m.group(1)
HEAD={'Authorization':f'Bearer {TOKEN}','Content-Type':'application/json','Prefer':'wait=5'}
MODEL='bytedance/seedance-2.0'
clips=[
 ('01_hook', 'Vertical 9:16 cinematic close-up of a software developer typing on a laptop in a modern workspace, subtle camera movement, professional lighting, shallow depth of field, no text, no logos, no captions.'),
 ('02_insight', 'Vertical 9:16 clean abstract data visualization background, soft off-white and navy professional palette with subtle moving charts, particles, and digital job-search network lines, no readable text, no logos.'),
 ('03_implication', 'Vertical 9:16 professional person reviewing job listings on laptop, thoughtful career search mood, modern office, gentle motion, no readable text, no logos, no captions.'),
 ('04_cta', 'Vertical 9:16 polished SaaS product report style background, abstract UI cards and dashboard panels floating over purple orange gradient, modern professional, no readable text, no logos, no captions.')
]
outdir=PROJECT/'assets/bg_clips'
outdir.mkdir(parents=True, exist_ok=True)
status=[]
for name,prompt in clips:
    print('Submitting', name, flush=True)
    body={'input':{'prompt':prompt,'duration':5,'resolution':'720p','aspect_ratio':'9:16','generate_audio':False}}
    r=requests.post(f'https://api.replicate.com/v1/models/{MODEL}/predictions',headers=HEAD,json=body,timeout=60)
    print(r.status_code, r.text[:300], flush=True)
    r.raise_for_status()
    pred=r.json()
    status.append({'name':name,'id':pred['id'],'prompt':prompt,'urls':pred.get('urls',{})})
Path(PROJECT/'assets/replicate_predictions.json').write_text(json.dumps(status,indent=2))

for item in status:
    name=item['name']; pred_id=item['id']
    print('Waiting', name, pred_id, flush=True)
    while True:
        r=requests.get(f'https://api.replicate.com/v1/predictions/{pred_id}',headers={'Authorization':f'Bearer {TOKEN}'},timeout=60)
        r.raise_for_status(); data=r.json()
        st=data['status']; print(name, st, flush=True)
        if st in ('succeeded','failed','canceled'):
            item['result']=data
            break
        time.sleep(12)
    if item['result']['status']!='succeeded':
        print('FAILED', name, item['result'].get('error'), file=sys.stderr)
        continue
    output=item['result'].get('output')
    url=output[0] if isinstance(output,list) else output
    if not url:
        print('No output url for', name, file=sys.stderr); continue
    dest=outdir/f'{name}.mp4'
    print('Downloading', name, url, flush=True)
    urllib.request.urlretrieve(url, dest)
    item['downloaded']=str(dest)
Path(PROJECT/'assets/replicate_predictions_final.json').write_text(json.dumps(status,indent=2))
