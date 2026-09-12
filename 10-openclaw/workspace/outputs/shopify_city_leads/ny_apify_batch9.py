#!/usr/bin/env python3
import os, sys, json, time, urllib.request, urllib.parse, importlib.util, re, signal
from pathlib import Path

SHEET_ID='1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o'
TAB='Shopify'
COUNTRY='US'; CITY='New York'
MAX_CHARGE='0.50'
RESULTS_PER_PAGE=int(os.environ.get('APIFY_RESULTS_PER_PAGE','10'))
MAX_PAGES=int(os.environ.get('APIFY_MAX_PAGES','1'))
VERIFY_LIMIT=int(os.environ.get('CANDIDATE_VERIFY_LIMIT','80'))
PER_CANDIDATE_TIMEOUT=int(os.environ.get('PER_CANDIDATE_TIMEOUT','38'))

QUERIES = [
('Queens fine jewelry Shopify contact email','Fine Jewellery'),
('Queens jewelry boutique Shopify email','Fine Jewellery'),
('Long Island City jewelry Shopify email','Fine Jewellery'),
('Williamsburg jewelry Shopify contact email','Fine Jewellery'),
('DUMBO jewelry Shopify email','Fine Jewellery'),
('SoHo jewelry Shopify contact email','Fine Jewellery'),
('Lower East Side jewelry Shopify email','Fine Jewellery'),
('West Village fine jewelry Shopify contact','Fine Jewellery'),
('Upper East Side jewelry Shopify email','Fine Jewellery'),
('Tribeca jewelry Shopify contact email','Fine Jewellery'),
('New York handmade engagement rings Shopify','Fine Jewellery'),
('NYC independent jewelry designer Shopify contact','Fine Jewellery'),
('New York artisan gold jewelry Shopify email','Fine Jewellery'),
('NYC handcrafted fine jewelry Shopify contact','Fine Jewellery'),
('New York bridal jewelry Shopify email','Fine Jewellery'),
('NYC bespoke engagement ring Shopify email','Fine Jewellery'),
('New York stacking rings Shopify contact','Demi-fine Jewellery'),
('NYC charm necklace Shopify email','Demi-fine Jewellery'),
('New York gold vermeil necklace Shopify','Demi-fine Jewellery'),
('NYC pearl necklace Shopify contact','Fine Jewellery'),
('New York designer earrings Shopify email','Demi-fine Jewellery'),
('NYC gemstone earrings Shopify contact','Fine Jewellery'),
('New York jewelry studio Shopify email','Fine Jewellery'),
('NYC jewelry atelier Shopify contact','Fine Jewellery'),
('Brooklyn jewelry studio Shopify email','Fine Jewellery'),
('Manhattan jewelry studio Shopify email','Fine Jewellery'),
]

BAD_VENDOR_EMAIL_BITS = ['sentry','wixpress','schema.org','example.com','test@','youremail','yourname','placeholder','shopify.com','klaviyo','mailchimp','privy','yotpo','gorgias','zendesk','judge.me','omnisend','aftership','rechargeapps','loopreturns','okendo']

class Timeout(Exception): pass

def alarm_handler(signum, frame):
    raise Timeout('candidate_timeout')

def env_token():
    for l in Path('/root/.openclaw/workspace/.env').read_text().splitlines():
        if l.startswith('APIFY_API_TOKEN='):
            return l.split('=',1)[1].strip()
    raise RuntimeError('APIFY_API_TOKEN missing')

