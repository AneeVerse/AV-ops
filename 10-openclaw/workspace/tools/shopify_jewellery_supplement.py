#!/usr/bin/env python3
import csv, re, html, json, sys
from pathlib import Path
from urllib.parse import urlparse, urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup

OUT='/root/.openclaw/workspace/outputs/shopify_jewellery_supplement.csv'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
H={'User-Agent':UA,'Accept-Language':'en-US,en;q=0.9'}
SHOP=['cdn.shopify.com','/cdn/shop/','Shopify.theme','ShopifyAnalytics','myshopify.com','shopify-section','Powered by Shopify']
JEW=['jewellery','jewelry','ring','necklace','earring','bracelet','diamond','gold','gemstone']
DEMI=['demi fine','demi-fine','demifine','gold vermeil','gold-filled','gold filled','sterling silver','semi precious','semi-precious']
FINE=['fine jewellery','fine jewelry','14k','14 karat','18k','18ct','18 karat','solid gold','diamond','diamonds','gemstone','gemstones','precious']
# Candidate domains from web search snippets/list articles + targeted jewellery brand discovery.
CANDIDATES='''
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
https://www.analuisa.com/
https://www.wolfcircus.com/
https://bonitojewelry.com/
https://www.nuukjewellery.com/
https://taahirajewellery.com/
https://jlheartonline.com/
https://www.camillejewelry.com/
https://www.kendrascott.com/
https://kinnstudio.com/
https://www.localeclectic.com/
https://ferkosfinejewelry.com/
https://www.nadiaandco.com/
https://www.jcojewellery.com/
https://www.linjer.co/
https://www.helloadorn.com/
https://www.melaniecasey.com/
https://www.sarahojewelry.com/
https://www.marrowfine.com/
https://www.melindamaria.com/
https://www.julievos.com/
https://www.thegoldgods.com/
https://www.alexisrussell.com/
https://www.sophiejanejewels.com/
https://www.lauracoxcollection.com/
https://www.luvaj.com/
https://www.hellonoemie.com/
https://www.danibarbe.com/
https://www.verlas.com/
https://www.aucourantparis.com/
https://www.jamesmichelle.com/
https://www.maliamills.com/
https://www.sarahandsebastian.com/
https://www.zoelev.com/
https://www.sitandwonder.co/
https://www.caitlynminimalist.com/
https://www.oakandluna.com/
https://www.edgeofember.com/
https://www.astridandmiyu.com/
https://www.missoma.com/
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
https://www.reneejewelry.com/
https://www.theclearcut.co/
https://www.lunaskye.com/
https://www.efcollection.com/
https://www.eriness.com/
https://www.katkimfinejewelry.com/
https://www.au-rate.com/
https://www.vraiandoro.com/
https://www.judithbright.com/
https://www.melissajoymanning.com/
https://www.satomikawakita.com/
https://www.kaylinhertel.com/
https://www.spinellikilcollin.com/
https://www.loganhollowell.com/
https://www.valleyrosestudio.com/
https://www.shopesqueleto.com/
https://www.merewif.com/
https://www.mirandafrye.com/
https://www.amarilo.com/
https://www.adinasjewels.com/
https://www.electricpicks.com/
https://www.nisolo.com/collections/jewelry
https://www.mignonnegavigan.com/collections/jewelry
https://www.shopnoellery.com/collections/jewelry
'''.strip().splitlines()

def canon(u):
    if not u.startswith('http'): u='https://'+u
    p=urlparse(u)
    h=p.netloc.lower()
    if h.startswith('www.'): h=h[4:]
    return 'https://'+h+'/'

def fetch(u):
    try:
        r=requests.get(u,headers=H,timeout=15,allow_redirects=True)
        if r.status_code>=400: return None,''
        return r,r.text[:500000]
    except Exception: return None,''

def name_from(soup, domain):
    for sel in ['meta[property="og:site_name"]','meta[property="og:title"]']:
        t=soup.select_one(sel)
        if t and t.get('content'):
            n=re.sub(r'\s+',' ',html.unescape(t['content'])).strip()
            n=re.sub(r'\s*[|–—-].*$','',n).strip()
            if 1<len(n)<80: return n
    if soup.title and soup.title.string:
        n=re.sub(r'\s+',' ',html.unescape(soup.title.string)).strip()
        n=re.sub(r'\s*[|–—-].*$','',n).strip()
        if 1<len(n)<80: return n
    return domain.split('.')[0].replace('-',' ').title()

def verify(u):
    base=canon(u)
    texts=[]; headers=''; soup=None; final=base
    for path in ['', 'collections/all', 'pages/about-us', 'pages/about']:
        r,t=fetch(urljoin(base,path))
        if not t: continue
        if path=='':
            final=canon(r.url); soup=BeautifulSoup(t,'html.parser')
        texts.append(t)
        headers += str(r.headers)
    raw='\n'.join(texts)
    low=raw.lower()+headers.lower()
    if not any(s.lower() in low for s in SHOP): return None
    text=BeautifulSoup(raw,'html.parser').get_text(' ',strip=True).lower()[:180000]
    if not any(j in text for j in JEW): return None
    demi=sum(1 for x in DEMI if x in text)
    fine=sum(1 for x in FINE if x in text)
    if demi==0 and fine==0:
        return None
    cat='Demi-fine Jewellery' if demi>=fine and demi>0 else 'Fine Jewellery'
    d=urlparse(final).netloc.lower().removeprefix('www.')
    if d in {'moast.io'}: return None
    return {'Name':name_from(soup or BeautifulSoup(raw,'html.parser'),d),'Link':final,'Category':cat,'domain':d,'demi':demi,'fine':fine}

def main():
    seen=set(); urls=[]
    for u in CANDIDATES:
        c=canon(u); d=urlparse(c).netloc
        if d not in seen: seen.add(d); urls.append(c)
    rows=[]; used=set()
    with ThreadPoolExecutor(max_workers=16) as ex:
        for fut in as_completed([ex.submit(verify,u) for u in urls]):
            r=fut.result()
            if r and r['domain'] not in used:
                used.add(r['domain']); rows.append(r); print('OK',len(rows),r,file=sys.stderr)
    rows.sort(key=lambda r:(r['Category'],r['Name'].lower()))
    with open(OUT,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['Name','Link','Category'])
        w.writeheader(); w.writerows([{k:r[k] for k in ['Name','Link','Category']} for r in rows])
    print(json.dumps({'count':len(rows),'out':OUT},indent=2))
if __name__=='__main__': main()
