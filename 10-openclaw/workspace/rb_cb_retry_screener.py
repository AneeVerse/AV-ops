import json, urllib.parse, urllib.request, time, re
from pathlib import Path
rows=json.load(open('/root/.openclaw/workspace/rb_cb_curated_screener_fixed.json'))
cache=json.load(open('/root/.openclaw/workspace/rb_cb_screener_cache.json'))

def search(q):
    req=urllib.request.Request('https://www.screener.in/api/company/search/?q='+urllib.parse.quote(q), headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r: return json.load(r)

def variants(company):
    vs=[]
    def add(x):
        x=re.sub(r'\s+',' ',x or '').strip(' -:|.,')
        if x and x not in vs: vs.append(x)
    add(company)
    m=re.search(r'\b(\d{6})\b', company)
    if m: add(m.group(1))
    x=re.sub(r'\s*-\s*\d{5,6}.*$','',company)
    add(x)
    x=re.sub(r'\b(LTD|LIMITED)\b.*$','Ltd',x,flags=re.I)
    add(x)
    # cut long noisy names at common separators / verbs
    x=company
    for pat in [r'\s+Q[1-4].*$', r'\s+FY\d+.*$', r'\s+Reports.*$', r'\s+Secures.*$', r'\s+Receives.*$', r'\s+Expands.*$', r'\s+Plans.*$', r'\s+Sets.*$', r'\s+Posts.*$', r'\s+Hits.*$', r'\s+Unveils.*$', r'\s+Invests.*$']:
        add(re.sub(pat,'',x,flags=re.I))
    return vs

resolved=0
for r in rows:
    if r.get('Screener'): continue
    comp=r.get('Company name','')
    picked=None; used=None; last=[]; err=None
    for v in variants(comp):
        key='retry:'+v
        if key in cache and cache[key].get('results') is not None:
            res=cache[key].get('results') or []
        else:
            while True:
                try:
                    res=search(v); err=None; break
                except Exception as e:
                    err=str(e)
                    if '429' in err:
                        print('429 sleep 8s')
                        time.sleep(8); continue
                    res=[]; break
            cache[key]={'results':res,'error':err}
            time.sleep(1.2)
        last=res
        if res:
            picked=res[0]; used=v; break
    if picked:
        r['Screener']=urllib.parse.urljoin('https://www.screener.in', picked['url'])
        r['Screener match name']=picked.get('name','')
        r['Notes']=r.get('Notes','') + f" Screener resolved from query: {used}."
        resolved+=1
print('newly resolved',resolved)
Path('/root/.openclaw/workspace/rb_cb_curated_screener_fixed.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2))
Path('/root/.openclaw/workspace/rb_cb_screener_cache.json').write_text(json.dumps(cache, ensure_ascii=False, indent=2))
un=[r.get('Company name','') for r in rows if not r.get('Screener')]
Path('/root/.openclaw/workspace/rb_cb_screener_unresolved.txt').write_text('\n'.join(sorted(set(un))))
print('total resolved',sum(1 for r in rows if r.get('Screener')),'unresolved unique',len(set(un)))
print(sorted(set(un))[:50])
