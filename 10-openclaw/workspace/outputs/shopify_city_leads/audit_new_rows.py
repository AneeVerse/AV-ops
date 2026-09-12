#!/usr/bin/env python3
import json, subprocess, re, requests, bs4, sys, time
from urllib.parse import urljoin
SHEET='1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36'
PATHS=['','pages/contact','pages/contact-us','pages/about','pages/about-us','pages/stockists','pages/visit','pages/locations','pages/stores','policies/privacy-policy']
rows=json.loads(subprocess.check_output(['gog','sheets','get',SHEET,'Shopify!A416:J443','--json','--no-input'], text=True)).get('values',[])
for idx,r in enumerate(rows,416):
    if len(r)<2: continue
    base=r[1]
    blob=''
    for p in PATHS:
        try:
            resp=requests.get(urljoin(base,p),headers={'User-Agent':UA},timeout=5,allow_redirects=True)
            if resp.status_code>=400: continue
            soup=bs4.BeautifulSoup(resp.text[:300000],'html.parser')
            text=soup.get_text(' ',strip=True)
            blob += ' '+text[:20000]
        except Exception: pass
    low=blob.lower()
    hits=[]
    for term in ['new york','nyc','brooklyn','manhattan','larchmont','tribeca','soho','upper east','madison avenue','5th avenue','fifth avenue','47th street','diamond district']:
        if term in low: hits.append(term)
    # snippets around first few hits
    snippets=[]
    for term in hits[:5]:
        pos=low.find(term)
        snippets.append(re.sub(r'\s+',' ',blob[max(0,pos-90):pos+160]))
    print(json.dumps({'row':idx,'name':r[0],'domain':r[1],'email':r[5] if len(r)>5 else '', 'hits':hits,'snippets':snippets[:3]}, ensure_ascii=False), flush=True)
