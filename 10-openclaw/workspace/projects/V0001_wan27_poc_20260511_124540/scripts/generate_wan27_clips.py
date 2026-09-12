from pathlib import Path
import re, time, json, requests, urllib.request
PROJECT = Path('/root/.openclaw/workspace/projects/V0001_wan27_poc_current').resolve()
ENV = Path('/root/.openclaw/workspace/.env').read_text()
token = re.search(r'^REPLICATE_API_TOKEN=["\']?([^"\'\n]+)', ENV, re.M).group(1)
HEAD = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'Prefer': 'wait=5'}
MODEL = 'wan-video/wan-2.7-t2v'
clips = [
    ('01_hook', 'Vertical 9:16 cinematic professional video of a software developer typing on a laptop in a modern workspace, vibrant natural color, soft daylight, subtle camera movement, shallow depth of field, high quality, no text, no captions, no logos, no watermark.'),
    ('02_insight', 'Vertical 9:16 clean professional abstract data visualization background with moving charts, job search network nodes, subtle digital lines, vibrant off-white navy and magenta palette, modern premium SaaS look, no readable text, no captions, no logos, no watermark.'),
    ('03_implication', 'Vertical 9:16 professional person reviewing job listings on laptop, thoughtful career search mood, modern office, vibrant natural colors, gentle camera movement, high quality, no readable text, no captions, no logos, no watermark.'),
    ('04_cta', 'Vertical 9:16 polished SaaS work style report and dashboard background, floating clean UI cards over vibrant purple orange gradient, premium technology product feel, no readable text, no captions, no logos, no watermark.')
]
neg = 'dull colors, desaturated, grey washed out color, low contrast, blur, distortion, watermark, logo, captions, subtitles, readable text, gibberish text, bad anatomy, flicker'
outdir = PROJECT/'assets/bg_clips'
outdir.mkdir(parents=True, exist_ok=True)
status=[]
for name,prompt in clips:
    body={'input': {'prompt': prompt, 'duration': 5, 'resolution': '1080p', 'aspect_ratio': '9:16', 'negative_prompt': neg, 'enable_prompt_expansion': True}}
    while True:
        r=requests.post(f'https://api.replicate.com/v1/models/{MODEL}/predictions', headers=HEAD, json=body, timeout=90)
        print('submit', name, r.status_code, r.text[:350], flush=True)
        if r.status_code == 429:
            time.sleep(int(r.headers.get('Retry-After','10'))+2); continue
        r.raise_for_status(); data=r.json(); break
    status.append({'name': name, 'id': data['id'], 'prompt': prompt, 'submit': data})
    (PROJECT/'source/wan27_predictions.json').write_text(json.dumps(status, indent=2))
    time.sleep(12)

for item in status:
    name=item['name']; pred_id=item['id']; dest=outdir/f'{name}.mp4'
    while True:
        r=requests.get(f'https://api.replicate.com/v1/predictions/{pred_id}', headers={'Authorization': f'Bearer {token}'}, timeout=60)
        r.raise_for_status(); data=r.json(); print(name, data['status'], flush=True)
        if data['status'] in ('succeeded','failed','canceled'):
            item['result']=data; break
        time.sleep(15)
    if item['result']['status'] != 'succeeded':
        print('FAILED', name, item['result'].get('error'), flush=True)
        continue
    out=item['result'].get('output')
    url=out[0] if isinstance(out, list) else out
    item['url']=url
    urllib.request.urlretrieve(url, dest)
    item['downloaded']=str(dest)
    (PROJECT/'source/wan27_predictions_final.json').write_text(json.dumps(status, indent=2))

# Cost estimate helper: Replicate may not expose USD cost in prediction API, so save metrics for manual calculation.
summary=[]
for item in status:
    res=item.get('result', {})
    metrics=res.get('metrics', {}) or {}
    summary.append({'name': item['name'], 'id': item['id'], 'status': res.get('status'), 'metrics': metrics, 'created_at': res.get('created_at'), 'started_at': res.get('started_at'), 'completed_at': res.get('completed_at')})
(PROJECT/'source/wan27_cost_metrics.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2), flush=True)
