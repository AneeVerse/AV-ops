#!/usr/bin/env python3
import csv, re
from pathlib import Path
from urllib.parse import urlparse

SRC = Path('/root/.openclaw/workspace/outputs/ngo_directory_leads.csv')
OUT = Path('/root/.openclaw/workspace/outputs/ngo_call_ready_crm_leads.csv')

BAD_NAME_TERMS = [
    'demo', 'test ngo', 'dummy', 'sample', 'testing', 'demo site', 'nothing',
]

STATE_CITY_PRIORITY = [
    'Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Nagpur', 'Maharashtra',
    'Bengaluru', 'Bangalore', 'Karnataka', 'Delhi', 'Hyderabad', 'Chennai', 'Kolkata'
]


def clean(s):
    s = (s or '').strip()
    s = re.sub(r'\s+', ' ', s)
    return s


def phones_valid(phone_field):
    phones = []
    for p in re.split(r'[,;]', phone_field or ''):
        p = clean(p)
        if re.fullmatch(r'\+91[6-9]\d{9}', p):
            phones.append(p)
    # dedupe preserving order
    out = []
    for p in phones:
        if p not in out:
            out.append(p)
    return out


def is_1ngo_host(url):
    try:
        host = urlparse(url).hostname or ''
        return host == '1ngo.in' or host.endswith('.1ngo.in')
    except Exception:
        return False


def has_custom_website(row):
    # If final source_url is not on 1ngo domain, assume they may already have own website.
    source = clean(row.get('source_url'))
    directory = clean(row.get('directory_link'))
    if source and not is_1ngo_host(source):
        return True
    if directory and not is_1ngo_host(directory):
        return True
    return False


def bad_name(name):
    low = name.lower()
    return any(term in low for term in BAD_NAME_TERMS)


def location_score(row):
    blob = ' '.join([row.get('location',''), row.get('address','')]).lower()
    for i, term in enumerate(STATE_CITY_PRIORITY):
        if term.lower() in blob:
            return 100 - i
    return 0


def lead_score(row, phones):
    score = 0
    score += 50 if phones else 0
    score += 20 if clean(row.get('responsible_person')) else 0
    score += 10 if clean(row.get('email_id')) else 0
    score += 10 if clean(row.get('address')) else 0
    score += location_score(row)
    if len(phones) > 1:
        score += 5
    return score


def short_person(person):
    person = clean(person)
    if not person:
        return ''
    # First listed person is usually strongest after previous prioritization.
    return clean(person.split(';')[0])


def main():
    with SRC.open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))

    kept = []
    skipped = {'no_phone':0, 'custom_website':0, 'bad_name':0, 'bad_status':0}
    for r in rows:
        name = clean(r.get('name_of_ngo'))
        phones = phones_valid(r.get('phone_number',''))
        if not phones:
            skipped['no_phone'] += 1
            continue
        if bad_name(name):
            skipped['bad_name'] += 1
            continue
        if has_custom_website(r):
            skipped['custom_website'] += 1
            continue
        status = clean(r.get('status'))
        if status and not (status.startswith('200') or status.startswith('403') or status.startswith('error')):
            # Keep 403/error if directory data still has phone; call may still be valid.
            skipped['bad_status'] += 1
            continue
        current_page = clean(r.get('source_url')) or clean(r.get('directory_link'))
        score = lead_score(r, phones)
        lang = clean(r.get('potential_language_spoken'))
        location = clean(r.get('location'))
        address = clean(r.get('address'))
        person = short_person(r.get('responsible_person'))
        kept.append({
            'crm_lead_name': name,
            'organization_name': name,
            'responsible_person': person,
            'all_responsible_people_found': clean(r.get('responsible_person')),
            'primary_phone': phones[0],
            'all_phone_numbers': ', '.join(phones),
            'email_id': clean(r.get('email_id')),
            'potential_language_spoken': lang,
            'location': location,
            'address': address,
            'current_1ngo_page': current_page,
            'directory_link': clean(r.get('directory_link')),
            'cause': clean(r.get('cause')),
            'pitch_angle': 'Currently using 1NGO subdomain/page; pitch independent website + own domain + donation/contact forms.',
            'call_status': 'Not Called',
            'crm_stage': 'Lead - Cold Call',
            'lead_source': '1NGO Directory',
            'validation_notes': 'Valid Indian mobile number; no independent website detected from directory/source URL.' if person else 'Valid Indian mobile number; no independent website detected; responsible person not found on page.',
            'lead_score': score,
        })

    kept.sort(key=lambda x: (-int(x['lead_score']), x['organization_name'].lower()))
    fields = [
        'crm_lead_name','organization_name','responsible_person','all_responsible_people_found',
        'primary_phone','all_phone_numbers','email_id','potential_language_spoken','location','address',
        'current_1ngo_page','directory_link','cause','pitch_angle','call_status','crm_stage','lead_source',
        'validation_notes','lead_score'
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(kept)

    print('input_rows', len(rows))
    print('call_ready_rows', len(kept))
    print('skipped', skipped)
    print('with_person', sum(bool(r['responsible_person']) for r in kept))
    print('with_email', sum(bool(r['email_id']) for r in kept))
    print('output', OUT)

if __name__ == '__main__':
    main()
