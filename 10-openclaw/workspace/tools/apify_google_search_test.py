#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, urllib.parse, sys

key=[l.split('=',1)[1].strip() for l in Path('/root/.openclaw/workspace/.env').read_text().splitlines() if l.startswith('APIFY_API_TOKEN=')][0]
actor='apify/google-search-scraper'
body={
  "queries":["New York fine jewelry Shopify store email contact"],
  "resultsPerPage":10,
  "maxPagesPerQuery":1,
  "languageCode":"en",
  "countryCode":"us",
  "mobileResults":False,
  "includeUnfilteredResults":False,
  "saveHtml":False,
  "saveHtmlToKeyValueStore":False
}
url=f'https://api.apify.com/v2/acts/{urllib.parse.quote(actor, safe="")}/runs?token={key}&maxTotalChargeUsd=0.50&waitForFinish=120'
req=urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method='POST')
with urllib.request.urlopen(req, timeout=180) as r:
    data=json.load(r)
run=data['data']
print(json.dumps({k:run.get(k) for k in ['id','status','defaultDatasetId','startedAt','finishedAt','usageTotalUsd']}, indent=2))
if run.get('defaultDatasetId'):
    ds=run['defaultDatasetId']
    items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{ds}/items?token={key}&clean=true', timeout=60))
    print('items', len(items))
    print(json.dumps(items[:5], indent=2, ensure_ascii=False)[:5000])
