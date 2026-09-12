#!/usr/bin/env python3
import csv, re, html, time, sys
from pathlib import Path
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

BASE = "https://1ngo.in/ngodirectory/"
OUT = Path("/root/.openclaw/workspace/outputs/ngo_directory_leads.csv")
MAX_WORKERS = 18
TIMEOUT = 25

STATE_LANG = {
    "maharashtra": "Marathi, Hindi, English",
    "karnataka": "Kannada, Hindi, English",
    "tamil nadu": "Tamil, English",
    "west bengal": "Bengali, Hindi, English",
    "uttar pradesh": "Hindi, Urdu",
    "delhi": "Hindi, English",
    "haryana": "Hindi, Haryanvi, English",
    "gujarat": "Gujarati, Hindi, English",
    "rajasthan": "Hindi, Rajasthani",
    "madhya pradesh": "Hindi",
    "telangana": "Telugu, Urdu, Hindi, English",
    "andhra pradesh": "Telugu, English",
    "kerala": "Malayalam, English",
    "odisha": "Odia, Hindi, English",
    "punjab": "Punjabi, Hindi, English",
    "bihar": "Hindi, Bhojpuri, Maithili",
    "jharkhand": "Hindi, Nagpuri, Santhali",
    "assam": "Assamese, Bengali, Hindi, English",
    "chhattisgarh": "Hindi, Chhattisgarhi",
    "uttarakhand": "Hindi, Garhwali, Kumaoni",
    "goa": "Konkani, Marathi, English",
    "manipur": "Manipuri, English",
    "meghalaya": "Khasi, Garo, English",
    "nagaland": "Nagamese, English",
    "tripura": "Bengali, Kokborok, English",
    "mizoram": "Mizo, English",
    "arunachal pradesh": "Hindi, English, local tribal languages",
    "sikkim": "Nepali, Hindi, English",
    "jammu": "Hindi, Urdu, Kashmiri",
    "kashmir": "Kashmiri, Urdu, Hindi",
}

ROLE_PRIORITY = ["president", "founder", "secretary", "director", "trustee", "chairman", "chairperson", "ceo", "coordinator", "member"]


def cf_decode(hexstr):
    try:
        data = bytes.fromhex(hexstr)
        key = data[0]
        return ''.join(chr(b ^ key) for b in data[1:])
    except Exception:
        return ""


def clean(s):
    if s is None:
        return ""
    s = html.unescape(str(s)).replace('\xa0', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    if s.lower() in {"none", "null", "nan", "nothing"}:
        return ""
    return s


def get_lines(soup):
    return [clean(x) for x in soup.get_text('\n').splitlines() if clean(x)]


def looks_like_bad_address(value):
    v = clean(value)
    low = v.lower()
    if not v:
        return True
    if low in {"contact", "contact us", "get in touch", "get involved", "email address", "phone number", "name", "submit", "none"}:
        return True
    if "@" in v or "[email" in low or "protected" in low:
        return True
    if len(v) < 5:
        return True
    return False


def extract_after_label(lines, labels):
    labels_l = [x.lower() for x in labels]
    skip = {"email address", "phone number", "mailing address", "get in touch", "name", "email", "phone", "location", "message", "submit", "get involved"}
    for i, line in enumerate(lines):
        if clean(line).lower() in labels_l:
            for nxt in lines[i+1:i+8]:
                c = clean(nxt)
                if not c or c.lower() in skip or c == "*":
                    continue
                return c
    return ""


def extract_emails(raw, soup):
    emails = set()
    for tag in soup.select('a.__cf_email__[data-cfemail], span.__cf_email__[data-cfemail]'):
        e = cf_decode(tag.get('data-cfemail', ''))
        if e:
            emails.add(e)
    for e in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', raw):
        if not any(bad in e.lower() for bad in ['bootstrap', 'slick-carousel', 'cloudflare', 'example.com']):
            emails.add(e)
    # Also handle text artifacts replaced by protected label by using decoded tags above.
    return ', '.join(sorted(emails))


def extract_phones(raw, text):
    candidates = set()
    blob = raw + '\n' + text
    # +91 / 91 / plain 10 digit Indian mobile numbers
    for m in re.finditer(r'(?:\+?91[\s\-]?)?[6-9](?:[\d\s\-]{8,15})\d', blob):
        digits = re.sub(r'\D', '', m.group(0))
        if digits.startswith('91') and len(digits) == 12:
            digits = '+91' + digits[2:]
        elif len(digits) == 10:
            digits = '+91' + digits
        else:
            continue
        if re.match(r'^\+91[6-9]\d{9}$', digits):
            candidates.add(digits)
    return ', '.join(sorted(candidates))


def extract_people(soup):
    people = []
    for card in soup.select('.card-data, .data-card, .card'):
        name_tag = card.select_one('.name_title, .card-title, .name_designation')
        if not name_tag:
            continue
        name = clean(name_tag.get_text(' ', strip=True))
        if not name or len(name) > 120:
            continue
        role_tag = card.select_one('.designation')
        role = clean(role_tag.get_text(' ', strip=True)) if role_tag else ""
        entry = f"{name} ({role})" if role else name
        low = entry.lower()
        if any(x in low for x in ['submit', 'volunteer', 'donate', 'activity']):
            continue
        if entry not in people:
            people.append(entry)
    if not people:
        return ""
    # prioritize decision makers
    def score(p):
        low = p.lower()
        for i, role in enumerate(ROLE_PRIORITY):
            if role in low:
                return i
        return 99
    people.sort(key=score)
    return '; '.join(people[:3])


def infer_language(address):
    low = address.lower()
    langs = []
    for state, lang in STATE_LANG.items():
        if state in low:
            langs.append(lang)
    return '; '.join(dict.fromkeys(langs)) or "Hindi, English"


def infer_location(address):
    a = clean(address)
    if not a:
        return ""
    low = a.lower()
    # specific city/location phrases first
    known = ["navi mumbai", "mumbai", "bengaluru", "bangalore", "mysore", "mangaluru", "pune", "thane", "nagpur", "chennai", "kolkata", "howrah", "delhi", "hyderabad", "shimoga", "shivamogga", "belagavi", "bidar", "davangere", "kalaburagi", "bagalkot", "raichur", "chitradurga", "tumakuru", "tiruchirappalli", "thoothukudi"]
    for k in known:
        if k in low:
            return k.title()
    parts = [clean(p) for p in re.split(r'[,\n-]+', a) if clean(p)]
    # remove state/country/pincode-only segments
    filtered = []
    for p in parts:
        pl = p.lower()
        if pl in STATE_LANG or pl in {'india'} or re.fullmatch(r'\d{5,6}', pl):
            continue
        filtered.append(p)
    if filtered:
        return filtered[-1][:80]
    return a[:80]


def parse_directory():
    r = requests.get(BASE, timeout=TIMEOUT)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, 'html.parser')
    table = soup.find('table')
    rows = []
    for tr in table.find_all('tr')[1:]:
        cells = tr.find_all('td')
        if len(cells) < 5:
            continue
        href = cells[1].find('a')['href'].strip() if cells[1].find('a') else ''
        name = clean(cells[2].get_text(' ', strip=True))
        address = clean(cells[3].get_text(' ', strip=True))
        cause = clean(cells[4].get_text(' ', strip=True))
        if not name:
            continue
        rows.append({
            'name_of_ngo': name,
            'directory_link': urljoin(BASE, href),
            'directory_address': address,
            'cause': cause,
        })
    return rows


