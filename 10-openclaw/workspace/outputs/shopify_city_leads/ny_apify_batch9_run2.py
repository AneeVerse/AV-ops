#!/usr/bin/env python3
import os, sys, json, time, urllib.request, urllib.parse, importlib.util, signal
from pathlib import Path
SHEET_ID='1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o'; TAB='Shopify'; COUNTRY='US'; CITY='New York'; MAX_CHARGE='0.50'
RESULTS_PER_PAGE=10; MAX_PAGES=1; VERIFY_LIMIT=120; PER_CANDIDATE_TIMEOUT=30
QUERIES=[
('site:.com NYC fine jewelry Shopify Manhattan contact email','Fine Jewellery'),
('site:.com New York fine jewelry "Shop Pay" "contact"','Fine Jewellery'),
('site:.com Brooklyn fine jewelry "Shop Pay" contact email','Fine Jewellery'),
('site:.com Manhattan fine jewelry "Shop Pay" contact email','Fine Jewellery'),
('site:.com New York engagement rings "Shop Pay" contact','Fine Jewellery'),
('site:.com NYC engagement rings "cdn.shopify.com" email','Fine Jewellery'),
('site:.com New York diamond rings "Shop Pay" email','Fine Jewellery'),
('site:.com NYC 14k gold jewelry "Shop Pay" contact','Fine Jewellery'),
('site:.com Brooklyn 14k gold jewelry "Shop Pay" email','Fine Jewellery'),
('site:.com Manhattan 18k gold jewelry "Shop Pay" contact','Fine Jewellery'),
('site:.com NYC lab diamond jewelry Shopify contact','Fine Jewellery'),
('site:.com New York gemstone jewelry "Shop Pay" email','Fine Jewellery'),
('site:.com Brooklyn gemstone jewelry Shopify contact','Fine Jewellery'),
('site:.com NYC bridal jewelry "cdn.shopify.com" contact','Fine Jewellery'),
('site:.com New York jewelry designer "Shop Pay" email','Fine Jewellery'),
('site:.com Brooklyn jewelry designer "Shop Pay" email','Fine Jewellery'),
('site:.com Manhattan jewelry atelier Shopify email','Fine Jewellery'),
('site:.com New York gold vermeil jewelry "Shop Pay" contact','Demi-fine Jewellery'),
('site:.com NYC demi fine jewelry "Shop Pay" email','Demi-fine Jewellery'),
('site:.com Brooklyn demi fine jewelry Shopify contact','Demi-fine Jewellery'),
('site:.com New York pearl jewelry "Shop Pay" contact','Fine Jewellery'),
('site:.com NYC handmade jewelry studio "Shop Pay" email','Fine Jewellery'),
]
BAD_EMAIL_BITS=['example.com','example@','example@gmail.com','sentry','wixpress','schema.org','shopify.com','test@','youremail','yourname','placeholder','png@','jpg@','jpeg@','klaviyo','mailchimp','omnisend','gorgias','zendesk']
class Timeout(Exception): pass
def alarm_handler(signum, frame): raise Timeout('candidate_timeout')
def token():
 for l in Path('/root/.openclaw/workspace/.env').read_text().splitlines():
  if l.startswith('APIFY_API_TOKEN='): return l.split('=',1)[1].strip()
 raise RuntimeError('token missing')
def load_m():
 os.environ['SHOPIFY_LEAD_SHEET_ID']=SHEET_ID; os.environ['SHOPIFY_LEAD_TAB']=TAB; os.environ['VERIFY_TIMEOUT']=os.environ.get('VERIFY_TIMEOUT','7')
 spec=importlib.util.spec_from_file_location('m','/root/.openclaw/workspace/tools/shopify_city_lead_automation.py')
 m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
