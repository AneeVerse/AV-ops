#!/usr/bin/env python3
"""
Accuracy-first Shopify jewellery lead automation.
Flow: country -> city -> category -> candidate -> verify -> append immediately -> next.
Keeps stores even if email is missing, but records email source when found.
"""
import base64, csv, html, json, os, random, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import quote_plus, urlparse, parse_qs, unquote, urljoin

import requests
from bs4 import BeautifulSoup

SHEET_ID = os.environ.get('SHOPIFY_LEAD_SHEET_ID', '1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o')
TAB = os.environ.get('SHOPIFY_LEAD_TAB', 'Shopify')
TARGET_NEW = int(os.environ.get('TARGET_NEW', '50'))
MODE = os.environ.get('MODE', 'pilot')  # pilot|full
OUT_DIR = Path('/root/.openclaw/workspace/outputs/shopify_city_leads')
OUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = OUT_DIR / 'run.log'
STATE_PATH = OUT_DIR / 'state.json'
VERIFIED_CSV = OUT_DIR / 'verified_city_leads.csv'
REJECT_CSV = OUT_DIR / 'rejected_city_candidates.csv'

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
HEADERS = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9'}
TIMEOUT = int(os.environ.get('VERIFY_TIMEOUT', '12'))

COUNTRY_CITIES = {
    'US': ['New York','Los Angeles','San Francisco','Chicago','Miami','Dallas','Austin','Seattle','Boston','Atlanta'] if MODE == 'pilot' else [
        'New York','Los Angeles','San Francisco','Chicago','Miami','Dallas','Austin','Seattle','Boston','Atlanta','Houston','Washington DC','Philadelphia','Phoenix','San Diego','Denver','Portland','Nashville','Las Vegas','Charlotte','Orlando','Minneapolis','Detroit','San Jose','Scottsdale','Beverly Hills','Brooklyn','Santa Monica','Newport Beach','Palm Beach','Greenwich','Charleston','Savannah','New Orleans','Cleveland','Columbus','Indianapolis','Kansas City','Raleigh','Salt Lake City','Tampa','Fort Lauderdale','Naples','Palo Alto','Berkeley','Oakland','Sacramento','Baltimore','Pittsburgh'
    ],
    'UK': ['London','Manchester','Birmingham','Leeds','Glasgow','Edinburgh','Bristol','Liverpool','Brighton','Cambridge'] if MODE == 'pilot' else [
        'London','Manchester','Birmingham','Leeds','Glasgow','Edinburgh','Bristol','Liverpool','Brighton','Cambridge','Oxford','Bath','Nottingham','Sheffield','Newcastle','Cardiff','Belfast','York','Cheltenham','Reading','Leicester','Coventry','Southampton','Norwich','Exeter','Winchester','Guildford','Chester','Canterbury','Harrogate'
    ],
    'India': ['Mumbai','Delhi','Bengaluru','Jaipur','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad','Surat'] if MODE == 'pilot' else [
        'Mumbai','Delhi','Bengaluru','Jaipur','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad','Surat','Gurgaon','Noida','Chandigarh','Ludhiana','Lucknow','Indore','Bhopal','Kochi','Coimbatore','Vadodara','Nagpur','Udaipur','Jodhpur','Goa','Navi Mumbai','Thane','Rajkot','Mysuru','Visakhapatnam','Bhubaneswar'
    ],
}
COUNTRY_ORDER = ['US','UK','India']
CATEGORIES = ['Demi-fine Jewellery', 'Fine Jewellery']
CATEGORY_TERMS = {
    'Demi-fine Jewellery': ['demi fine jewelry','demi-fine jewelry','demi fine jewellery','demi-fine jewellery','gold vermeil jewelry','gold filled jewelry','sterling silver gold vermeil jewelry','jewelry','jewellery','jewelry store'],
    'Fine Jewellery': ['fine jewelry','fine jewellery','14k gold jewelry','18k gold jewelry','18ct gold jewellery','solid gold jewelry','diamond jewelry','diamond jewellery','lab grown diamond jewelry','jewelry','jewellery','jewelry store']
}
QUERY_PATTERNS = [
    '{country} {city} {term} Shopify',
    '{city} {term} "Powered by Shopify"',
    '{city} {term} "cdn.shopify.com"',
    '{city} {term} "Shop Pay"',
    '{city} {term} "Add to cart"',
]

