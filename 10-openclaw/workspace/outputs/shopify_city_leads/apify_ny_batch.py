#!/usr/bin/env python3
import csv, json, os, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlparse
import requests

ROOT=Path('/root/.openclaw/workspace')
sys.path.insert(0, str(ROOT/'tools'))
import shopify_city_lead_automation as v

SHEET_ID='1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o'
TAB='Shopify'
OUT=ROOT/'outputs/shopify_city_leads'
OUT.mkdir(parents=True, exist_ok=True)
RUN_LOG=OUT/'apify_ny_batch_20260604.log'
RESULT_JSON=OUT/'apify_ny_batch_20260604_result.json'

QUERIES=[
 'New York jewelry boutique Shopify contact email',
 'NYC jewelry boutique Shopify contact email',
 'New York fine jewelry store Shopify email',
 'NYC fine jewelry store Shopify email',
 'New York custom jewelry Shopify contact email',
 'NYC custom jewelry Shopify contact email',
 'New York gold jewelry Shopify contact email',
 'NYC gold jewelry Shopify contact email',
 'New York diamond rings Shopify contact email',
 'NYC engagement rings Shopify contact email',
 'Manhattan fine jewelry Shopify contact email',
 'Brooklyn fine jewelry Shopify contact email',
 'SoHo NYC jewelry Shopify contact email',
 'Williamsburg jewelry Shopify contact email',
 'New York demi fine jewelry Shopify email',
 'NYC gold vermeil jewelry Shopify email',
]
BAD_EMAIL_DOMAINS={'shopify.com','myshopify.com','sentry.io','example.com','domain.com','email.com','privy.com','klaviyo.com','mailchimp.com','schema.org','wixpress.com'}
PUBLIC_MAIL={'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','me.com'}

def log(s):
    line=f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {s}"
    print(line, flush=True)
    with RUN_LOG.open('a',encoding='utf-8') as f: f.write(line+'\n')

def env_token():
    txt=(ROOT/'.env').read_text()
    m=re.search(r'^APIFY_API_TOKEN=(.*)$', txt, re.M)
    if not m: raise SystemExit('APIFY_API_TOKEN missing')
    return m.group(1).strip().strip('"\'')

def run(cmd):
    return subprocess.check_output(cmd, text=True)

def sheet_values():
    return json.loads(run(['gog','sheets','get',SHEET_ID,f'{TAB}!A:J','--json','--no-input'])).get('values') or []

def norm_domain(url): return v.norm_domain(url)

def row_domain(row):
    return norm_domain(row[1]) if len(row)>1 else ''

def append_lead(lead):
    row=[[lead['Store Name'],lead['Link'],lead['Country'],lead['City'],lead['Category'],lead['Email'],lead['Email Source URL'],lead['Email Source Type'],lead['Shopify Verified'],lead['Notes']]]
    run(['gog','sheets','append',SHEET_ID,f'{TAB}!A:J','--values-json',json.dumps(row,ensure_ascii=False),'--insert','INSERT_ROWS','--input','USER_ENTERED','--json','--no-input'])

def update_row(rownum, row):
    # row is 10 cols
    run(['gog','sheets','update',SHEET_ID,f'{TAB}!A{rownum}:J{rownum}','--values-json',json.dumps([row],ensure_ascii=False),'--input','USER_ENTERED','--json','--no-input'])

def collect_apify():
    token=env_token()
    payload={
        'queries':'\n'.join(QUERIES),
        'resultsPerPage':10,
        'maxPagesPerQuery':1,
        'countryCode':'us',
        'languageCode':'en',
        'includeUnfilteredResults':False,
        'saveHtml':False,
        'saveHtmlToKeyValueStore':False,
        'includeAiOverview':False,
        'enableAiMode':False,
        'includePaidResults':False,
    }
    # Start run so we can report exact usage/cost.
    url='https://api.apify.com/v2/acts/apify~google-search-scraper/runs'
    r=requests.post(url, params={'token':token,'maxTotalChargeUsd':'0.50'}, json=payload, timeout=60)
    log(f'Apify start status={r.status_code}')
    r.raise_for_status()
    run_info=r.json()['data']; run_id=run_info['id']
    deadline=time.time()+600
    while True:
        rr=requests.get(f'https://api.apify.com/v2/actor-runs/{run_id}', params={'token':token}, timeout=30)
        rr.raise_for_status(); data=rr.json()['data']; status=data['status']
        log(f'Apify run {run_id} status={status}')
        if status in ('SUCCEEDED','FAILED','ABORTED','TIMED-OUT'):
            break
        if time.time()>deadline: raise TimeoutError('Apify run timeout')
        time.sleep(15)
    dataset_id=data.get('defaultDatasetId')
    items=[]
    if dataset_id:
        ir=requests.get(f'https://api.apify.com/v2/datasets/{dataset_id}/items', params={'token':token,'clean':'true','format':'json'}, timeout=60)
        ir.raise_for_status(); items=ir.json()
    usage=data.get('usageUsd') or data.get('usageTotalUsd') or data.get('chargedUsageUsd') or 0
    # Some API variants put cost in usageTotalUsd/usageUsd; keep full run data for inspection.
    return run_id, data, items, float(usage or 0)

