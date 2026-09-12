from pathlib import Path
import json, urllib.request, time, re

handles = ["_Investor_Feed_","REDBOXINDIA","silvertrade","speedystox","compoundingaiin","AimInvestments","SmartSyncServ"]
keywords = ["loan","CCPS","CCD","capacity","capex","solar","PV","photovoltaic","oxide","datacentre","data centre","drone","export","order book"]
key = None
for line in Path('/root/.openclaw/workspace/.env').read_text().splitlines():
    if line.startswith('APIFY_API_TOKEN='):
        key=line.split('=',1)[1].strip().strip('"').strip("'")
        break
if not key:
    raise SystemExit('APIFY_API_TOKEN missing')

query = '(loan OR CCPS OR CCD OR capacity OR capex OR solar OR PV OR photovoltaic OR oxide OR datacentre OR "data centre" OR drone OR export OR "order book") (' + ' OR '.join(f'from:{h}' for h in handles) + ') since:2026-05-02'
body = {"searchTerms":[query], "maxItems":250, "sort":"Latest"}
url='https://api.apify.com/v2/acts/apidojo~tweet-scraper/runs?token='+key+'&maxTotalChargeUsd=2&waitForFinish=180'
req=urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method='POST')
with urllib.request.urlopen(req, timeout=240) as r:
    run=json.load(r)['data']
print('run', run['id'], run['status'])
if run['status'] not in ('SUCCEEDED','TIMED-OUT','ABORTED','FAILED'):
    for _ in range(30):
        time.sleep(5)
        data=json.load(urllib.request.urlopen(f"https://api.apify.com/v2/actor-runs/{run['id']}?token={key}", timeout=30))['data']
        print('status', data['status'])
        if data['status'] in ('SUCCEEDED','TIMED-OUT','ABORTED','FAILED'):
            run=data; break
if run.get('defaultDatasetId'):
    ds=run['defaultDatasetId']
    items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{ds}/items?token={key}&clean=true', timeout=120))
else:
    items=[]
Path('/root/.openclaw/workspace/rb_cb_apify_raw.json').write_text(json.dumps(items, ensure_ascii=False, indent=2))
# normalize and filter
def text_of(x):
    return x.get('text') or x.get('fullText') or ''
rows=[]
for x in items:
    txt=text_of(x)
    low=txt.lower()
    matched=[]
    for kw in keywords:
        if kw.lower() in low:
            matched.append(kw)
    if not matched: continue
    auth=x.get('author') or {}
    rows.append({
        'date': x.get('createdAt',''),
        'handle': auth.get('userName') or x.get('authorUserName') or '',
        'tweet_url': x.get('url') or x.get('twitterUrl') or '',
        'matched_keywords': ', '.join(dict.fromkeys(matched)),
        'text': txt,
        'likes': x.get('likeCount',''),
        'retweets': x.get('retweetCount',''),
        'views': x.get('viewCount',''),
    })
Path('/root/.openclaw/workspace/rb_cb_filtered.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2))
print('items', len(items), 'filtered', len(rows))
for r in rows[:20]:
    print('\n---')
    print(r['date'], r['handle'], r['matched_keywords'])
    print(r['tweet_url'])
    print(r['text'][:600].replace('\n',' | '))
