#!/usr/bin/env python3
import csv, json, re, time, urllib.parse, collections, os, math
from pathlib import Path
import requests

KNOWN = ["Airoli", "Rabale", "Ghansoli", "Kopar Khairane", "Turbhe", "Vashi", "APMC", "Sanpada", "Juinagar", "Nerul", "Seawoods", "Belapur", "CBD", "Kharghar", "Kamothe", "Kalamboli", "Khandeshwar", "Panvel", "Ulwe", "Dronagiri", "Taloja", "Karanjade"]
EXCLUDE_NAMES = {'GUPTAJI BURGER AND PIZZA SANDWICH CHINESE','Junnar ambegaon misal, ulwe ,Navi Mumbai','Vihara Joyfully Veg'}
EXCLUDE_CAT = ['wholesaler','manufacturer','supplier','grocery','supermarket','medical','chemist','salon','spa','hotel']
EMAIL_RE = re.compile(r'[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}', re.I)
BAD_EMAIL_PARTS = ['example.com','domain.com','email.com','sentry.io','wixpress.com','schema.org','png@','jpg@','jpeg@','webp@']
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121 Safari/537.36"}

def normalize_website(w):
    w=(w or '').strip()
    if not w: return ''
    if w.startswith('/url?q='):
        w=urllib.parse.parse_qs(urllib.parse.urlparse(w).query).get('q',[w])[0]
    if not re.match(r'https?://', w):
        w='https://' + w
    return w

def should_keep(r):
    if r['Name'] in EXCLUDE_NAMES: return False
    cats=r.get('Categories','').lower()
    if any(x in cats for x in EXCLUDE_CAT) and not any(x in r['Name'].lower() for x in ['cafe','coffee','chai','tea','bakery','cake','waffle','mccafe','starbucks','tokai']):
        return False
    m=re.search(r'q=([0-9.\-]+),([0-9.\-]+)', r.get('Google Maps Link',''))
    if m:
        lat=float(m.group(1)); lng=float(m.group(2))
        if not (18.85 <= lat <= 19.25 and 72.88 <= lng <= 73.25): return False
    locality_text=' '.join([r.get('Area / Locality',''), r.get('Address',''), r.get('Name','')]).lower()
    if not (('navi mumbai' in locality_text) or any(k.lower() in locality_text for k in KNOWN)):
        return False
    if 'wholesaler' in cats or 'manufacturer' in cats or 'supplier' in cats:
        return False
    return True

def fetch_emails(site):
    site=normalize_website(site)
    if not site: return []
    parsed=urllib.parse.urlparse(site)
    # Skip social/search/food aggregator domains for email scraping; they rarely expose useful hiring email.
    skip_domains=['google.', 'facebook.', 'instagram.', 'swiggy.', 'zomato.', 'magicpin.', 'justdial.', 'district.in', 'tripadvisor.', 'youtube.', 'wa.me', 'maps.']
    if any(d in parsed.netloc.lower() for d in skip_domains): return []
    urls=[site]
    base=f'{parsed.scheme}://{parsed.netloc}'
    for path in ['/contact','/contact-us','/careers']:
        urls.append(base+path)
    found=[]
    for url in urls:
        try:
            resp=requests.get(url, headers=HEADERS, timeout=4, allow_redirects=True)
            if resp.status_code>=400 or 'text' not in resp.headers.get('content-type','').lower() and 'html' not in resp.headers.get('content-type','').lower():
                continue
            text=urllib.parse.unquote(resp.text)
            emails=EMAIL_RE.findall(text)
            for e in emails:
                e=e.strip('.,;:)({}[]<>').lower()
                if any(b in e for b in BAD_EMAIL_PARTS): continue
                if e not in found: found.append(e)
        except Exception:
            pass
        if found: break
        time.sleep(0.1)
    return found[:3]

def main():
    rows=list(csv.DictReader(open('/root/.openclaw/workspace/data/navi_mumbai_cafes_deep.csv')))
    rows=[r for r in rows if should_keep(r)]
    # Deduplicate
    seen=set(); final=[]
    for r in sorted(rows, key=lambda r:(r['Search Locality'], r['Name'].lower())):
        key=r.get('Google CID') or (re.sub(r'\W+','',r['Name'].lower()), re.sub(r'\W+','',r['Address'].lower())[:80])
        if key in seen: continue
        seen.add(key); final.append(r)
    cache_path=Path('/root/.openclaw/workspace/data/cafe_email_cache.json')
    cache=json.loads(cache_path.read_text()) if cache_path.exists() else {}
    websites=sorted({normalize_website(r.get('Website','')) for r in final if normalize_website(r.get('Website',''))})
    print('cafes',len(final),'phones',sum(1 for r in final if r.get('Phone')),'websites',len(websites))
    for i,w in enumerate(websites,1):
        if w not in cache:
            print(f'email {i}/{len(websites)} {w}', flush=True)
            cache[w]=fetch_emails(w)
            cache_path.write_text(json.dumps(cache,ensure_ascii=False,indent=2))
            time.sleep(0.08)
    for r in final:
        w=normalize_website(r.get('Website',''))
        emails=cache.get(w,[]) if w else []
        r['Website']=w
        r['Email']='; '.join(emails)
        r['Contact Notes']='Phone from Google Maps listing; email from official website when found' if r.get('Phone') or r.get('Email') else 'No public phone/email found in scraped data'
    out=Path('/root/.openclaw/workspace/data/navi_mumbai_cafes_contacts.csv')
    fields=['Name','Area / Locality','Address','Google Maps Link','Phone','Email','Website','Rating','Categories','Search Locality','Contact Notes','Google CID','Search Query']
    with out.open('w',newline='',encoding='utf-8') as f:
        wr=csv.DictWriter(f,fieldnames=fields); wr.writeheader(); wr.writerows(final)
    values=[['Name','Location / Area','Address','Google Maps Link','Phone','Email','Website','Rating','Categories','Search Locality','Contact Notes']]
    for r in final:
        values.append([r['Name'],r['Area / Locality'] or r['Search Locality'],r['Address'],r['Google Maps Link'],r['Phone'],r['Email'],r['Website'],r['Rating'],r['Categories'],r['Search Locality'],r['Contact Notes']])
    Path('/tmp/navi_cafes_contacts_values.json').write_text(json.dumps(values,ensure_ascii=False))
    locs=[['Locality Searched','Count in Sheet']]
    for loc,count in collections.Counter(r['Search Locality'] for r in final).most_common(): locs.append([loc,count])
    Path('/tmp/navi_cafes_contacts_localities.json').write_text(json.dumps(locs,ensure_ascii=False))
    chunk_dir=Path('/tmp/navi_cafes_contacts_chunks'); chunk_dir.mkdir(exist_ok=True)
    for fn in chunk_dir.glob('*.json'): fn.unlink()
    chunk=70
    for i in range(0,len(values),chunk):
        part=values[i:i+chunk]
        (chunk_dir/f'chunk_{i//chunk:02d}_{i+1}_{i+len(part)}.json').write_text(json.dumps(part,ensure_ascii=False))
    print('final',len(final),'phone_count',sum(1 for r in final if r.get('Phone')),'email_count',sum(1 for r in final if r.get('Email')),'chunks',math.ceil(len(values)/chunk))
    print(out)

if __name__=='__main__': main()