def extract_candidates(items):
    ordered=[]; seen=set()
    for item in items:
        sq=item.get('searchQuery') or {}
        q=sq.get('term') or item.get('query') or ''
        for key in ('organicResults','paidResults'):
            for res in item.get(key) or []:
                url=res.get('url') or res.get('link') or ''
                can=v.canonical(url)
                d=norm_domain(can)
                if not can or not d or d in seen: continue
                seen.add(d)
                ordered.append({'url':can,'domain':d,'query':q,'title':res.get('title','')})
    return ordered

def category_order(query, title):
    s=(query+' '+title).lower()
    if 'demi' in s or 'vermeil' in s:
        return ['Demi-fine Jewellery','Fine Jewellery']
    return ['Fine Jewellery','Demi-fine Jewellery']

def email_bad(email, link):
    if not email: return False
    e=email.lower(); ed=e.split('@')[-1]
    sd=norm_domain(link)
    if ed in BAD_EMAIL_DOMAINS: return True
    if any(bit in e for bit in v.BAD_EMAIL_BITS): return True
    # unrelated vendor/domain emails only; allow public mailboxes and same root-domain-ish matches.
    if ed in PUBLIC_MAIL: return False
    sd_parts=sd.split('.')[-2:] if sd else []
    ed_parts=ed.split('.')[-2:]
    if sd_parts and ed_parts == sd_parts: return False
    if sd and (ed.endswith('.'+sd) or sd.endswith('.'+ed)): return False
    # allow if source page visibly belongs to same site; otherwise flag as unrelated.
    return True

def audit_appended(appended_domains):
    vals=sheet_values()
    cleared=[]
    for idx,row in enumerate(vals[1:], start=2):
        if row_domain(row) not in appended_domains: continue
        row=row+['']*(10-len(row))
        if email_bad(row[5], row[1]):
            old=row[5]
            notes=(row[9]+'; ' if row[9] else '')+'Email cleared: fake/vendor unrelated during post-append audit'
            row[5]=row[6]=row[7]=''; row[9]=notes
            update_row(idx,row[:10])
            cleared.append({'row':idx,'domain':row_domain(row),'old_email':old})
    return cleared

def stats():
    vals=sheet_values(); rows=vals[1:]
    total=len(rows)
    ny=sum(1 for r in rows if len(r)>3 and r[2].strip().lower()=='us' and r[3].strip().lower()=='new york')
    emails=sum(1 for r in rows if len(r)>5 and r[5].strip())
    domains=[row_domain(r) for r in rows if row_domain(r)]
    dup=len(domains)-len(set(domains))
    return {'total_rows':total,'new_york_rows':ny,'emails_found':emails,'duplicate_domains':dup}

def main():
    start=stats(); log(f'Start stats {start}')
    vals=sheet_values(); existing={row_domain(r) for r in vals[1:] if row_domain(r)}
    run_id, run_data, items, cost=collect_apify()
    candidates=extract_candidates(items)
    log(f'Apify items={len(items)} candidates={len(candidates)} cost={cost}')
    added=[]; rejected=[]
    for c in candidates:
        d=c['domain']
        if d in existing:
            rejected.append((c['url'],'duplicate_domain'))
            continue
        lead=None; reason_last=''
        for cat in category_order(c.get('query',''), c.get('title','')):
            lead, reason=v.verify_candidate(c['url'],'US','New York',cat)
            if lead: break
            reason_last=reason
        if not lead:
            rejected.append((c['url'],reason_last or 'verify_failed'))
            continue
        d=lead['Domain']
        if d in existing:
            rejected.append((c['url'],'duplicate_domain_after_redirect'))
            continue
        # If location absent but candidate from NY query and country/location ok enough by verifier, keep note.
        append_lead(lead)
        existing.add(d); added.append(lead)
        log(f"ADDED {len(added)} {lead['Store Name']} | {lead['Link']} | {lead['Category']} | email={lead['Email'] or 'blank'}")
        # one verified lead at a time: refresh existing from sheet after each append
        existing={row_domain(r) for r in sheet_values()[1:] if row_domain(r)}
    cleared=audit_appended({a['Domain'] for a in added})
    end=stats()
    # reason counts
    rc={}
    for _,r in rejected: rc[r]=rc.get(r,0)+1
    out={'run_id':run_id,'apify_cost':cost,'apify_run_usage_fields':{k:run_data.get(k) for k in ('usageUsd','usageTotalUsd','chargedUsageUsd','usage','status')},'candidates_found':len(candidates),'added_count':len(added),'added':added,'rejected_skipped':len(rejected),'reject_reasons':rc,'cleanup_cleared':cleared,'start_stats':start,'end_stats':end}
    RESULT_JSON.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(out,indent=2,ensure_ascii=False))

if __name__=='__main__': main()
