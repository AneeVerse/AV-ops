#!/usr/bin/env python3
import csv, json, re, time, html, sys
from pathlib import Path
from urllib.parse import quote_plus, urlparse, parse_qs, unquote, urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

OUT = Path('/root/.openclaw/workspace/outputs/shopify_jewellery_leads.csv')
OUT.parent.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
HEADERS = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9'}
TIMEOUT = 18
TARGET = 50

QUERIES = [
    ('Demi-fine Jewellery', '"demi fine jewellery" "Powered by Shopify"'),
    ('Demi-fine Jewellery', '"demi fine jewelry" "Powered by Shopify"'),
    ('Demi-fine Jewellery', '"demi-fine jewellery" Shopify'),
    ('Demi-fine Jewellery', '"demi-fine jewelry" Shopify'),
    ('Demi-fine Jewellery', '"gold vermeil" "Powered by Shopify" jewelry'),
    ('Demi-fine Jewellery', '"gold filled" "Powered by Shopify" jewelry'),
    ('Fine Jewellery', '"fine jewellery" "Powered by Shopify"'),
    ('Fine Jewellery', '"fine jewelry" "Powered by Shopify"'),
    ('Fine Jewellery', '"14k gold" "Powered by Shopify" jewelry'),
    ('Fine Jewellery', '"18ct gold" "Powered by Shopify" jewellery'),
    ('Fine Jewellery', '"diamond jewelry" "Powered by Shopify"'),
    ('Fine Jewellery', '"diamond jewellery" "Powered by Shopify"'),
    ('Fine Jewellery', 'best Shopify fine jewellery stores'),
    ('Demi-fine Jewellery', 'best Shopify demi fine jewellery stores'),
    ('Fine Jewellery', 'best Shopify jewelry stores fine jewelry'),

    ('Demi-fine Jewellery', '"demi fine jewelry" "Add to cart"'),
    ('Demi-fine Jewellery', '"demi fine jewellery" "Add to cart"'),
    ('Demi-fine Jewellery', '"demi-fine jewelry" "gold vermeil"'),
    ('Demi-fine Jewellery', '"demi-fine jewellery" "gold vermeil"'),
    ('Demi-fine Jewellery', '"gold vermeil jewelry" "Add to cart"'),
    ('Demi-fine Jewellery', '"gold vermeil jewellery" "Add to cart"'),
    ('Demi-fine Jewellery', '"sterling silver" "gold vermeil" jewelry store'),
    ('Fine Jewellery', '"fine jewelry" "Add to cart" "14k"'),
    ('Fine Jewellery', '"fine jewellery" "Add to cart" "18ct"'),
    ('Fine Jewellery', '"14k gold jewelry" "Add to cart"'),
    ('Fine Jewellery', '"18k gold jewelry" "Add to cart"'),
    ('Fine Jewellery', '"18ct gold jewellery" "Add to cart"'),
    ('Fine Jewellery', '"solid gold jewelry" "Add to cart"'),
    ('Fine Jewellery', '"solid gold jewellery" "Add to cart"'),
    ('Fine Jewellery', '"lab grown diamond jewelry" "Add to cart"'),
    ('Fine Jewellery', '"diamond jewellery" "Add to cart" "18ct"'),
    ('Fine Jewellery', '"fine jewelry" "cdn.shopify.com"'),
    ('Demi-fine Jewellery', '"demi fine jewelry" "cdn.shopify.com"'),
]

SEED_URLS = [
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
    'https://futuresoftindia.com/blogs/15-shopify-jewelry-stores-that-showcase-their-creativity.html',
]

BAD_DOMAINS = {
    'google.com','bing.com','duckduckgo.com','facebook.com','instagram.com','pinterest.com','youtube.com','tiktok.com','linkedin.com','twitter.com','x.com',
    'shopify.com','myshopify.com','apps.shopify.com','themes.shopify.com','omnisend.com','fudge.ai','magenest.com','omnithemes.com','suttoncommerce.co.uk','icecubedigital.com','gemfind.com','omegatheme.com','webinopoly.com','appbrew.com','futuresoftindia.com','skailama.com','ecomheroes.dev','swankyagency.com','dev.to','gempages.net','create8.co.uk','easyappsecom.com','inspiredtheme.com','shinedezigninfonet.com','sanomads.com','ecomx.co','saleshunterthemes.com','kndigital.co'
}