BAD_DOMAINS = {
    'google.com','bing.com','duckduckgo.com','facebook.com','instagram.com','pinterest.com','youtube.com','tiktok.com','linkedin.com','twitter.com','x.com',
    'shopify.com','myshopify.com','apps.shopify.com','themes.shopify.com','help.shopify.com','partners.shopify.com',
    'yelp.com','tripadvisor.com','trustpilot.com','etsy.com','ebay.com','amazon.com','walmart.com','target.com',
    'storeleads.app','builtwith.com','similarweb.com','crunchbase.com','zoominfo.com','apollo.io','hunter.io',
    'omnisend.com','fudge.ai','magenest.com','omnithemes.com','icecubedigital.com','webinopoly.com','appbrew.com','gemfind.com','futuresoftindia.com'
}
SHOPIFY_SIGNALS = ['cdn.shopify.com','/cdn/shop/','Shopify.theme','ShopifyAnalytics','myshopify.com','shopify-section','Powered by Shopify','x-shopify']
JEWEL_TERMS = ['jewellery','jewelry','jewel','ring','rings','necklace','necklaces','earring','earrings','bracelet','bracelets','diamond','diamonds','gold','gemstone','gemstones']
DEMI_TERMS = ['demi fine','demi-fine','demifine','gold vermeil','vermeil','gold-filled','gold filled','sterling silver','semi precious','semi-precious','925 silver']
FINE_TERMS = ['fine jewellery','fine jewelry','14k','14 karat','18k','18ct','18 karat','solid gold','diamond','diamonds','gemstone','gemstones','precious','lab grown diamond','natural diamond']
EMAIL_RE = re.compile(r'(?<![\w.+-])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?![\w.+-])')
BAD_EMAIL_BITS = ['example.com','sentry','wixpress','shopify.com','schema.org','domain.com','email.com','test@','youremail','yourname','placeholder','png@','jpg@','jpeg@','2x.']
CONTACT_PATHS = ['', 'pages/contact', 'pages/contact-us', 'contact', 'pages/about-us', 'pages/about', 'pages/shipping', 'pages/privacy-policy', 'policies/privacy-policy', 'policies/terms-of-service']

CITY_HINTS = {
    'New York':['new york','nyc','brooklyn','manhattan'], 'Los Angeles':['los angeles','la,','california','beverly hills','santa monica'],
    'San Francisco':['san francisco','sf,','bay area'], 'Chicago':['chicago'], 'Miami':['miami'], 'Dallas':['dallas'], 'Austin':['austin'],
    'Seattle':['seattle'], 'Boston':['boston'], 'Atlanta':['atlanta'], 'London':['london'], 'Manchester':['manchester'],
    'Birmingham':['birmingham'], 'Leeds':['leeds'], 'Glasgow':['glasgow'], 'Edinburgh':['edinburgh'], 'Bristol':['bristol'],
    'Liverpool':['liverpool'], 'Brighton':['brighton'], 'Cambridge':['cambridge'], 'Mumbai':['mumbai','bombay'], 'Delhi':['delhi','new delhi'],
    'Bengaluru':['bengaluru','bangalore'], 'Jaipur':['jaipur'], 'Hyderabad':['hyderabad'], 'Chennai':['chennai'], 'Kolkata':['kolkata','calcutta'],
    'Pune':['pune'], 'Ahmedabad':['ahmedabad'], 'Surat':['surat']
}
COUNTRY_HINTS = {
    'US':['united states','usa','u.s.a',' us ',' california',' new york',' texas',' florida',' illinois',' washington',' georgia',' massachusetts'],
    'UK':['united kingdom',' uk ',' england',' scotland',' wales',' london',' manchester'],
    'India':['india',' maharashtra',' delhi',' karnataka',' rajasthan',' telangana',' tamil nadu',' west bengal',' gujarat']
}

def log(msg):
    line=f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with LOG_PATH.open('a',encoding='utf-8') as f: f.write(line+'\n')

