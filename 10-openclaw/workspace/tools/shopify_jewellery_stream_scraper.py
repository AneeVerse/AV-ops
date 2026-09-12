#!/usr/bin/env python3
"""
Streaming Shopify jewellery lead scraper.
- Reads existing domains from Google Sheet
- Finds candidates from direct search result pages and curated Shopify jewellery terms
- Verifies Shopify + jewellery + category
- Appends verified non-duplicate leads in batches
"""
import csv, html, json, os, random, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import quote_plus, urlparse, parse_qs, unquote, urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

SHEET_ID = os.environ.get('SHOPIFY_LEAD_SHEET_ID', '1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o')
TAB = os.environ.get('SHOPIFY_LEAD_TAB', 'Shopify')
TARGET_ADD = int(os.environ.get('TARGET_ADD', '1000'))
BATCH_SIZE = int(os.environ.get('BATCH_SIZE', '25'))
MAX_WORKERS = int(os.environ.get('MAX_WORKERS', '10'))
OUT_DIR = Path('/root/.openclaw/workspace/outputs/shopify_stream')
OUT_DIR.mkdir(parents=True, exist_ok=True)
STATE_PATH = OUT_DIR / 'state.json'
LOG_PATH = OUT_DIR / 'run.log'
FOUND_CSV = OUT_DIR / 'verified_leads.csv'
REJECT_CSV = OUT_DIR / 'rejected.csv'

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
HEADERS = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9'}
TIMEOUT = int(os.environ.get('VERIFY_TIMEOUT', '8'))

BAD_DOMAINS = {
    'google.com','bing.com','duckduckgo.com','facebook.com','instagram.com','pinterest.com','youtube.com','tiktok.com','linkedin.com','twitter.com','x.com',
    'shopify.com','myshopify.com','apps.shopify.com','themes.shopify.com','help.shopify.com','partners.shopify.com',
    'omnisend.com','fudge.ai','magenest.com','omnithemes.com','suttoncommerce.co.uk','icecubedigital.com','gemfind.com','omegatheme.com','webinopoly.com','appbrew.com','futuresoftindia.com','skailama.com','ecomheroes.dev','swankyagency.com','dev.to','gempages.net','create8.co.uk','easyappsecom.com','inspiredtheme.com','shinedezigninfonet.com','sanomads.com','ecomx.co','saleshunterthemes.com','kndigital.co','moast.io','avada.io','pagefly.io','getshogun.com','replo.app','storeleads.app','builtwith.com','similarweb.com'
}

SHOPIFY_SIGNALS = ['cdn.shopify.com', '/cdn/shop/', 'Shopify.theme', 'ShopifyAnalytics', 'myshopify.com', 'shopify-section', 'Powered by Shopify', 'x-shopify']
JEWEL_TERMS = ['jewellery','jewelry','jewel','ring','rings','necklace','necklaces','earring','earrings','bracelet','bracelets','diamond','diamonds','gold','gemstone','gemstones']
DEMI_TERMS = ['demi fine','demi-fine','demifine','gold vermeil','vermeil','gold-filled','gold filled','sterling silver','semi precious','semi-precious','925 silver']
FINE_TERMS = ['fine jewellery','fine jewelry','14k','14 karat','18k','18ct','18 karat','solid gold','diamond','diamonds','gemstone','gemstones','precious','lab grown diamond','natural diamond']

NICHES = [
    'fine jewelry','fine jewellery','demi fine jewelry','demi fine jewellery','demi-fine jewelry','demi-fine jewellery',
    'gold vermeil jewelry','gold vermeil jewellery','solid gold jewelry','solid gold jewellery','14k gold jewelry','18k gold jewelry',
    '18ct gold jewellery','diamond jewelry','diamond jewellery','lab grown diamond jewelry','personalized fine jewelry',
    'minimalist fine jewelry','everyday fine jewelry','handmade fine jewelry','ethical fine jewelry','sustainable fine jewelry',
    'sterling silver gold vermeil jewelry','dainty gold jewelry','gold filled jewelry','designer fine jewelry',
    'bridal fine jewelry','engagement rings fine jewelry','fine jewelry necklaces','fine jewelry earrings','fine jewelry rings'
]

QUERY_PATTERNS = [
    '"{niche}" "Powered by Shopify"',
    '"{niche}" "cdn.shopify.com"',
    '"{niche}" "Add to cart"',
    '"{niche}" "Shop Pay"',
    '"{niche}" "collections" "products"',
    'site:*.com "{niche}" "Powered by Shopify"',
]