SHOPIFY_SIGNALS = ['cdn.shopify.com', '/cdn/shop/', 'Shopify.theme', 'ShopifyAnalytics', 'myshopify.com', 'shopify-section', 'x-shopify', 'Powered by Shopify']
DEMI_TERMS = ['demi fine','demi-fine','demifine','gold vermeil','gold-filled','gold filled','sterling silver','semi precious','semi-precious']
FINE_TERMS = ['fine jewellery','fine jewelry','14k','14 karat','18k','18ct','18 karat','solid gold','diamond','diamonds','gemstone','gemstones','precious']
JEWEL_TERMS = ['jewellery','jewelry','jewel','ring','rings','necklace','necklaces','earring','earrings','bracelet','bracelets']


def norm_domain(url):
    try:
        p=urlparse(url if url.startswith('http') else 'https://'+url)
        host=p.netloc.lower().split('@')[-1].split(':')[0]
        if host.startswith('www.'): host=host[4:]
        return host
    except Exception: return ''


def canonical(url):
    if not url: return ''
    if url.startswith('//'): url='https:'+url
    if not url.startswith('http'): url='https://'+url
    p=urlparse(url)
    host=p.netloc.lower().split('@')[-1].split(':')[0]
    if not host or '.' not in host: return ''
    if host.startswith('www.'): host=host[4:]
    if any(host==b or host.endswith('.'+b) for b in BAD_DOMAINS): return ''
    return 'https://' + host + '/'


def fetch(url):
    try:
        r=requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code >= 400: return None, ''
        return r, r.text[:600000]
    except Exception:
        return None, ''


def ddg_search(q):
    urls=[]
    for page in range(2):
        url=f'https://html.duckduckgo.com/html/?q={quote_plus(q)}&s={page*30}'
        r, txt=fetch(url)
        if not txt: continue
        soup=BeautifulSoup(txt,'html.parser')
        for a in soup.select('a.result__a, a[href]'):
            href=a.get('href','')
            if 'uddg=' in href:
                qs=parse_qs(urlparse(href).query)
                href=unquote(qs.get('uddg',[''])[0])
            cu=canonical(href)
            if cu: urls.append(cu)
        time.sleep(0.7)
    return urls


def bing_search(q):
    urls=[]
    for first in [1,11,21]:
        url=f'https://www.bing.com/search?q={quote_plus(q)}&first={first}'
        r, txt=fetch(url)
        if not txt: continue
        soup=BeautifulSoup(txt,'html.parser')
        for a in soup.select('li.b_algo h2 a, a[href]'):
            href=a.get('href','')
            cu=canonical(href)
            if cu: urls.append(cu)
        time.sleep(0.7)
    return urls


def outbound_from_article(url):
    r, txt=fetch(url)
    urls=[]
    if not txt: return urls
    soup=BeautifulSoup(txt,'html.parser')
    for a in soup.select('a[href]'):
        href=urljoin(url,a.get('href',''))
        cu=canonical(href)
        if cu: urls.append(cu)
    return urls


def clean_name(s):
    s=html.unescape(s or '')
    s=re.sub(r'\s+',' ',s).strip()
    s=re.sub(r'\s*[|–—-]\s*(Official.*|Shop.*|Jewelry.*|Jewellery.*|Fine.*|Demi.*|Online.*)$','',s, flags=re.I).strip()
    return s[:80]


def extract_name(soup, domain):
    for sel, attr in [('meta[property="og:site_name"]','content'),('meta[property="og:title"]','content'),('meta[name="application-name"]','content')]:
        tag=soup.select_one(sel)
        if tag and tag.get(attr):
            name=clean_name(tag.get(attr))
            if name and len(name)>1: return name
    if soup.title and soup.title.string:
        name=clean_name(soup.title.string)
        if name and len(name)>1: return name
    return domain.split('.')[0].replace('-',' ').title()


