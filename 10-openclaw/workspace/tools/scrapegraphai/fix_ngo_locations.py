#!/usr/bin/env python3
import csv, re, time, json
from pathlib import Path
from collections import Counter
import requests

SRC = Path('/root/.openclaw/workspace/outputs/ngo_call_ready_crm_leads.csv')
OUT = Path('/root/.openclaw/workspace/outputs/ngo_call_ready_crm_leads_location_cleaned.csv')
CACHE = Path('/root/.openclaw/workspace/outputs/pincode_location_cache.json')

STATE_NAMES = {
    'andhra pradesh','arunachal pradesh','assam','bihar','chhattisgarh','goa','gujarat','haryana','himachal pradesh','jharkhand','karnataka','kerala','madhya pradesh','maharashtra','manipur','meghalaya','mizoram','nagaland','odisha','orissa','punjab','rajasthan','sikkim','tamil nadu','telangana','tripura','uttar pradesh','uttarakhand','west bengal','delhi','jammu and kashmir','ladakh','puducherry','chandigarh','india'
}

KNOWN_PLACES = [
    'Navi Mumbai','Mumbai','Thane','Pune','Nagpur','Nashik','Aurangabad','Kolhapur','Solapur','Satara','Sangli','Ahmednagar',
    'Bengaluru','Bangalore','Mainpuri','Hanamkonda','Hanmakonda','Baghpat','Daltonganj','Palamu','Kalaburgi','Mysuru','Mysore','Mangaluru','Mangalore','Hubballi','Hubli','Dharwad','Belagavi','Belgaum','Bidar','Kalaburagi','Gulbarga','Raichur','Bagalkot','Chitradurga','Tumakuru','Tumkur','Shivamogga','Shimoga','Davangere','Haveri','Kolar','Mandya','Udupi','Chamarajanagar','Ramanagara','Chikkaballapur','Vijayapura','Bijapur','Koppal','Gadag','Sirsi','Sindhanur','Ranebennur','Chikkamagaluru','Chikmagalur','Kushtagi','Navalgund','Kundapura','Moodabidri','Karkala','Davanagere',
    'Chennai','Coimbatore','Madurai','Tiruchirappalli','Trichy','Thoothukudi','Tirunelveli','Tenkasi','Salem','Erode','Vellore',
    'Kolkata','Howrah','Bardhaman','Burdwan','Hooghly','Darjeeling','Siliguri','Murshidabad',
    'Delhi','New Delhi','Noida','Ghaziabad','Gurugram','Gurgaon','Faridabad',
    'Hyderabad','Secunderabad','Warangal','Nizamabad','Karimnagar',
    'Ahmedabad','Surat','Vadodara','Rajkot','Bhavnagar','Jamnagar','Junagadh',
    'Jaipur','Jodhpur','Udaipur','Ajmer','Kota','Bikaner',
    'Lucknow','Kanpur','Varanasi','Agra','Prayagraj','Allahabad','Gorakhpur','Meerut','Bareilly','Shravasti','Ikauna',
    'Patna','Gaya','Muzaffarpur','Bettiah','Bhagalpur','Purnea',
    'Bhopal','Indore','Jabalpur','Gwalior','Ujjain',
    'Bhubaneswar','Cuttack','Puri','Sambalpur','Jagatsinghpur','Kujang',
    'Guwahati','Dibrugarh','Silchar','Jorhat',
    'Kochi','Ernakulam','Thiruvananthapuram','Kozhikode','Thrissur',
    'Ranchi','Jamshedpur','Dhanbad','Bokaro',
    'Dehradun','Haridwar','Rishikesh',
]

BAD_LOCATION_WORDS = {'contact','contact us','india','india.','karnataka','karnataka.','maharashtra','maharashtra.','tamil nadu','west bengal','uttar pradesh','assam','odisha','orissa'}


def clean(s):
    s = re.sub(r'\s+', ' ', (s or '').replace('\xa0',' ')).strip(' ,.-')
    return s


def title_place(s):
    s = clean(s)
    # common fixes
    repl = {
        'bangalore': 'Bengaluru', 'shimoga': 'Shivamogga', 'mysore': 'Mysuru', 'gulbarga': 'Kalaburagi', 'kalaburgi': 'Kalaburagi', 'belgaum': 'Belagavi', 'bijapur': 'Vijayapura', 'orissa': 'Odisha', 'tamilnadu': 'Tamil Nadu', 'hanmakonda': 'Hanamkonda'
    }
    low = s.lower()
    if low in repl:
        return repl[low]
    return ' '.join(w.capitalize() if not w.isupper() else w for w in s.split())


def is_bad_location(loc):
    low = clean(loc).lower()
    return (not low) or bool(re.search(r'\d{5,6}', low)) or low in BAD_LOCATION_WORDS or '@' in low or low.startswith('india ')


def known_place_from_text(text):
    low = text.lower()
    hits = []
    for place in KNOWN_PLACES:
        if re.search(r'\b' + re.escape(place.lower()) + r'\b', low):
            hits.append(place)
    if not hits:
        return ''
    # prefer longer/more specific, first occurrence as tie-breaker
    hits.sort(key=lambda p: (-len(p), low.find(p.lower())))
    return title_place(hits[0])


