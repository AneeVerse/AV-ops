#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, importlib.util, re

key=[l.split('=',1)[1].strip() for l in Path('/root/.openclaw/workspace/.env').read_text().splitlines() if l.startswith('APIFY_API_TOKEN=')][0]
ds='IR9Obwi2TekxKSV7s'
items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{ds}/items?token={key}&clean=true', timeout=60))
urls=[]
for item in items:
    for r in item.get('organicResults',[]):
        u=r.get('url')
        if u: urls.append(u)
# de-dupe preserve order
seen=set(); urls2=[]
for u in urls:
    d=re.sub(r'^www\.','',__import__('urllib.parse').parse.urlparse(u).netloc.lower())
    if d and d not in seen:
        seen.add(d); urls2.append(u)
print('candidate_urls',len(urls2), urls2, flush=True)

spec=importlib.util.spec_from_file_location('m','/root/.openclaw/workspace/tools/shopify_city_lead_automation.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
existing,current=m.sheet_domains()
print('sheet_current',current,'existing_domains',len(existing), flush=True)
added=0
for u in urls2:
    d=m.norm_domain(u)
    if d in existing:
        print('SKIP duplicate',d, flush=True); continue
    lead,reason=m.verify_candidate(u,'US','New York','Fine Jewellery')
    if not lead:
        print('REJECT',u,reason, flush=True); continue
    if lead['Domain'] in existing:
        print('SKIP redirect duplicate',lead['Domain'], flush=True); continue
    m.append_lead(lead)
    existing.add(lead['Domain']); added += 1
    print('ADDED',lead['Store Name'],lead['Link'],lead['Email'] or 'blank',lead['Notes'], flush=True)
print('added',added, flush=True)
