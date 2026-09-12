#!/usr/bin/env python3
"""Continue NYC-only Shopify jewellery lead collection toward 1000 rows.
Each Apify run is capped at $0.50, then candidates are locally verified and appended one-by-one.
"""
import json, os, re, subprocess, sys, time, random
from pathlib import Path
from urllib.parse import urljoin
import requests

ROOT=Path('/root/.openclaw/workspace')
sys.path.insert(0, str(ROOT/'tools'))
import shopify_city_lead_automation as v
# Runtime optimization: keep verification accuracy but avoid spending minutes on dead sites.
v.TIMEOUT=int(os.environ.get('VERIFY_TIMEOUT','5'))
v.CONTACT_PATHS=['']  # homepage-first for speed; missing email is allowed

SHEET_ID='1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o'; TAB='Shopify'; NON_SHOPIFY_TAB='Non-Shopify'
OUT=ROOT/'outputs/shopify_city_leads'; OUT.mkdir(parents=True, exist_ok=True)
LOG=OUT/'ny_to_1000_runner.log'; REPORT=OUT/'ny_to_1000_report.json'
TARGET=int(os.environ.get('TARGET_SHOPIFY_NY','1000')); MAX_RUNS=int(os.environ.get('MAX_APIFY_RUNS','12')); MAX_CANDIDATES=int(os.environ.get('MAX_CANDIDATES_PER_RUN','80')); START_BATCH=int(os.environ.get('START_BATCH','0'))
MAX_QUERIES=int(os.environ.get('MAX_QUERIES_PER_RUN','24')); RESULTS_PER_PAGE=int(os.environ.get('APIFY_RESULTS_PER_PAGE','10'))
BAD_EMAIL_DOMAINS={'shopify.com','myshopify.com','sentry.io','example.com','domain.com','email.com','privy.com','klaviyo.com','mailchimp.com','schema.org','wixpress.com'}
PUBLIC_MAIL={'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','me.com'}
AREAS=['New York','NYC','Manhattan','Brooklyn','SoHo NYC','Williamsburg Brooklyn','Upper East Side NYC','Lower East Side NYC','West Village NYC','Tribeca NYC','DUMBO Brooklyn','Chelsea NYC','Midtown Manhattan','Queens NYC','Long Island City NYC']
INTENTS=['Shopify jewelry brand contact email','Shopify jewellery brand contact email','fine jewelry Shopify contact email','fine jewellery Shopify contact email','demi fine jewelry Shopify contact email','gold vermeil jewelry Shopify contact email','14k gold jewelry Shopify contact email','18k gold jewelry contact email','diamond jewelry contact email','engagement rings contact email','wedding bands contact email','gemstone jewelry contact email','custom jewelry contact email','designer jewelry email','jewelry boutique email','jewelry store contact','jewelry ecommerce contact','independent jewelry brand contact email','fine jewelry boutique New York email','demi fine jewelry brand New York']
SHOPIFY_INTENTS=['Shopify jewelry brand contact email','Shopify jewellery brand contact email','fine jewelry Shopify contact email','fine jewellery Shopify contact email','demi fine jewelry Shopify contact email','gold vermeil jewelry Shopify contact email','14k gold jewelry Shopify contact email','"powered by Shopify" jewelry contact','"cdn.shopify.com" jewelry New York','"myshopify.com" fine jewelry New York','"Shopify" "fine jewelry" "New York"','"Shopify" "demi fine jewelry" "New York"']

def log(s):
    line=f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {s}"; print(line, flush=True)
    with LOG.open('a',encoding='utf-8') as f: f.write(line+'\n')

def token():
    m=re.search(r'^APIFY_API_TOKEN=(.*)$',(ROOT/'.env').read_text(errors='ignore'),re.M)
    if not m: raise SystemExit('APIFY_API_TOKEN missing')
    return m.group(1).strip().strip('"\'')

def run(cmd): return subprocess.check_output(cmd,text=True)
def sheet_values(tab=TAB, cols='A:K'):
    try:
        return json.loads(run(['gog','sheets','get',SHEET_ID,f'{tab}!{cols}','--json','--no-input'])).get('values') or []
    except Exception:
        return []
def norm_domain(u): return v.norm_domain(u)
def row_domain(r): return norm_domain(r[1]) if len(r)>1 else ''

def ensure_non_shopify_tab():
    vals=sheet_values(NON_SHOPIFY_TAB,'A:K')
    if not vals:
        try:
            run(['gog','sheets','add-tab',SHEET_ID,NON_SHOPIFY_TAB,'--no-input'])
        except Exception:
            pass
        header=[['Store Name','Link','Country','City','Category','Email','Email Source URL','Email Source Type','Platform / CMS','Verification Status','Notes']]
        run(['gog','sheets','update',SHEET_ID,f'{NON_SHOPIFY_TAB}!A1:K1','--values-json',json.dumps(header),'--input','USER_ENTERED','--json','--no-input'])