CURATED_SEEDS = [
    'https://www.omnisend.com/blog/shopify-jewelry-stores/',
    'https://www.fudge.ai/blog/best-shopify-stores-jewellery/',
    'https://magenest.com/en/shopify-jewelry-stores/',
    'https://omnithemes.com/blog/ecommerce/shopify-jewelry-stores/',
    'https://www.suttoncommerce.co.uk/blog/best-fine-jewellery-shopify-stores',
    'https://www.suttoncommerce.co.uk/blog/best-fashion-jewellery-shopify-stores',
    'https://www.icecubedigital.com/blog/10-shopify-jewelry-stores-we-love/',
    'https://gemfind.com/blogs/digital-marketing/shopify-jewelry-store-examples',
    'https://www.omegatheme.com/blogs/best-jewelry-stores-on-shopify',
    'https://webinopoly.com/blogs/news/top-25-jewelry-and-accessories-stores-on-shopify',
    'https://www.appbrew.com/blogs/best-shopify-jewelry-stores',
]

MANUAL_CANDIDATES = '''
https://catbirdnyc.com/
https://maisonmiru.com/
https://stoneandstrand.com/
https://monicavinader.com/
https://ringconcierge.com/
https://lizziefortunato.com/
https://christophersjewelry.com/
https://adornmentandtheory.com/
https://campfirecouture.com/
https://idfinejewellery.com/
https://famecollective.com/
https://cornerhousej.com/
https://sweetpeajewellery.com/
https://analuisa.com/
https://wolfcircus.com/
https://bonitojewelry.com/
https://nuukjewellery.com/
https://taahirajewellery.com/
https://jlheartonline.com/
https://camillejewelry.com/
https://kendrascott.com/
https://kinnstudio.com/
https://localeclectic.com/
https://ferkosfinejewelry.com/
https://jcojewellery.com/
https://linjer.co/
https://helloadorn.com/
https://melaniecasey.com/
https://sarahojewelry.com/
https://marrowfine.com/
https://melindamaria.com/
https://julievos.com/
https://thegoldgods.com/
https://alexisrussell.com/
https://sophiejanejewels.com/
https://luvaj.com/
https://hellonoemie.com/
https://danibarbe.com/
https://verlas.com/
https://aucourantparis.com/
https://jamesmichelle.com/
https://sarahandsebastian.com/
https://zoelev.com/
https://sitandwonder.co/
https://caitlynminimalist.com/
https://oakandluna.com/
https://edgeofember.com/
https://astridandmiyu.com/
https://missoma.com/
https://mejuri.com/
https://auratenewyork.com/
https://bycharlotte.com.au/
https://moonmagic.com/
https://pippasmall.com/
https://automicgold.com/
https://babygold.com/
https://effyjewelry.com/
https://foundrae.com/
https://gorjana.com/
https://jenny-bird.com/
https://kingice.com/
https://oakgem.com/
https://pdpaola.com/
https://mintandlily.com/
https://saintvalentinejewellery.com/
https://shopshashi.com/
https://gld.com/
https://vrai.com/
https://wwake.com/
https://theclearcut.co/
https://lunaskye.com/
https://efcollection.com/
https://eriness.com/
https://katkimfinejewelry.com/
https://judithbright.com/
https://melissajoymanning.com/
https://satomikawakita.com/
https://spinellikilcollin.com/
https://loganhollowell.com/
https://valleyrosestudio.com/
https://shopesqueleto.com/
https://merewif.com/
https://mirandafrye.com/
https://amarilo.com/
https://adinasjewels.com/
https://electricpicks.com/
https://mignonnegavigan.com/
https://shopnoellery.com/
'''.strip().splitlines()

NAME_FIXES = {
    'taahirajewellery':'Taahira Jewellery', 'MIRU':'Maison Miru', 'local eclectic':'Local Eclectic',
    'Contemporary Fine Jewellery Designers in Athens':'i-D Fine Jewellery', 'Unique Engagement Rings & Fine Jewelry':'Alexis Russell',
    'Diamond Rings & Fine Jewelry':'Noémie', 'Fine Jewelry For Every Day':'Mejuri', 'by charlotte':'By Charlotte',
    'STONE AND STRAND':'Stone and Strand', 'Jewelry by Moon Magic':'Moon Magic'
}

def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with LOG_PATH.open('a', encoding='utf-8') as f: f.write(line+'\n')

def run(cmd):
    return subprocess.check_output(cmd, text=True)

