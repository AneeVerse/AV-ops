#!/usr/bin/env python3
"""Process next Shopify lead rows for company LinkedIn using deterministic web checks.

No AI/model calls. Intended for n8n via local bridge.
- Reads Google Sheet rows from Shopify tab
- Finds next rows where Company LinkedIn is blank / NOT FOUND
- Checks official site pages for LinkedIn company/showcase URLs
- Falls back to lightweight Bing/DDG HTML scans
- Writes LinkedIn URL or NA back to column K
"""
import argparse
import html
import json
import re
import subprocess
import time
import unicodedata
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse

import requests

SHEET_ID = '1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o'
TAB = 'Shopify'
RANGE = f'{TAB}!A1:K1530'
COMPANY_LINKEDIN_COL = 'K'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}
LINKEDIN_RE = re.compile(
    r'https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|showcase)/[^\s"\'<>?#)&]+'
    r'|(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|showcase)/[^\s"\'<>?#)&]+',
    re.I,
)


def run(cmd):
    return subprocess.check_output(cmd, text=True)


def sheets_get():
    out = run(['gog', 'sheets', 'get', SHEET_ID, RANGE, '--json'])
    return json.loads(out).get('values', [])


def sheets_update(row_number, value):
    target = f'{TAB}!{COMPANY_LINKEDIN_COL}{row_number}'
    values = json.dumps([[value]], ensure_ascii=False)
    out = run(['gog', 'sheets', 'update', SHEET_ID, target, '--values-json', values, '--input', 'USER_ENTERED'])
    return out.strip()


def clean_linkedin(url):
    url = html.unescape(unquote(url))
    if url.startswith('//'):
        url = 'https:' + url
    if not url.startswith('http') and 'linkedin.com' in url:
        url = 'https://www.' + url.lstrip('/')
    url = re.sub(r'^https?://[a-z]{2,3}\.linkedin\.com', 'https://www.linkedin.com', url, flags=re.I)
    return url.rstrip('/.,;')


def add_matches(found, text):
    for m in LINKEDIN_RE.finditer(text or ''):
        c = clean_linkedin(m.group(0))
        if c and c not in found:
            found.append(c)


def site_candidates(session, site):
    if not site:
        return []
    base = site if site.startswith('http') else 'https://' + site
    paths = [
        '', '/', '/about', '/about-us', '/pages/about', '/pages/about-us',
        '/contact', '/contact-us', '/pages/contact', '/pages/contact-us',
        '/pages/the-concierge-experience', '/pages/book-a-consultation',
    ]
    found = []
    checked = []
    for path in paths:
        url = urljoin(base, path)
        if url in checked:
            continue
        checked.append(url)
        try:
            r = session.get(url, timeout=8, allow_redirects=True)
            if r.status_code < 400:
                add_matches(found, r.text[:1500000])
        except Exception:
            pass
        if found:
            break
    return found


def root_domain(site):
    if not site:
        return ''
    parsed = urlparse(site if site.startswith('http') else 'https://' + site)
    host = parsed.netloc.lower().split(':')[0]
    if host.startswith('www.'):
        host = host[4:]
    return host


def compact_domain(site):
    host = root_domain(site)
    return host.split('.')[0].replace('-', '') if host else ''


def slugify(text):
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode('ascii')
    text = text.lower().replace('&', ' and ')
    text = re.sub(r'\b(homepage|official|website|www)\b', ' ', text)
    words = re.findall(r'[a-z0-9]+', text)
    return '-'.join(words)


def linkedin_slug_candidates(name, site):
    base_name = slugify(name)
    domain = root_domain(site).split('.')[0] if root_domain(site) else ''
    domain_slug = slugify(domain)
    bases = []
    for b in [base_name, domain_slug]:
        if b and b not in bases:
            bases.append(b)
    suffixes = [
        '',
        'inc-fine-jewelry', 'inc-fine-jewellery', 'fine-jewelry', 'fine-jewellery',
        'jewelry', 'jewellery', 'jewelers', 'jewellers',
        'inc', 'llc', 'co', 'company',
        'co-fine-jewelry', 'company-fine-jewelry',
    ]
    out = []
    for b in bases:
        for s in suffixes:
            slug = b if not s else f'{b}-{s}'
            if slug and slug not in out:
                out.append(slug)
    return out[:8]


def linkedin_page_verified(session, url, name, site):
    # Use Jina reader for LinkedIn pages because direct LinkedIn starts throttling guessed URLs.
    reader_url = 'https://r.jina.ai/http://' + url
    try:
        r = session.get(reader_url, timeout=8, allow_redirects=True)
        text = r.text or ''
    except Exception:
        return False, ''
    if r.status_code >= 400:
        return False, ''
    title_match = re.search(r'^Title:\s*(.*?)\s*$', text, re.M | re.I)
    title = html.unescape(re.sub(r'\s+', ' ', title_match.group(1)).strip()) if title_match else ''
    if not title or title.lower() == 'linkedin' or 'sign in' in title.lower():
        return False, title
    domain = root_domain(site)
    domain_hit = bool(domain and domain in text.lower())
    compact_hit = bool(compact_domain(site) and compact_domain(site) in re.sub(r'[^a-z0-9]', '', text.lower()))
    # Verification rule: LinkedIn page must list the same website/domain as sheet column B.
    # If it does not, do not write anything. Leave NOT FOUND for manual/retry review.
    if domain_hit or compact_hit:
        return True, title
    return False, title