def score_category(text, preferred):
    low=text.lower()
    if not any(t in low for t in JEWEL_TERMS): return None, 0
    demi=sum(2 if t in ['demi fine','demi-fine','demifine'] else 1 for t in DEMI_TERMS if t in low)
    fine=sum(2 if t in ['fine jewellery','fine jewelry'] else 1 for t in FINE_TERMS if t in low)
    # Prefer explicit category query but only when supporting terms exist.
    if preferred == 'Demi-fine Jewellery' and demi:
        return preferred, demi+1
    if preferred == 'Fine Jewellery' and fine:
        return preferred, fine+1
    if demi>=2: return 'Demi-fine Jewellery', demi
    if fine>=2: return 'Fine Jewellery', fine
    if fine>=1 and any(t in low for t in ['solid gold','diamond','14k','18k','18ct']): return 'Fine Jewellery', fine
    return None, max(demi,fine)


def verify(url, preferred=''):
    domain=norm_domain(url)
    if not domain: return None
    pages=[url, urljoin(url,'collections/all'), urljoin(url,'pages/about-us')]
    combined=''
    final_url=url
    soup_home=None
    shopify=False
    for i,p in enumerate(pages):
        r, txt=fetch(p)
        if not txt: continue
        if i==0:
            final_url=canonical(r.url) or url
            soup_home=BeautifulSoup(txt,'html.parser')
        combined += '\n' + txt[:220000]
        if any(sig.lower() in txt.lower() for sig in SHOPIFY_SIGNALS) or any(k.lower() in str(r.headers).lower() for k in ['shopify']):
            shopify=True
    if not shopify: return None
    cat, score=score_category(BeautifulSoup(combined,'html.parser').get_text(' ', strip=True)[:120000] + ' ' + combined[:50000], preferred)
    if not cat: return None
    soup_home=soup_home or BeautifulSoup(combined,'html.parser')
    name=extract_name(soup_home, norm_domain(final_url))
    if len(name)<2: return None
    return {'Name': name, 'Link': final_url, 'Category': cat, 'domain': norm_domain(final_url), 'score': score}


def main():
    candidates=[]
    preferred_by_domain={}
    print('Collecting candidates...', file=sys.stderr)
    # direct seeds/articles
    for su in SEED_URLS:
        for u in outbound_from_article(su):
            d=norm_domain(u)
            if d and d not in preferred_by_domain:
                preferred_by_domain[d]=''
            candidates.append(u)
    # search results
    for cat,q in QUERIES:
        print('search', cat, q, file=sys.stderr)
        found=[]
        try: found += ddg_search(q)
        except Exception as e: print('ddg err',e,file=sys.stderr)
        try: found += bing_search(q)
        except Exception as e: print('bing err',e,file=sys.stderr)
        for u in found:
            d=norm_domain(u)
            if d and d not in preferred_by_domain:
                preferred_by_domain[d]=cat
            candidates.append(u)
    # de-dupe preserving order
    unique=[]; seen=set()
    for u in candidates:
        d=norm_domain(u)
        if not d or d in seen: continue
        seen.add(d); unique.append(u)
    print(f'Candidates: {len(unique)}', file=sys.stderr)
    leads=[]; used=set()
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs={ex.submit(verify,u,preferred_by_domain.get(norm_domain(u),'')):u for u in unique}
        for fut in as_completed(futs):
            res=fut.result()
            if not res: continue
            if res['domain'] in used: continue
            used.add(res['domain'])
            leads.append(res)
            print('OK', len(leads), res['Name'], res['Link'], res['Category'], file=sys.stderr)
            if len(leads)>=TARGET:
                break
    # sort category then name
    leads=leads[:TARGET]
    leads.sort(key=lambda x:(x['Category'], x['Name'].lower()))
    with OUT.open('w', newline='', encoding='utf-8') as f:
        w=csv.DictWriter(f, fieldnames=['Name','Link','Category'])
        w.writeheader()
        for r in leads:
            w.writerow({k:r[k] for k in ['Name','Link','Category']})
    print(json.dumps({'count':len(leads),'out':str(OUT)}, indent=2))

if __name__=='__main__': main()