def norm_domain(url):
    try:
        p = urlparse(url if url.startswith('http') else 'https://'+url)
        h = p.netloc.lower().split('@')[-1].split(':')[0]
        return h[4:] if h.startswith('www.') else h
    except Exception: return ''

def canonical(url):
    if not url: return ''
    if url.startswith('//'): url='https:'+url
    if not url.startswith('http'): return ''
    p=urlparse(url)
    h=p.netloc.lower().split('@')[-1].split(':')[0]
    if h.startswith('www.'): h=h[4:]
    if not h or '.' not in h: return ''
    if any(h==b or h.endswith('.'+b) for b in BAD_DOMAINS): return ''
    return 'https://' + h + '/'

def fetch(url):
    try:
        r=requests.get(url,headers=HEADERS,timeout=TIMEOUT,allow_redirects=True)
        if r.status_code>=400: return None,''
        return r,r.text[:700000]
    except Exception: return None,''

def existing_domains_from_sheet():
    try:
        out = run(['gog','sheets','get',SHEET_ID,f'{TAB}!A2:C5000','--json','--no-input'])
        vals=json.loads(out).get('values',[])
    except Exception as e:
        log(f'ERROR reading sheet: {e}')
        vals=[]
    domains=set()
    for row in vals:
        if len(row)>1:
            d=norm_domain(row[1])
            if d: domains.add(d)
    return domains, len(vals)

def load_state():
    if STATE_PATH.exists():
        try: return json.loads(STATE_PATH.read_text())
        except Exception: pass
    return {'queries_done': [], 'candidates_seen': [], 'added': 0, 'verified_seen': []}

def save_state(st):
    STATE_PATH.write_text(json.dumps(st, indent=2))

def ddg_search(q):
    urls=[]
    for page in range(2):
        url=f'https://html.duckduckgo.com/html/?q={quote_plus(q)}&s={page*30}'
        r,txt=fetch(url)
        if not txt: continue
        soup=BeautifulSoup(txt,'html.parser')
        for a in soup.select('a.result__a, a[href]'):
            href=a.get('href','')
            if 'uddg=' in href:
                href=unquote(parse_qs(urlparse(href).query).get('uddg',[''])[0])
            cu=canonical(href)
            if cu: urls.append(cu)
        time.sleep(random.uniform(0.3,0.8))
    return urls

def bing_search(q):
    urls=[]
    for first in [1,11,21]:
        url=f'https://www.bing.com/search?q={quote_plus(q)}&first={first}'
        r,txt=fetch(url)
        if not txt: continue
        soup=BeautifulSoup(txt,'html.parser')
        for a in soup.select('li.b_algo h2 a, a[href]'):
            cu=canonical(a.get('href',''))
            if cu: urls.append(cu)
        time.sleep(random.uniform(0.3,0.8))
    return urls

def article_outbounds(url):
    r,txt=fetch(url)
    out=[]
    if not txt: return out
    soup=BeautifulSoup(txt,'html.parser')
    for a in soup.select('a[href]'):
        cu=canonical(urljoin(url,a.get('href','')))
        if cu: out.append(cu)
    return out

def clean_name(name):
    name=html.unescape(name or '').strip()
    name=re.sub(r'\s+',' ',name)
    name=NAME_FIXES.get(name, name)
    # Avoid breaking i-D; only strip separators with spaces around them.
    name=re.sub(r'\s+[|–—]\s+.*$','',name).strip()
    name=re.sub(r'\s+-\s+.*$','',name).strip()
    return NAME_FIXES.get(name,name)[:90]

def extract_name(soup, domain):
    for sel in ['meta[property="og:site_name"]','meta[property="og:title"]','meta[name="application-name"]']:
        t=soup.select_one(sel)
        if t and t.get('content'):
            n=clean_name(t.get('content'))
            if len(n)>1: return n
    if soup.title and soup.title.string:
        n=clean_name(soup.title.string)
        if len(n)>1: return n
    return domain.split('.')[0].replace('-',' ').title()

def classify(text):
    low=text.lower()
    if not any(t in low for t in JEWEL_TERMS): return None
    demi=sum(2 if t in ['demi fine','demi-fine','demifine'] else 1 for t in DEMI_TERMS if t in low)
    fine=sum(2 if t in ['fine jewellery','fine jewelry'] else 1 for t in FINE_TERMS if t in low)
    if demi==0 and fine==0: return None
    return 'Demi-fine Jewellery' if demi>=fine and demi>=2 else 'Fine Jewellery'