def apify_run(queries):
    key=env_token(); actor='apify/google-search-scraper'
    body={
      'queries':'\n'.join(q for q,c in queries),
      'resultsPerPage':RESULTS_PER_PAGE,
      'maxPagesPerQuery':MAX_PAGES,
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
    for _ in range(72):
        data=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/actor-runs/{run_id}?token={key}',timeout=30))['data']
        if data['status'] in ['SUCCEEDED','FAILED','ABORTED','TIMED-OUT']:
            run=data; break
        time.sleep(5)
    print('RUN', json.dumps({k:run.get(k) for k in ['id','status','defaultDatasetId','usageTotalUsd']}, ensure_ascii=False), flush=True)
    if run.get('status')!='SUCCEEDED':
        return run, []
    items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{run["defaultDatasetId"]}/items?token={key}&clean=true', timeout=120))
    urls=[]
    qmap={q:c for q,c in queries}
    for item in items:
        q=item.get('searchQuery') or item.get('query') or item.get('keyword') or ''
        if isinstance(q, dict):
            q=q.get('term') or q.get('query') or q.get('searchQuery') or q.get('name') or json.dumps(q, sort_keys=True)
        cat=qmap.get(str(q), 'Fine Jewellery')
        for r in item.get('organicResults',[]) or []:
            u=r.get('url')
            if u: urls.append((u,cat,q))
    seen=set(); out=[]
    for u,cat,q in urls:
        h=urllib.parse.urlparse(u).netloc.lower().removeprefix('www.')
        if h and h not in seen:
            seen.add(h); out.append((u,cat,q))
    return run, out

def dataset_candidates(dataset_id, queries):
    key=env_token()
    items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{dataset_id}/items?token={key}&clean=true', timeout=120))
    urls=[]; qmap={q:c for q,c in queries}
    for item in items:
        q=item.get('searchQuery') or item.get('query') or item.get('keyword') or ''
        if isinstance(q, dict):
            q=q.get('term') or q.get('query') or q.get('searchQuery') or q.get('name') or json.dumps(q, sort_keys=True)
        cat=qmap.get(str(q), 'Fine Jewellery')
        for r in item.get('organicResults',[]) or []:
            u=r.get('url')
            if u: urls.append((u,cat,str(q)))
    seen=set(); out=[]
    for u,cat,q in urls:
        h=urllib.parse.urlparse(u).netloc.lower().removeprefix('www.')
        if h and h not in seen:
            seen.add(h); out.append((u,cat,q))
    return out

def load_verifier():
    os.environ['SHOPIFY_LEAD_SHEET_ID']=SHEET_ID
    os.environ['SHOPIFY_LEAD_TAB']=TAB
    os.environ['VERIFY_TIMEOUT']=os.environ.get('VERIFY_TIMEOUT','8')
    spec=importlib.util.spec_from_file_location('m','/root/.openclaw/workspace/tools/shopify_city_lead_automation.py')
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

def bad_email(email, domain):
    if not email: return False
    e=email.lower()
    if any(b in e for b in BAD_VENDOR_EMAIL_BITS): return True
    ed=e.split('@')[-1]
    # keep same-domain/subdomain emails; blank obvious third-party app/platform/vendor emails
    if ed == domain or ed.endswith('.'+domain): return False
    return False

def main():
    m=load_verifier()
    existing,current=m.sheet_domains()
    print('SHEET_START', json.dumps({'rows':current,'domains':len(existing)}, ensure_ascii=False), flush=True)
    if os.environ.get('APIFY_DATASET_ID'):
        run={'id':os.environ.get('APIFY_RUN_ID','existing'), 'status':'SUCCEEDED', 'defaultDatasetId':os.environ['APIFY_DATASET_ID'], 'usageTotalUsd':None}
        candidates=dataset_candidates(run['defaultDatasetId'], QUERIES)
    else:
        run, candidates=apify_run(QUERIES)
    print('CANDIDATES', len(candidates), flush=True)
    added=0; rejected=0; skipped=0; timed_out=0
    reasons={}
    for idx,(u,cat,q) in enumerate(candidates[:VERIFY_LIMIT],1):
        d=m.norm_domain(u)
        if not d or d in existing:
            skipped+=1; reasons['duplicate_domain']=reasons.get('duplicate_domain',0)+1
            print('SKIP duplicate', d, flush=True); continue
        signal.signal(signal.SIGALRM, alarm_handler)
        signal.alarm(PER_CANDIDATE_TIMEOUT)
        try:
            lead,reason=m.verify_candidate(u,COUNTRY,CITY,cat)
        except Timeout:
            lead=None; reason='candidate_timeout'; timed_out+=1
        except Exception as e:
            lead=None; reason='verify_exception:'+str(e)[:80]
        finally:
            signal.alarm(0)
        if not lead:
            rejected+=1; reasons[reason]=reasons.get(reason,0)+1
            print('REJECT', u, cat, reason, flush=True); continue
        if os.environ.get('STRICT_CITY','1') == '1' and 'City verified' not in lead.get('Notes','') and 'City and country verified' not in lead.get('Notes',''):
            rejected+=1; reasons['no_city_evidence']=reasons.get('no_city_evidence',0)+1
            print('REJECT', u, cat, 'no_city_evidence', lead.get('Notes',''), flush=True); continue
        if lead['Domain'] in existing:
            skipped+=1; reasons['duplicate_domain_after_redirect']=reasons.get('duplicate_domain_after_redirect',0)+1
            print('SKIP redirect duplicate', lead['Domain'], flush=True); continue
        if bad_email(lead.get('Email',''), lead['Domain']):
            print('BLANK_BAD_EMAIL', lead['Domain'], lead.get('Email',''), flush=True)
            lead['Email']=''; lead['Email Source URL']=''; lead['Email Source Type']='';
            note=lead.get('Notes','')
            lead['Notes']=(note+'; ' if note else '')+'Blanked fake/plugin/vendor email'
        m.append_lead(lead)
        existing.add(lead['Domain']); added+=1
        print('ADDED', json.dumps({'name':lead['Store Name'],'domain':lead['Domain'],'email':lead['Email'] or '', 'category':lead['Category'],'notes':lead['Notes']}, ensure_ascii=False), flush=True)
    existing2,current2=m.sheet_domains()
    print('SUMMARY', json.dumps({'runId':run.get('id'),'status':run.get('status'),'datasetId':run.get('defaultDatasetId'),'usageTotalUsd':run.get('usageTotalUsd'),'candidates':len(candidates),'processed':min(len(candidates),VERIFY_LIMIT),'added':added,'rejected':rejected,'skipped':skipped,'timed_out':timed_out,'reasons':reasons,'sheet_rows_start':current,'sheet_rows_end':current2,'domains_end':len(existing2)}, ensure_ascii=False), flush=True)

if __name__=='__main__': main()