def run(cmd): return subprocess.check_output(cmd, text=True)

def norm_domain(url):
    try:
        p=urlparse(url if url.startswith('http') else 'https://'+url)
        h=p.netloc.lower().split('@')[-1].split(':')[0]
        return h[4:] if h.startswith('www.') else h
    except Exception: return ''

def decode_bing_url(url):
    try:
        p=urlparse(url)
        if 'bing.com' not in p.netloc or '/ck/' not in p.path:
            return url
        u=parse_qs(p.query).get('u',[''])[0]
        if not u:
            return url
        if u.startswith('a1'):
            b=u[2:]
            b += '=' * (-len(b) % 4)
            return base64.urlsafe_b64decode(b.encode()).decode('utf-8','ignore')
        return unquote(u)
    except Exception:
        return url

def canonical(url):
    if not url: return ''
    url=decode_bing_url(url)
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
        return r,r.text[:650000]
    except Exception: return None,''

def sheet_domains():
    try:
        vals=json.loads(run(['gog','sheets','get',SHEET_ID,f'{TAB}!A2:J10000','--json','--no-input'])).get('values') or []
    except Exception: vals=[]
    domains=set()
    for r in vals:
        if len(r)>1:
            d=norm_domain(r[1])
            if d: domains.add(d)
    return domains, len(vals)

def search_ddg(query):
    return []

def search_bing(query):
    urls=[]
    url=f'https://www.bing.com/search?q={quote_plus(query)}&first=1'
    r,txt=fetch(url)
    if txt:
        soup=BeautifulSoup(txt,'html.parser')
        for a in soup.select('li.b_algo h2 a, a[href]'):
            cu=canonical(a.get('href',''))
            if cu: urls.append(cu)
    time.sleep(random.uniform(0.4,0.9))
    return urls

def clean_name(s):
    s=html.unescape(s or '').strip()
    s=re.sub(r'\s+',' ',s)
    s=re.sub(r'\s+[|–—]\s+.*$','',s).strip()
    s=re.sub(r'\s+-\s+.*$','',s).strip()
    return s[:90]

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

def find_emails(raw):
    found=[]
    for e in EMAIL_RE.findall(raw):
        e=e.strip().strip('.,;:()[]{}<>').lower()
        if any(b in e for b in BAD_EMAIL_BITS): continue
        if e not in found: found.append(e)
    return found

def category_ok(text, target_category):
    low=text.lower()
    if not any(t in low for t in JEWEL_TERMS): return False
    if target_category == 'Demi-fine Jewellery':
        return any(t in low for t in DEMI_TERMS)
    return any(t in low for t in FINE_TERMS)

def location_ok(text, country, city):
    low=' '+text.lower()+' '
    city_terms=CITY_HINTS.get(city,[city.lower()])
    country_terms=COUNTRY_HINTS.get(country,[country.lower()])
    city_hit=any(t in low for t in city_terms)
    country_hit=any(t in low for t in country_terms)
    return city_hit or country_hit, city_hit, country_hit