def verify(url):
    base=canonical(url)
    d=norm_domain(base)
    if not base or not d: return None
    pages=[base, urljoin(base,'collections/all'), urljoin(base,'pages/about-us')]
    raw=''; headers=''; soup_home=None; final=base
    for i,p in enumerate(pages):
        r,txt=fetch(p)
        if not txt: continue
        if i==0:
            final=canonical(r.url) or base
            soup_home=BeautifulSoup(txt,'html.parser')
        raw += '\n' + txt[:180000]
        headers += str(r.headers)
    if not raw: return None
    low=raw.lower()+headers.lower()
    if not any(s.lower() in low for s in SHOPIFY_SIGNALS): return None
    text=BeautifulSoup(raw,'html.parser').get_text(' ',strip=True)[:220000]
    cat=classify(text)
    if not cat: return None
    d=norm_domain(final)
    if d in BAD_DOMAINS: return None
    name=extract_name(soup_home or BeautifulSoup(raw,'html.parser'), d)
    return {'Name': name, 'Link': final, 'Category': cat, 'Domain': d}

def append_rows(rows):
    if not rows: return
    vals=[[r['Name'], r['Link'], r['Category']] for r in rows]
    payload=json.dumps(vals, ensure_ascii=False)
    out=run(['gog','sheets','append',SHEET_ID,f'{TAB}!A:C','--values-json',payload,'--insert','INSERT_ROWS','--input','USER_ENTERED','--json','--no-input'])
    log(f'APPENDED {len(rows)} rows: {out.strip()[:220]}')
    with FOUND_CSV.open('a', newline='', encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['Name','Link','Category','Domain'])
        if f.tell()==0: w.writeheader()
        w.writerows(rows)

def main():
    state=load_state()
    existing, current_count = existing_domains_from_sheet()
    existing |= set(state.get('verified_seen', []))
    log(f'Start: current_sheet_rows={current_count}, existing_domains={len(existing)}, target_add={TARGET_ADD}')
    candidates=[]
    # curated links first
    for u in MANUAL_CANDIDATES:
        cu=canonical(u)
        if cu: candidates.append(cu)
    for seed in CURATED_SEEDS:
        log(f'Article seed: {seed}')
        candidates.extend(article_outbounds(seed))
    # search queries stream
    queries=[]
    for niche in NICHES:
        for pat in QUERY_PATTERNS:
            queries.append(pat.format(niche=niche))
    random.shuffle(queries)

    batch=[]; added=0; processed_domains=set(state.get('candidates_seen', []))

    def handle_candidates(cands):
        nonlocal batch, added, existing, processed_domains
        unique=[]
        for u in cands:
            d=norm_domain(u)
            if not d or d in existing or d in processed_domains: continue
            processed_domains.add(d); unique.append(u)
        if not unique: return
        log(f'Verifying {len(unique)} candidates')
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futs={ex.submit(verify,u):u for u in unique}
            for fut in as_completed(futs):
                r=fut.result()
                if not r: continue
                d=r['Domain']
                if d in existing: continue
                existing.add(d)
                batch.append(r)
                added += 1
                log(f'QUALIFIED {added}/{TARGET_ADD}: {r["Name"]} | {r["Link"]} | {r["Category"]}')
                if len(batch)>=BATCH_SIZE:
                    append_rows(batch); batch=[]
                if added>=TARGET_ADD:
                    return

    handle_candidates(candidates)
    state['candidates_seen']=list(processed_domains)[-20000:]
    state['verified_seen']=list(existing)[-20000:]
    save_state(state)
    for q in queries:
        if added>=TARGET_ADD: break
        if q in state.get('queries_done',[]): continue
        log(f'Search: {q}')
        found=[]
        try: found.extend(ddg_search(q))
        except Exception as e: log(f'DDG error: {e}')
        try: found.extend(bing_search(q))
        except Exception as e: log(f'Bing error: {e}')
        state.setdefault('queries_done',[]).append(q)
        handle_candidates(found)
        state['candidates_seen']=list(processed_domains)[-20000:]
        state['verified_seen']=list(existing)[-20000:]
        state['added']=state.get('added',0)+added
        save_state(state)
        time.sleep(random.uniform(0.5,1.5))
    if batch:
        append_rows(batch)
    existing2, final_count = existing_domains_from_sheet()
    log(f'Done/paused: added_this_run={added}, final_sheet_rows={final_count}, duplicate_guard_domains={len(existing2)}')

if __name__=='__main__':
    main()