def fetch_detail(row):
    url = row['directory_link']
    out = row.copy()
    out.update({
        'responsible_person': '',
        'phone_number': '',
        'email_id': '',
        'potential_language_spoken': infer_language(row.get('directory_address','')),
        'location': infer_location(row.get('directory_address','')),
        'address': row.get('directory_address',''),
        'source_url': url,
        'status': '',
    })
    try:
        if not url.startswith('http'):
            out['status'] = 'bad url'
            return out
        resp = requests.get(url, timeout=TIMEOUT, allow_redirects=True, headers={'User-Agent':'Mozilla/5.0 Aneeverse lead research'})
        out['source_url'] = resp.url
        out['status'] = str(resp.status_code)
        if resp.status_code >= 400 or not resp.text:
            return out
        soup = BeautifulSoup(resp.text, 'html.parser')
        lines = get_lines(soup)
        text = '\n'.join(lines)
        address = extract_after_label(lines, ['Mailing Address', 'Address'])
        if looks_like_bad_address(address):
            address = row.get('directory_address','')
        out['address'] = address
        out['email_id'] = extract_emails(resp.text, soup)
        out['phone_number'] = extract_phones(resp.text, text)
        # If labelled fields exist, prefer them if regex did not catch
        labelled_phone = extract_after_label(lines, ['Phone Number', 'Phone', 'Mobile'])
        if labelled_phone and not out['phone_number'] and any(ch.isdigit() for ch in labelled_phone):
            out['phone_number'] = labelled_phone
        out['responsible_person'] = extract_people(soup)
        out['potential_language_spoken'] = infer_language(address or row.get('directory_address',''))
        out['location'] = infer_location(address or row.get('directory_address',''))
        return out
    except Exception as e:
        out['status'] = f'error: {type(e).__name__}: {e}'
        return out


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = parse_directory()
    print(f'Directory rows: {len(rows)}', flush=True)
    # Test open-source ScrapeGraphAI import so this run is tied to the installed tool stack.
    from scrapegraphai.graphs import SmartScraperGraph  # noqa: F401
    print('Open-source ScrapeGraphAI import OK', flush=True)
    results = []
    start = time.time()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = [ex.submit(fetch_detail, r) for r in rows]
        for i, fut in enumerate(as_completed(futs), 1):
            results.append(fut.result())
            if i % 100 == 0:
                print(f'Fetched {i}/{len(rows)} in {time.time()-start:.1f}s', flush=True)
    results.sort(key=lambda r: rows.index(next(x for x in rows if x['name_of_ngo']==r['name_of_ngo'] and x['directory_link']==r['directory_link'])) if False else r['name_of_ngo'])
    fields = ['name_of_ngo','responsible_person','phone_number','email_id','potential_language_spoken','location','address','directory_link','source_url','cause','status']
    with OUT.open('w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in results:
            w.writerow({k: r.get(k,'') for k in fields})
    print(f'Wrote {OUT}', flush=True)
    print('Rows with phone:', sum(bool(r.get('phone_number')) for r in results), flush=True)
    print('Rows with email:', sum(bool(r.get('email_id')) for r in results), flush=True)
    print('Rows with responsible person:', sum(bool(r.get('responsible_person')) for r in results), flush=True)

if __name__ == '__main__':
    main()