def verify_candidate(url, country, city, category):
    base=canonical(url); domain=norm_domain(base)
    if not base or not domain: return None, 'bad_url'
    raw_all=''; text_all=''; headers_all=''; soup_home=None; final=base
    page_records=[]
    for path in CONTACT_PATHS:
        page=urljoin(base,path)
        r,raw=fetch(page)
        if not raw: continue
        if path=='':
            final=canonical(r.url) or base
            soup_home=BeautifulSoup(raw,'html.parser')
        headers_all += str(r.headers)+'\n'
        soup=BeautifulSoup(raw,'html.parser')
        text=soup.get_text(' ',strip=True)
        raw_all += raw[:180000]+'\n'
        text_all += text[:50000]+'\n'
        page_records.append((page, raw, text))
    if not raw_all: return None, 'fetch_failed'
    shop_blob=(raw_all+headers_all).lower()
    if not any(sig.lower() in shop_blob for sig in SHOPIFY_SIGNALS): return None, 'not_shopify'
    if not category_ok(text_all, category): return None, 'category_mismatch'
    loc_ok, city_hit, country_hit = location_ok(text_all, country, city)
    notes=[]
    if not loc_ok:
        notes.append('City inferred from search; location not found on site')
    email=''; email_source_url=''; email_source_type=''
    for page, raw, text in page_records:
        emails=find_emails(raw+' '+text)
        if emails:
            email=emails[0]
            email_source_url=page
            if 'privacy' in page: email_source_type='Privacy Policy'
            elif 'terms' in page: email_source_type='Terms Page'
            elif 'about' in page: email_source_type='About Page'
            elif 'contact' in page: email_source_type='Contact Page'
            elif page.rstrip('/') == base.rstrip('/'): email_source_type='Homepage/Footer'
            else: email_source_type='Other'
            break
    if not email:
        notes.append('No public email found')
    if city_hit and country_hit: notes.append('City and country verified')
    elif city_hit: notes.append('City verified')
    elif country_hit: notes.append('Country verified; city inferred from search')
    name=extract_name(soup_home or BeautifulSoup(raw_all,'html.parser'), norm_domain(final))
    return {
        'Store Name': name,
        'Link': final,
        'Country': country,
        'City': city,
        'Category': category,
        'Email': email,
        'Email Source URL': email_source_url,
        'Email Source Type': email_source_type,
        'Shopify Verified': 'Yes',
        'Notes': '; '.join(notes),
        'Domain': norm_domain(final)
    }, 'ok'

def append_lead(lead):
    row=[[lead['Store Name'],lead['Link'],lead['Country'],lead['City'],lead['Category'],lead['Email'],lead['Email Source URL'],lead['Email Source Type'],lead['Shopify Verified'],lead['Notes']]]
    run(['gog','sheets','append',SHEET_ID,f'{TAB}!A:J','--values-json',json.dumps(row,ensure_ascii=False),'--insert','INSERT_ROWS','--input','USER_ENTERED','--json','--no-input'])
    with VERIFIED_CSV.open('a',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=list(lead.keys()))
        if f.tell()==0: w.writeheader()
        w.writerow(lead)

def reject(url, country, city, category, reason):
    with REJECT_CSV.open('a',newline='',encoding='utf-8') as f:
        w=csv.writer(f)
        if f.tell()==0: w.writerow(['url','country','city','category','reason'])
        w.writerow([url,country,city,category,reason])

def main():
    existing, current = sheet_domains()
    log(f'Start fresh city automation: current_rows={current}, existing_domains={len(existing)}, target_new={TARGET_NEW}, mode={MODE}')
    added=0
    for country in COUNTRY_ORDER:
        for city in COUNTRY_CITIES[country]:
            for category in CATEGORIES:
                for term in CATEGORY_TERMS[category]:
                    for pat in QUERY_PATTERNS:
                        query=pat.format(country=country,city=city,term=term)
                        log(f'QUERY | {country} | {city} | {category} | {query}')
                        candidates=[]
                        try: candidates += search_ddg(query)
                        except Exception as e: log(f'DDG error: {e}')
                        try: candidates += search_bing(query)
                        except Exception as e: log(f'Bing error: {e}')
                        log(f'CANDIDATES found={len(candidates)}')
                        seen=set()
                        for cand in candidates:
                            d=norm_domain(cand)
                            if not d or d in seen: continue
                            seen.add(d)
                            if d in existing:
                                reject(cand,country,city,category,'duplicate_domain')
                                continue
                            lead, reason = verify_candidate(cand,country,city,category)
                            if not lead:
                                reject(cand,country,city,category,reason)
                                continue
                            d=lead['Domain']
                            if d in existing:
                                reject(cand,country,city,category,'duplicate_domain_after_redirect')
                                continue
                            append_lead(lead)
                            existing.add(d)
                            added += 1
                            log(f'ADDED {added}/{TARGET_NEW}: {lead["Store Name"]} | {lead["Link"]} | {lead["Country"]} | {lead["City"]} | {lead["Category"]} | email={lead["Email"] or "blank"}')
                            if added >= TARGET_NEW:
                                log('Target reached')
                                return
                        time.sleep(random.uniform(0.5,1.2))
    log(f'Finished/exhausted city list. added={added}')

if __name__ == '__main__':
    main()