def existing_domains_all():
    domains=set()
    for tab,cols in [(TAB,'A:J'),(NON_SHOPIFY_TAB,'A:K')]:
        for r in sheet_values(tab,cols)[1:]:
            d=row_domain(r)
            if d: domains.add(d)
    return domains

def stats():
    rows=sheet_values()[1:]
    domains=[row_domain(r) for r in rows if row_domain(r)]
    non_rows=sheet_values(NON_SHOPIFY_TAB,'A:K')[1:]
    return {'total_rows':len(rows),'new_york_rows':sum(1 for r in rows if len(r)>3 and r[2].strip().lower()=='us' and r[3].strip().lower()=='new york'),'emails_found_new_york':sum(1 for r in rows if len(r)>5 and r[2].strip().lower()=='us' and r[3].strip().lower()=='new york' and r[5].strip()),'duplicate_domains':len(domains)-len(set(domains)),'non_shopify_rows':len(non_rows)}

def append_lead(lead):
    row=[[lead['Store Name'],lead['Link'],lead['Country'],lead['City'],lead['Category'],lead['Email'],lead['Email Source URL'],lead['Email Source Type'],lead['Shopify Verified'],lead['Notes']]]
    run(['gog','sheets','append',SHEET_ID,f'{TAB}!A:J','--values-json',json.dumps(row,ensure_ascii=False),'--insert','INSERT_ROWS','--input','USER_ENTERED','--json','--no-input'])

def append_non_shopify_lead(lead):
    row=[[lead['Store Name'],lead['Link'],lead['Country'],lead['City'],lead['Category'],lead['Email'],lead['Email Source URL'],lead['Email Source Type'],lead.get('Platform / CMS','Unknown'),lead.get('Verification Status','Non-Shopify jewellery store'),lead['Notes']]]
    run(['gog','sheets','append',SHEET_ID,f'{NON_SHOPIFY_TAB}!A:K','--values-json',json.dumps(row,ensure_ascii=False),'--insert','INSERT_ROWS','--input','USER_ENTERED','--json','--no-input'])

def update_row(n,row):
    run(['gog','sheets','update',SHEET_ID,f'{TAB}!A{n}:J{n}','--values-json',json.dumps([row],ensure_ascii=False),'--input','USER_ENTERED','--json','--no-input'])

def email_bad(email,link):
    if not email: return False
    e=email.lower(); ed=e.split('@')[-1]; sd=norm_domain(link)
    if ed in BAD_EMAIL_DOMAINS or any(bit in e for bit in v.BAD_EMAIL_BITS): return True
    if ed in PUBLIC_MAIL: return False
    sd2=sd.split('.')[-2:] if sd else []; ed2=ed.split('.')[-2:]
    return not (sd2 and ed2==sd2) and not (sd and (ed.endswith('.'+sd) or sd.endswith('.'+ed)))

def detect_platform(raw_all, headers_all):
    blob=(raw_all+'\n'+headers_all).lower()
    if any(sig.lower() in blob for sig in v.SHOPIFY_SIGNALS): return 'Shopify'
    if 'woocommerce' in blob or 'wp-content/plugins/woocommerce' in blob: return 'WooCommerce'
    if 'wp-content' in blob or 'wordpress' in blob: return 'WordPress'
    if 'static.parastorage.com' in blob or 'wixstatic.com' in blob or 'x-wix' in blob: return 'Wix'
    if 'squarespace' in blob: return 'Squarespace'
    if 'bigcommerce' in blob or 'stencil-utils' in blob: return 'BigCommerce'
    if 'cdn11.bigcommerce.com' in blob: return 'BigCommerce'
    return 'Unknown'