def apify():
 key=token(); actor='apify/google-search-scraper'
 body={'queries':'\n'.join(q for q,c in QUERIES),'resultsPerPage':RESULTS_PER_PAGE,'maxPagesPerQuery':MAX_PAGES,'languageCode':'en','countryCode':'us','mobileResults':False,'includeUnfilteredResults':False,'saveHtml':False,'saveHtmlToKeyValueStore':False}
 url=f'https://api.apify.com/v2/acts/{urllib.parse.quote(actor,safe="")}/runs?token={key}&maxTotalChargeUsd={MAX_CHARGE}&waitForFinish=180'
 req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(req,timeout=240) as r: run=json.load(r)['data']
 rid=run['id']
 for _ in range(72):
  run=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/actor-runs/{rid}?token={key}',timeout=30))['data']
  if run['status'] in ['SUCCEEDED','FAILED','ABORTED','TIMED-OUT']: break
  time.sleep(5)
 print('RUN', json.dumps({k:run.get(k) for k in ['id','status','defaultDatasetId','usageTotalUsd']}), flush=True)
 if run.get('status')!='SUCCEEDED': return run, []
 items=json.load(urllib.request.urlopen(f'https://api.apify.com/v2/datasets/{run["defaultDatasetId"]}/items?token={key}&clean=true', timeout=120))
 qmap={q:c for q,c in QUERIES}; urls=[]
 for item in items:
  q=item.get('searchQuery') or item.get('query') or item.get('keyword') or ''
  if isinstance(q,dict): q=q.get('term') or q.get('query') or json.dumps(q,sort_keys=True)
  cat=qmap.get(str(q),'Fine Jewellery')
  for r in item.get('organicResults',[]) or []:
   u=r.get('url')
   if u: urls.append((u,cat,str(q)))
 seen=set(); out=[]
 for u,cat,q in urls:
  h=urllib.parse.urlparse(u).netloc.lower().removeprefix('www.')
  if h and h not in seen: seen.add(h); out.append((u,cat,q))
 return run,out
def bad_email(e):
 e=(e or '').lower().strip(); return bool(e and any(b in e for b in BAD_EMAIL_BITS))
def main():
 m=load_m(); existing,current=m.sheet_domains(); print('SHEET_START',json.dumps({'rows':current,'domains':len(existing)}),flush=True)
 run,cands=apify(); print('CANDIDATES',len(cands),flush=True)
 added=rejected=skipped=timed_out=0; reasons={}
 for u,cat,q in cands[:VERIFY_LIMIT]:
  d=m.norm_domain(u)
  if not d or d in existing: skipped+=1; reasons['duplicate_domain']=reasons.get('duplicate_domain',0)+1; print('SKIP duplicate',d,flush=True); continue
  signal.signal(signal.SIGALRM, alarm_handler); signal.alarm(PER_CANDIDATE_TIMEOUT)
  try: lead,reason=m.verify_candidate(u,COUNTRY,CITY,cat)
  except Timeout: lead=None; reason='candidate_timeout'; timed_out+=1
  except Exception as e: lead=None; reason='verify_exception:'+str(e)[:80]
  finally: signal.alarm(0)
  if not lead: rejected+=1; reasons[reason]=reasons.get(reason,0)+1; print('REJECT',u,cat,reason,flush=True); continue
  if 'City verified' not in lead.get('Notes','') and 'City and country verified' not in lead.get('Notes',''):
   rejected+=1; reasons['no_city_evidence']=reasons.get('no_city_evidence',0)+1; print('REJECT',u,cat,'no_city_evidence',lead.get('Notes',''),flush=True); continue
  if lead['Domain'] in existing: skipped+=1; reasons['duplicate_domain_after_redirect']=reasons.get('duplicate_domain_after_redirect',0)+1; print('SKIP redirect duplicate',lead['Domain'],flush=True); continue
  if bad_email(lead.get('Email','')):
   old=lead.get('Email',''); lead['Email']=''; lead['Email Source URL']=''; lead['Email Source Type']=''; lead['Notes']=(lead.get('Notes','')+'; ' if lead.get('Notes') else '')+f'Email blanked as fake/plugin/vendor ({old})'
  m.append_lead(lead); existing.add(lead['Domain']); added+=1
  print('ADDED',json.dumps({'name':lead['Store Name'],'domain':lead['Domain'],'email':lead['Email'],'category':lead['Category'],'notes':lead['Notes']},ensure_ascii=False),flush=True)
 existing2,current2=m.sheet_domains(); print('SUMMARY',json.dumps({'runId':run.get('id'),'status':run.get('status'),'datasetId':run.get('defaultDatasetId'),'usageTotalUsd':run.get('usageTotalUsd'),'candidates':len(cands),'processed':min(len(cands),VERIFY_LIMIT),'added':added,'rejected':rejected,'skipped':skipped,'timed_out':timed_out,'reasons':reasons,'sheet_rows_start':current,'sheet_rows_end':current2,'domains_end':len(existing2)},ensure_ascii=False),flush=True)
if __name__=='__main__': main()
