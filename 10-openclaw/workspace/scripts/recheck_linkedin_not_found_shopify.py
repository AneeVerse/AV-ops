#!/usr/bin/env python3
import json, re, subprocess, time, urllib.parse, urllib.request
from html import unescape

SHEET_ID="1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o"
TAB="Shopify"
START_ROW=5
END_ROW=455
SLEEP=1.0
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
STOPWORDS={"the","and","co","inc","llc","ltd","limited","company","jewelry","jewellery","jewelers","jeweler","fine","ny","nyc","new","york","official","store","shop","design","designs","collection","collections","online","luxury","gifts","rings","diamonds","diamond","com"}
DESCRIPTORS={"fine","jewelry","jewellery","jewelers","jeweler","ny","nyc","new","york","store","shop","official","luxury","gifts","rings","diamonds","diamond"}

def run(cmd):
    p=subprocess.run(cmd,text=True,capture_output=True)
    if p.returncode!=0: raise RuntimeError(p.stderr or p.stdout)
    return p.stdout

def gog_get(r): return json.loads(run(["gog","sheets","get",SHEET_ID,r,"--json","--no-input"])).get("values",[])
def gog_update(cell,val): return run(["gog","sheets","update",SHEET_ID,cell,"--values-json",json.dumps([[val]],ensure_ascii=False),"--input","USER_ENTERED","--no-input"]).strip()

def slug(s):
    s=(s or "").lower().replace("&"," and ")
    s=re.sub(r"[^a-z0-9]+","-",s)
    return re.sub(r"-+","-",s).strip("-")

def toks(s, keep_short=False):
    out=[]
    for w in re.findall(r"[a-z0-9]+",(s or "").lower()):
        if w in STOPWORDS: continue
        if not keep_short and len(w)<=1: continue
        out.append(w)
    return out

def display_toks(s):
    # keep single-letter brand tokens like Lauren K
    return [w for w in re.findall(r"[a-z0-9]+",(s or "").lower()) if w not in DESCRIPTORS and w not in {"the","and","co","inc","llc","ltd","limited","company","com"}]

def domain_base(url):
    try: host=urllib.parse.urlparse(url if url.startswith("http") else "https://"+url).netloc.lower().split(":")[0]
    except Exception: return ""
    if host.startswith("www."): host=host[4:]
    return host.split(".")[0]

def fetch(url,timeout=10):
    try:
        req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"en-US,en;q=0.8"})
        with urllib.request.urlopen(req,timeout=timeout) as r:
            return r.geturl(),r.status,r.read(240000).decode("utf-8","ignore")
    except Exception:
        return url,None,""

def title(html):
    m=re.search(r"<title[^>]*>(.*?)</title>",html,re.I|re.S)
    return unescape(re.sub(r"\s+"," ",m.group(1))).strip() if m else ""

def clean_title(t): return re.sub(r"\s+"," ",t.lower().split("|")[0]).strip()

def candidates(company,website):
    base=slug(domain_base(website)); dt=display_toks(company); nt=toks(company)
    c=[]
    def add(x):
        x=slug(x)
        if x and x not in c: c.append(x)
    add(base)
    add(company)
    if len(dt)>=2: add(dt[0]+"-"+dt[1])
    if len(dt)>=3: add(dt[0]+"-"+dt[1]+"-"+dt[2])
    if len(nt)>=2: add(nt[0]+"-"+nt[1])
    # compact domain variants: laurenk -> lauren-k if company says Lauren K
    if len(dt)>=2 and len(dt[1])==1 and base==slug(dt[0]+dt[1]): add(dt[0]+"-"+dt[1])
    # shop/name prefixes, but only as candidate; validation must prove it
    for pref in ("shop","the","my","go"):
        if base.startswith(pref) and len(base)>len(pref)+3: add(base[len(pref):])
    return c

def strong_validate(url,company,website,source_slug=""):
    final,status,html=fetch(url)
    if status!=200 or "/company/" not in final: return ""
    final=final.split("?")[0].rstrip("/")+"/"
    ttl=clean_title(title(html)); raw_title=title(html).lower()
    body=unescape(re.sub(r"<[^>]+>"," ",html)).lower()
    dt=display_toks(company); nt=toks(company); base=slug(domain_base(website))
    li_slug=final.rstrip("/").split("/company/",1)[-1].lower()
    if "linkedin" not in raw_title: return ""
    # strongest: LinkedIn page body shows the website/domain
    if base and (base in body or base==li_slug or base.replace("-","")==li_slug.replace("-","")):
        # still require at least one brand token in title/body to avoid domain collisions
        if any(len(w)>1 and w in (ttl+" "+body) for w in (nt or dt)):
            return final
    # title must match at least first two visible brand tokens for multi-token companies
    if len(dt)>=2 and dt[0] in ttl and dt[1] in ttl:
        return final
    # for one-token brands only, exact title/slug can pass
    if len(dt)==1 and (ttl==dt[0] or li_slug==dt[0] or li_slug==base):
        return final
    return ""

def extract_urls(html):
    urls=[]
    for pat in [r"https?://(?:www\.)?linkedin\.com/company/[^\s\"'<>/&?#]+", r"https?%3A%2F%2Fwww\.linkedin\.com%2Fcompany%2F[^&\"'<>]+"]:
        for m in re.findall(pat,html,re.I):
            u=urllib.parse.unquote(m).split("?")[0].rstrip("/")+"/"
            u=u.replace("http://","https://")
            if u not in urls: urls.append(u)
    return urls

def search_candidates(company,website):
    qs=[f'site:linkedin.com/company "{company}"', f'"{company}" "LinkedIn" "{domain_base(website)}"', f'"{company}" "linkedin.com/company"']
    urls=[]
    for q in qs:
        for engine in ["https://www.google.com/search?q=", "https://www.bing.com/search?q=", "https://html.duckduckgo.com/html/?q="]:
            _,st,html=fetch(engine+urllib.parse.quote(q),timeout=10)
            if st in (200,202):
                for u in extract_urls(html):
                    if u not in urls: urls.append(u)
            time.sleep(0.25)
        if urls: break
    return urls

def find(company,website):
    for c in candidates(company,website):
        v=strong_validate(f"https://www.linkedin.com/company/{c}/",company,website,c)
        if v: return v
        time.sleep(0.25)
    for u in search_candidates(company,website)[:8]:
        v=strong_validate(u,company,website)
        if v: return v
        time.sleep(0.25)
    return ""

def main():
    vals=gog_get(f"{TAB}!A1:K{END_ROW}")
    checked=found=0
    for idx,row in enumerate(vals[START_ROW-1:],start=START_ROW):
        company=(row[0] if len(row)>0 else "").strip(); website=(row[1] if len(row)>1 else "").strip(); cur=(row[10] if len(row)>10 else "").strip()
        if not company or not website: continue
        if cur and cur.upper()!="NOT FOUND": continue
        checked+=1
        link=find(company,website)
        if link:
            gog_update(f"{TAB}!K{idx}",link); found+=1; status="FOUND"
        else:
            gog_update(f"{TAB}!K{idx}","NOT FOUND"); status="NOT_FOUND"
        print(json.dumps({"row":idx,"company":company,"status":status,"linkedin":link},ensure_ascii=False),flush=True)
        time.sleep(SLEEP)
    print(json.dumps({"done":True,"checked":checked,"found":found,"not_found":checked-found},ensure_ascii=False),flush=True)

if __name__=="__main__": main()