def verify_store_candidate(url, country, city, category):
    base=v.canonical(url); domain=norm_domain(base)
    if not base or not domain: return None, 'bad_url'
    raw_all=''; text_all=''; headers_all=''; soup_home=None; final=base; page_records=[]
    for path in v.CONTACT_PATHS:
        page=urljoin(base,path)
        r,raw=v.fetch(page)
        if not raw: continue
        if path=='':
            final=v.canonical(r.url) or base
            soup_home=v.BeautifulSoup(raw,'html.parser')
        headers_all += str(r.headers)+'\n'
        soup=v.BeautifulSoup(raw,'html.parser')
        text=soup.get_text(' ',strip=True)
        raw_all += raw[:180000]+'\n'
        text_all += text[:50000]+'\n'
        page_records.append((page,raw,text))
    if not raw_all: return None, 'fetch_failed'
    if not v.category_ok(text_all, category): return None, 'category_mismatch'
    platform=detect_platform(raw_all,headers_all)
    loc_ok, city_hit, country_hit = v.location_ok(text_all,country,city)
    notes=[]
    if not loc_ok: notes.append('City inferred from search; location not found on site')
    email=''; email_source_url=''; email_source_type=''
    for page,raw,text in page_records:
        emails=v.find_emails(raw+' '+text)
        if emails:
            email=emails[0]; email_source_url=page
            if 'privacy' in page: email_source_type='Privacy Policy'
            elif 'terms' in page: email_source_type='Terms Page'
            elif 'about' in page: email_source_type='About Page'
            elif 'contact' in page: email_source_type='Contact Page'
            elif page.rstrip('/') == base.rstrip('/'): email_source_type='Homepage/Footer'
            else: email_source_type='Other'
            break
    if email and email_bad(email, final or base):
        notes.append(f'Email cleared: unrelated/vendor domain detected ({email})')
        email=''; email_source_url=''; email_source_type=''
    if not email: notes.append('No public email found')
    if city_hit and country_hit: notes.append('City and country verified')
    elif city_hit: notes.append('City verified')
    elif country_hit: notes.append('Country verified; city inferred from search')
    if platform != 'Shopify': notes.append('Not Shopify; saved for separate outreach')
    name=v.extract_name(soup_home or v.BeautifulSoup(raw_all,'html.parser'), norm_domain(final))
    return {'Store Name':name,'Link':final,'Country':country,'City':city,'Category':category,'Email':email,'Email Source URL':email_source_url,'Email Source Type':email_source_type,'Shopify Verified':'Yes' if platform=='Shopify' else 'No','Platform / CMS':platform,'Verification Status':'Shopify jewellery store' if platform=='Shopify' else 'Non-Shopify jewellery store','Notes':'; '.join(notes),'Domain':norm_domain(final)}, 'ok'

def audit_appended(domains):
    vals=sheet_values(); cleared=[]; dup=[]; seen={}
    for i,row in enumerate(vals[1:],start=2):
        d=row_domain(row)
        if d:
            if d in seen: dup.append({'row':i,'domain':d,'first_row':seen[d]})
            else: seen[d]=i
        if d not in domains: continue
        row=row+['']*(10-len(row))
        if email_bad(row[5],row[1]):
            old=row[5]; row[5]=row[6]=row[7]=''; row[9]=(row[9]+'; ' if row[9] else '')+'Email cleared: fake/vendor unrelated during post-append audit'
            update_row(i,row[:10]); cleared.append({'row':i,'domain':d,'old_email':old})
    return cleared,dup

def apify_run(queries):
    payload={'queries':'\n'.join(queries),'resultsPerPage':RESULTS_PER_PAGE,'maxPagesPerQuery':1,'countryCode':'us','languageCode':'en','includeUnfilteredResults':False,'saveHtml':False,'saveHtmlToKeyValueStore':False,'includeAiOverview':False,'enableAiMode':False,'includePaidResults':False}
    r=requests.post('https://api.apify.com/v2/acts/apify~google-search-scraper/runs',params={'token':token(),'maxTotalChargeUsd':'0.50'},json=payload,timeout=60)
    log(f'Apify start status={r.status_code}')
    if r.status_code == 402:
        raise RuntimeError('Apify 402 Payment Required: google-search-scraper cannot start even with maxTotalChargeUsd=0.50')
    try:
        r.raise_for_status()
    except Exception as e:
        raise RuntimeError(f'Apify start failed status={r.status_code}: {r.text[:300]}') from e
    rid=r.json()['data']['id']; deadline=time.time()+600
    while True:
        rr=requests.get(f'https://api.apify.com/v2/actor-runs/{rid}',params={'token':token()},timeout=30); rr.raise_for_status(); data=rr.json()['data']; st=data['status']; log(f'Apify run {rid} status={st}')
        if st in ('SUCCEEDED','FAILED','ABORTED','TIMED-OUT'): break
        if time.time()>deadline: raise TimeoutError('Apify timeout')
        time.sleep(15)
    items=[]
    if data.get('defaultDatasetId'):
        ir=requests.get(f"https://api.apify.com/v2/datasets/{data['defaultDatasetId']}/items",params={'token':token(),'clean':'true','format':'json'},timeout=60); ir.raise_for_status(); items=ir.json()
    return rid,data,items,float(data.get('usageUsd') or data.get('usageTotalUsd') or data.get('chargedUsageUsd') or 0)