def district_from_text(text):
    patterns = [
        r'\b([A-Za-z ]{3,40})\s+District\b',
        r'\b([A-Za-z ]{3,40})\s+Dist\.?\b',
        r'\bDist\.?\s*[:\-]?\s*([A-Za-z ]{3,40})',
        r'\bDistrict\s*[:\-]?\s*([A-Za-z ]{3,40})',
    ]
    for pat in patterns:
        m = re.search(pat, text, flags=re.I)
        if m:
            val = m.group(1)
            val = re.sub(r'\b(karnataka|maharashtra|india|tamil nadu|tamilnadu|west bengal|odisha|orissa|uttar pradesh|telangana|assam)\b.*','',val,flags=re.I)
            val = re.sub(r'\d.*','',val)
            val = clean(val)
            # keep last word group when prefix contains address words
            val = re.sub(r'.*\b(at|post|po|village|near|road|layout|colony)\b\s+', '', val, flags=re.I)
            if val and val.lower() not in STATE_NAMES and len(val) <= 35 and val.lower() != 'rict':
                return title_place(val)
    return ''


def pincode_from_text(text):
    pins = re.findall(r'\b[1-9]\d{5}\b', text or '')
    return pins[-1] if pins else ''


def load_cache():
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    return {}


def save_cache(cache):
    CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False))


def pincode_lookup(pin, cache):
    if not pin:
        return ''
    if pin in cache:
        return cache[pin]
    try:
        r = requests.get(f'https://api.postalpincode.in/pincode/{pin}', headers={'User-Agent':'Mozilla/5.0'}, timeout=12)
        data = r.json()
        val = ''
        if data and data[0].get('Status') == 'Success' and data[0].get('PostOffice'):
            po = data[0]['PostOffice'][0]
            # District is more call-friendly than raw pincode; if district generic, use post office name.
            val = po.get('District') or po.get('Block') or po.get('Name') or ''
            val = title_place(val)
        cache[pin] = val
        time.sleep(0.08)
        return val
    except Exception:
        cache[pin] = ''
        return ''


def segment_fallback(address):
    if not address:
        return ''
    # remove pincodes and country/state words, then inspect useful comma parts from right to left
    parts = [clean(p) for p in re.split(r'[,;|\n]+', address) if clean(p)]
    candidates = []
    for p in parts:
        p2 = re.sub(r'\b[1-9]\d{5}\b','',p)
        p2 = re.sub(r'\b(India|Karnataka|Maharashtra|Tamil Nadu|West Bengal|Uttar Pradesh|Odisha|Orissa|Assam|Delhi|Telangana|Andhra Pradesh|Kerala|Gujarat|Rajasthan|Madhya Pradesh|Bihar|Jharkhand|Punjab|Haryana)\b','',p2,flags=re.I)
        p2 = clean(p2)
        if not p2 or len(p2) < 3 or re.fullmatch(r'\d+',p2):
            continue
        # reject house numbers, addresses, layout/road fragments and symbol-heavy fragments
        if re.search(r'[0-9#()/:]', p2):
            continue
        if any(x in p2.lower() for x in ['near ', 'opposite', 'floor', 'road', 'street', 'ward no', 'house no', 'building', 'colony', 'layout', 'post', 'po ', 'c/o', 'nilaya', 'temple', 'main road', 'office', 'admin', 'administrative']):
            continue
        # prefer short place-like segments only
        if len(p2.split()) > 4:
            continue
        candidates.append(p2)
    if candidates:
        return title_place(candidates[-1][:40])
    return ''


def better_location(row, cache):
    loc = clean(row.get('location'))
    addr = clean(row.get('address'))
    blob = f'{loc}, {addr}'
    # If current location is already clean and not too generic, preserve it unless a known place is more specific.
    if not is_bad_location(loc):
        kp = known_place_from_text(blob)
        if kp and kp.lower() != loc.lower() and loc.lower() in STATE_NAMES:
            return kp
        return title_place(loc)
    return (
        known_place_from_text(blob)
        or district_from_text(blob)
        or segment_fallback(addr)
        or ''
    )


def main():
    cache = load_cache()
    with SRC.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)
    changed = 0
    still_bad = 0
    for r in rows:
        old = r.get('location','')
        new = better_location(r, cache)
        if new and new != old:
            r['location'] = new
            changed += 1
        if is_bad_location(r.get('location','')):
            still_bad += 1
    rows.sort(key=lambda r: ((clean(r.get('location')) or 'zzzzzz').lower(), clean(r.get('organization_name')).lower()))
    with OUT.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader(); w.writerows(rows)
    save_cache(cache)
    print('rows', len(rows))
    print('locations_changed', changed)
    print('still_bad_locations', still_bad)
    print('unique_locations', len(set(clean(r.get('location')) for r in rows if clean(r.get('location')))))
    print('top_locations')
    for k,v in Counter(clean(r.get('location')) or '(blank)' for r in rows).most_common(20):
        print(k, v)
    print('output', OUT)

if __name__ == '__main__':
    main()