def linkedin_direct_candidates(session, name, site):
    found = []
    for slug in linkedin_slug_candidates(name, site):
        url = f'https://www.linkedin.com/company/{slug}/'
        ok, title = linkedin_page_verified(session, url, name, site)
        if ok:
            found.append(url)
            break
        time.sleep(0.05)
    return found


def search_candidates(session, name, site):
    # Weak public search fallback. Candidates are still verified through LinkedIn page before use.
    found = []
    queries = [f'{name} linkedin', f'{name} LinkedIn company', f'{site} LinkedIn']
    for q in queries:
        for url in ['https://www.google.com/search?q=' + quote_plus(q), 'https://www.bing.com/search?q=' + quote_plus(q)]:
            try:
                r = session.get(url, timeout=8, allow_redirects=True)
                text = r.text
            except Exception:
                continue
            for href in re.findall(r'href=["\']([^"\']+)', text):
                href = html.unescape(href)
                if 'uddg=' in href:
                    href = unquote(parse_qs(urlparse(href).query).get('uddg', [''])[0])
                if '/url?q=' in href:
                    href = unquote(parse_qs(urlparse(href).query).get('q', [''])[0])
                if 'linkedin.com' in href:
                    add_matches(found, href)
            add_matches(found, text)
        verified = []
        for c in found:
            ok, _ = linkedin_page_verified(session, c, name, site)
            if ok and c not in verified:
                verified.append(c)
        if verified:
            return verified
        time.sleep(0.2)
    return []


def slug_score(name, site, link):
    slug = urlparse(link).path.strip('/').split('/')[-1].lower()
    host = urlparse(site if site.startswith('http') else 'https://' + site).netloc.lower().replace('www.', '')
    domain = host.split('.')[0]
    words = re.findall(r'[a-z0-9]+', (name or '').lower())
    bad = {'the', 'fine', 'jewelry', 'jewellery', 'diamond', 'diamonds', 'shop', 'store', 'inc', 'llc', 'co', 'company'}
    words = [w for w in words if w not in bad and len(w) > 1]
    score = 0
    if domain and domain in slug:
        score += 5
    for w in words:
        if w in slug:
            score += 2
    if any(w in slug for w in ['jewel', 'diamond', 'gold', 'gem']):
        score += 0.5
    return score


def best_candidate(name, site, cands, site_source=False):
    if not cands:
        return ''
    scored = sorted([(slug_score(name, site, c), c) for c in cands], reverse=True)
    if site_source:
        return scored[0][1]
    return scored[0][1] if scored[0][0] >= 2 else ''


def process(limit=1, start_row=2, dry_run=False, write_na=False):
    values = sheets_get()
    if not values:
        return {'ok': False, 'error': 'empty_sheet'}
    header = values[0]
    idx = {name: i for i, name in enumerate(header)}
    required = ['Store Name', 'Link', 'Company LinkedIn']
    missing = [x for x in required if x not in idx]
    if missing:
        return {'ok': False, 'error': 'missing_columns', 'missing': missing}

    todo = []
    for offset, row in enumerate(values[1:], start=2):
        if offset < start_row:
            continue
        current = row[idx['Company LinkedIn']] if idx['Company LinkedIn'] < len(row) else ''
        if current.strip().upper() == 'NOT FOUND':
            name = row[idx['Store Name']] if idx['Store Name'] < len(row) else ''
            site = row[idx['Link']] if idx['Link'] < len(row) else ''
            if name and site:
                todo.append({'row': offset, 'name': name, 'site': site, 'current': current})
        if len(todo) >= limit:
            break

    session = requests.Session()
    session.headers.update(HEADERS)
    processed = []
    for item in todo:
        site_found = site_candidates(session, item['site'])
        direct_found = [] if site_found else linkedin_direct_candidates(session, item['name'], item['site'])
        search_found = [] if (site_found or direct_found) else search_candidates(session, item['name'], item['site'])
        if site_found:
            source = 'official_site'
            cands = site_found
            best = best_candidate(item['name'], item['site'], cands, site_source=True)
        elif direct_found:
            source = 'linkedin_direct_verified'
            cands = direct_found
            best = direct_found[0]
        else:
            source = 'public_search_verified' if search_found else 'not_verified'
            cands = search_found
            best = search_found[0] if search_found else ''
        value = best or ('NA' if write_na else item['current'])
        update_result = 'dry_run' if dry_run else ('left_unchanged_not_verified' if not write_na and not best else 'pending_update')
        if not dry_run and (best or write_na):
            update_result = sheets_update(item['row'], value)
        processed.append({
            **item,
            'source': source,
            'candidates': cands[:5],
            'value_written': value,
            'update_result': update_result,
        })
        time.sleep(0.2)

    return {
        'ok': True,
        'mode': 'n8n_local_deterministic_no_ai',
        'ai_calls_used': 0,
        'sheet_id': SHEET_ID,
        'tab': TAB,
        'requested_limit': limit,
        'start_row': start_row,
        'processed_count': len(processed),
        'write_na': write_na,
        'processed': processed,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=1)
    ap.add_argument('--start-row', type=int, default=2)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--write-na', action='store_true')
    args = ap.parse_args()
    limit = max(1, min(args.limit, 25))
    print(json.dumps(process(limit=limit, start_row=args.start_row, dry_run=args.dry_run, write_na=args.write_na), ensure_ascii=False))


if __name__ == '__main__':
    main()