def candidates(items):
    out=[]; seen=set()
    for item in items:
        q=(item.get('searchQuery') or {}).get('term') or item.get('query') or ''
        for res in item.get('organicResults') or []:
            can=v.canonical(res.get('url') or res.get('link') or ''); d=norm_domain(can)
            if can and d and d not in seen:
                seen.add(d); out.append({'url':can,'domain':d,'query':q,'title':res.get('title','')})
    return out

def make_queries(batch):
    pairs=[]
    offset=(batch*7)%len(AREAS)
    areas=AREAS[offset:]+AREAS[:offset]
    intents=SHOPIFY_INTENTS if os.environ.get('SHOPIFY_FOCUSED','1')!='0' else INTENTS
    for a in areas:
        for it in intents:
            pairs.append(f'{a} {it}')
    random.Random(batch).shuffle(pairs)
    return pairs[:MAX_QUERIES]

def cat_order(c):
    s=(c.get('query','')+' '+c.get('title','')).lower()
    return ['Demi-fine Jewellery','Fine Jewellery'] if any(x in s for x in ['demi','vermeil','silver']) else ['Fine Jewellery','Demi-fine Jewellery']

def main():
    ensure_non_shopify_tab()
    all_runs=[]; start=stats(); log(f'START {start}')
    batch=START_BATCH; no_add_runs=0
    while stats()['new_york_rows'] < TARGET and batch < MAX_RUNS:
        queries=make_queries(batch); log(f'BATCH {batch+1} ny_rows={stats()["new_york_rows"]} queries={len(queries)}')
        rid,data,items,cost=apify_run(queries); cs=candidates(items)[:MAX_CANDIDATES]; log(f'Apify items={len(items)} candidates_to_verify={len(cs)} cost={cost}')
        existing=existing_domains_all()
        added=[]; non_shopify_added=[]; rejected={}
        for idx,c in enumerate(cs,1):
            if stats()['new_york_rows'] >= TARGET: break
            if c['domain'] in existing:
                rejected['duplicate_domain']=rejected.get('duplicate_domain',0)+1
                if idx % 25 == 0: log(f'PROGRESS batch={batch+1} scanned={idx}/{len(cs)} added={len(added)}')
                continue
            lead=None; reason='verify_failed'
            for cat in cat_order(c):
                lead,reason=verify_store_candidate(c['url'],'US','New York',cat)
                if lead: break
            if not lead:
                rejected[reason]=rejected.get(reason,0)+1
                if idx % 20 == 0: log(f'PROGRESS batch={batch+1} verified_candidates={idx}/{len(cs)} added={len(added)}')
                continue
            d=lead['Domain']
            if d in existing:
                rejected['duplicate_domain_after_redirect']=rejected.get('duplicate_domain_after_redirect',0)+1; continue
            if lead.get('Shopify Verified') == 'Yes':
                append_lead(lead); existing.add(d); added.append(lead)
                log(f"ADDED_SHOPIFY batch={batch+1} count={len(added)} total_ny~{stats()['new_york_rows']} {lead['Store Name']} | {lead['Link']} | {lead['Category']} | email={lead['Email'] or 'blank'}")
            else:
                append_non_shopify_lead(lead); existing.add(d); non_shopify_added.append(lead)
                log(f"ADDED_NON_SHOPIFY batch={batch+1} count={len(non_shopify_added)} {lead['Store Name']} | {lead['Link']} | platform={lead.get('Platform / CMS','Unknown')} | email={lead['Email'] or 'blank'}")
            existing=existing_domains_all()
        cleared,dups=audit_appended({a['Domain'] for a in added})
        end_batch=stats(); all_runs.append({'batch':batch+1,'run_id':rid,'cost':cost,'items':len(items),'candidates':len(cs),'added_count':len(added),'non_shopify_added_count':len(non_shopify_added),'added':added,'non_shopify_added':non_shopify_added,'reject_reasons':rejected,'cleanup_cleared':cleared,'duplicates_after_batch':dups,'stats_after':end_batch,'queries':queries})
        REPORT.write_text(json.dumps({'start':start,'latest':end_batch,'runs':all_runs},indent=2,ensure_ascii=False))
        no_add_runs = no_add_runs+1 if not (added or non_shopify_added) else 0
        if no_add_runs >= 4:
            log('Evidence of exhaustion: 4 consecutive capped Apify runs produced zero new verified leads after broad NYC/Brooklyn/Manhattan angles; stopping to avoid waste.')
            break
        batch+=1
    final=stats(); REPORT.write_text(json.dumps({'start':start,'final':final,'runs':all_runs},indent=2,ensure_ascii=False)); print(json.dumps({'start':start,'final':final,'runs':len(all_runs),'added_total':sum(r['added_count'] for r in all_runs)},indent=2))
if __name__=='__main__': main()
