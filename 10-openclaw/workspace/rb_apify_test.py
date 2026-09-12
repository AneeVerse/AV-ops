from pathlib import Path
import json, urllib.request, urllib.parse, time, sys
key=[l.split('=',1)[1].strip() for l in Path('/root/.openclaw/workspace/.env').read_text().splitlines() if l.startswith('APIFY_API_TOKEN=')][0]
query='(loan OR CCPS OR CCD OR capacity OR capex OR solar OR PV OR photovoltaic OR oxide OR datacentre OR drone OR export OR "order book") (from:_Investor_Feed_ OR from:REDBOXINDIA OR from:silvertrade OR from:speedystox OR from:compoundingaiin OR from:AimInvestments OR from:SmartSyncServ) since:2026-05-02'
body={"searchTerms":[query],"maxItems":20,"sort":"Latest"}
url='https://api.apify.com/v2/acts/apidojo~tweet-scraper/runs?token='+key+'&maxTotalChargeUsd=1&waitForFinish=120'
req=urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method='POST')
with urllib.request.urlopen(req, timeout=180) as r:
    data=json.load(r)
print(json.dumps({k:data['data'].get(k) for k in ['id','status','defaultDatasetId','startedAt','finishedAt']}, indent=2))
if data['data'].get('defaultDatasetId'):
    ds=data['data']['defaultDatasetId']
    items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{ds}/items?token={key}&clean=true', timeout=60))
    print('items', len(items))
    print(json.dumps(items[:2], indent=2, ensure_ascii=False)[:4000])
