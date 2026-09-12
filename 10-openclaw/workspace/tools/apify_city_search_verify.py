#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, urllib.parse, time, importlib.util, re, sys

COUNTRY='US'
CITY='New York'
CATEGORY='Fine Jewellery'
MAX_CHARGE='0.50'
SEARCH_TERMS = [
    'New York fine jewelry Shopify contact email',
    'New York fine jewellery Shopify contact email',
    'NYC fine jewelry Shopify contact email',
    'New York diamond jewelry Shopify contact email',
    'New York 14k gold jewelry Shopify contact email',
    'New York 18k gold jewelry Shopify contact email',
    'New York engagement rings Shopify contact email',
    'New York custom fine jewelry Shopify contact email',
    'New York handmade fine jewelry Shopify contact email',
    'New York sustainable fine jewelry Shopify contact email',
    'New York demi fine jewelry Shopify contact email',
    'New York demi-fine jewelry Shopify contact email',
    'NYC demi fine jewelry Shopify contact email',
    'New York gold vermeil jewelry Shopify contact email',
    'New York jewellery boutique Shopify contact email',
]

key=[l.split('=',1)[1].strip() for l in Path('/root/.openclaw/workspace/.env').read_text().splitlines() if l.startswith('APIFY_API_TOKEN=')][0]
actor='apify/google-search-scraper'
body={
  'queries':'\n'.join(SEARCH_TERMS),
  'resultsPerPage':10,
  'maxPagesPerQuery':1,
  'languageCode':'en',
  'countryCode':'us',
  'mobileResults':False,
  'includeUnfilteredResults':False,
  'saveHtml':False,
  'saveHtmlToKeyValueStore':False
}
url=f'https://api.apify.com/v2/acts/{urllib.parse.quote(actor,safe="")}/runs?token={key}&maxTotalChargeUsd={MAX_CHARGE}&waitForFinish=180'
req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(req,timeout=240) as r:
    run=json.load(r)['data']
run_id=run['id']
# If not finished, poll.
for _ in range(60):
    data=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/actor-runs/{run_id}?token={key}',timeout=30))['data']
    if data['status'] in ['SUCCEEDED','FAILED','ABORTED','TIMED-OUT']:
        run=data; break
    time.sleep(5)
print('RUN', json.dumps({k:run.get(k) for k in ['id','status','defaultDatasetId','usageTotalUsd']}, ensure_ascii=False), flush=True)
if run.get('status')!='SUCCEEDED':
    sys.exit(1)
items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{run["defaultDatasetId"]}/items?token={key}&clean=true', timeout=120))
urls=[]
for item in items:
    for r in item.get('organicResults',[]):
        u=r.get('url')
        if u: urls.append(u)
seen=set(); candidates=[]
for u in urls:
    d=urllib.parse.urlparse(u).netloc.lower().removeprefix('www.')
    if d and d not in seen:
        seen.add(d); candidates.append(u)
print('CANDIDATES', len(candidates), flush=True)

spec=importlib.util.spec_from_file_location('m','/root/.openclaw/workspace/tools/shopify_city_lead_automation.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
existing,current=m.sheet_domains()
print('SHEET', current, 'existing', len(existing), flush=True)
added=0; rejected=0; skipped=0
for u in candidates:
    d=m.norm_domain(u)
    if d in existing:
        skipped+=1; print('SKIP duplicate',d, flush=True); continue
    lead,reason=m.verify_candidate(u,COUNTRY,CITY,CATEGORY)
    if not lead:
        rejected+=1; print('REJECT',u,reason, flush=True); continue
    if lead['Domain'] in existing:
        skipped+=1; print('SKIP redirect duplicate',lead['Domain'], flush=True); continue
    m.append_lead(lead)
    existing.add(lead['Domain']); added+=1
    print('ADDED',lead['Store Name'],lead['Link'],lead['Email'] or 'blank',lead['Notes'], flush=True)
print('SUMMARY', json.dumps({'added':added,'rejected':rejected,'skipped':skipped,'candidates':len(candidates),'usageTotalUsd':run.get('usageTotalUsd')}, ensure_ascii=False), flush=True)
