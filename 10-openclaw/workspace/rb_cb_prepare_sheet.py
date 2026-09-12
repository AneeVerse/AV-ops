import json, re, csv, urllib.parse
from pathlib import Path
rows=json.load(open('/root/.openclaw/workspace/rb_cb_filtered.json'))

verbs = [
 ' secures ', ' reports ', ' expands ', ' announces ', ' plans ', ' hits ', ' unveils ', ' doubling ', ' sets ',
 ' receives ', ' uses ', ' raises ', ' bags ', ' wins ', ' approves ', ' commissions ', ' eyes ', ' posts ',
 ' q4 ', ' fy26', ' fy2026', ' fy2025', ' result', ' earnings', ' capacity', ' order book', ' subsidiary'
]
stop_prefixes=('find source','american officials','power demand','from compoundingai - earnings call digest')

def clean_title(s):
    s=s.split('\n',1)[0]
    s=re.sub(r'https?://\S+','',s)
    s=re.sub(r'^[^A-Za-z0-9₹]+','',s).strip()
    return s

def norm_company(c):
    c=re.sub(r'^[^A-Za-z0-9]+','',c)
    c=re.sub(r'\s+',' ',c).strip(' -:|')
    c=c.replace('&amp;','&')
    # keep all-caps company names readable, but avoid changing official casing too much
    if c.isupper() and len(c)>4:
        small={'LTD','LIMITED','INDIA','CO','THE','AND'}
        c=' '.join(w if w in small else w.capitalize() for w in c.split())
    return c[:90]

def extract_company(text):
    title=clean_title(text)
    low=title.lower()
    if low.startswith(stop_prefixes):
        return ''
    # Pattern: COMPANY LTD - 542904
    m=re.match(r'([A-Z0-9 &.,\-]+(?:LTD|LIMITED|BANK|COMPANY|HOLDINGS|INDIA)[A-Z0-9 &.,\-]*)\s*-\s*\d{5,6}', title)
    if m:
        return norm_company(m.group(1))
    if title.lower().startswith('from compoundingai daily digest'):
        rest=' '.join(text.split('\n')[1:4]).strip()
        title=rest or title
        low=title.lower()
    # remove leading ticker/noise
    title=re.sub(r'^[$A-Z0-9_ .-]{1,12}:\s*','',title)
    cut=len(title)
    for v in verbs:
        i=title.lower().find(v)
        if i>0:
            cut=min(cut,i)
    for sep in [':','|',';']:
        i=title.find(sep)
        if i>0:
            cut=min(cut,i)
    comp=norm_company(title[:cut])
    # handle possessive
    comp=re.sub(r"'s$",'',comp).strip()
    # reject non-company/general discussion rows
    if len(comp)<3 or comp.lower().startswith(('sekhar','india’s renewable','from compoundingai','market','china','russia','american')):
        return ''
    return comp

def context(text):
    t=re.sub(r'Disc:.*','',text,flags=re.S).strip()
    t=re.sub(r'Preview 👇.*','',t,flags=re.S).strip()
    t=re.sub(r'\s+',' ',t)
    return t[:750]

cur=[]
seen=set()
for r in rows:
    comp=extract_company(r['text'])
    if not comp:
        continue
    key=(comp.lower(), r['tweet_url'])
    if key in seen: continue
    seen.add(key)
    q=urllib.parse.quote(comp)
    screener=f'https://www.screener.in/search/?q={q}'
    confidence='Medium' if r['handle'] in ('_Investor_Feed_','compoundingaiin') else 'Low'
    note='Tweet-only extraction; verify against BSE/NSE/company filing before investment use. Propaganda risk not cleared.'
    cur.append({
        'Company name': comp,
        'Context': context(r['text']),
        'Trigger keywords': r['matched_keywords'],
        'Source handle': '@'+r['handle'] if r['handle'] else '',
        'Tweet URL': r['tweet_url'],
        'Screener': screener,
        'Verification status': 'Needs verification',
        'Confidence': confidence,
        'Notes': note,
        'Date': r['date'],
    })

Path('/root/.openclaw/workspace/rb_cb_curated.json').write_text(json.dumps(cur, ensure_ascii=False, indent=2))
with open('/root/.openclaw/workspace/rb_cb_curated.csv','w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f, fieldnames=list(cur[0].keys()) if cur else [])
    if cur: w.writeheader(); w.writerows(cur)
with open('/root/.openclaw/workspace/rb_cb_raw.csv','w',newline='',encoding='utf-8') as f:
    fields=['date','handle','matched_keywords','tweet_url','likes','retweets','views','text']
    w=csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
print('curated',len(cur),'raw',len(rows))
for x in cur[:30]: print(x['Company name'], '|', x['Trigger keywords'])
