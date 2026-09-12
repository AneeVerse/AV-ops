import json, urllib.parse, urllib.request, time, re
from pathlib import Path

IN='/root/.openclaw/workspace/rb_cb_curated.json'
OUT='/root/.openclaw/workspace/rb_cb_curated_screener_fixed.json'
rows=json.load(open(IN))

suffix_re=re.compile(r'\b(ltd|limited|india|company|co|industries|industry|corp|corporation|bank|holdings|holding|energy|energies|engineering|engineers|infra|infrastructure|technologies|technology|pharmaceuticals|healthcare|finance|financial|services|solar|power|green)\b', re.I)

def norm(s):
    s=(s or '').lower().replace('&','and')
    s=re.sub(r'[^a-z0-9 ]+',' ',s)
    s=suffix_re.sub(' ',s)
    s=re.sub(r'\s+',' ',s).strip()
    return s

def search(company):
    q=urllib.parse.quote(company)
    url=f'https://www.screener.in/api/company/search/?q={q}'
    req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

def choose(company, results):
    if not results:
        return None
    cn=norm(company)
    # Prefer exact-ish normalized match, then first result
    scored=[]
    for i,x in enumerate(results):
        rn=norm(x.get('name',''))
        score=0
        if cn and rn:
            if cn==rn: score+=100
            if cn in rn or rn in cn: score+=60
            cset=set(cn.split()); rset=set(rn.split())
            if cset and rset:
                score+=int(40*len(cset&rset)/len(cset|rset))
        scored.append((score,-i,x))
    scored.sort(reverse=True, key=lambda t:(t[0],t[1]))
    if scored[0][0] < 20:
        return None
    return scored[0][2]

cache={}
unresolved=[]
resolved=0
for r in rows:
    company=r.get('Company name','').strip()
    if not company:
        unresolved.append(company); continue
    if company not in cache:
        try:
            res=search(company)
            pick=choose(company,res)
            cache[company]={'results':res,'pick':pick}
        except Exception as e:
            cache[company]={'error':str(e),'pick':None,'results':[]}
        time.sleep(0.08)
    pick=cache[company].get('pick')
    if pick:
        r['Screener']=urllib.parse.urljoin('https://www.screener.in', pick['url'])
        r['Screener match name']=pick.get('name','')
        resolved+=1
    else:
        r['Screener']=''
        r['Screener match name']='UNRESOLVED'
        unresolved.append(company)

Path(OUT).write_text(json.dumps(rows, ensure_ascii=False, indent=2))
Path('/root/.openclaw/workspace/rb_cb_screener_cache.json').write_text(json.dumps(cache, ensure_ascii=False, indent=2))
Path('/root/.openclaw/workspace/rb_cb_screener_unresolved.txt').write_text('\n'.join(sorted(set(unresolved))))
print('rows',len(rows),'resolved',resolved,'unresolved',len(set(unresolved)))
print('sample unresolved:', sorted(set(unresolved))[:30])
