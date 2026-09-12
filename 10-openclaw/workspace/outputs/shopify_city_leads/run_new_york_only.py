#!/usr/bin/env python3
import json, time, random, sys
from pathlib import Path
sys.path.insert(0, '/root/.openclaw/workspace/tools')
import shopify_city_lead_automation as auto

OUT_DIR=Path('/root/.openclaw/workspace/outputs/shopify_city_leads')
RUN_LOG=OUT_DIR/'new_york_only_run.log'
STATE=OUT_DIR/'automation_state.json'
COUNTRY='US'; CITY='New York'
TARGET=1000

QUERY_PATTERNS=[
    'US New York {term} Shopify store email',
    'New York {term} Shopify contact email',
    'New York {term} Shopify contact',
    'New York {term} Shopify store',
    'New York {term} "Powered by Shopify"',
    'New York {term} "cdn.shopify.com"',
    'New York {term} "Shop Pay"',
    'New York {term} "Add to cart"',
    'site:.com New York {term} jewelry Shopify',
    'site:.com NYC {term} jewelry Shopify',
    'site:.com Brooklyn {term} jewelry Shopify',
    'site:.com Manhattan {term} jewelry Shopify',
]
TERMS=[
    'fine jewelry','fine jewellery','demi fine jewelry','demi-fine jewelry','demi fine jewellery','demi-fine jewellery',
    'gold vermeil jewelry','gold filled jewelry','14k gold jewelry','18k gold jewelry','solid gold jewelry','diamond jewelry',
    'lab grown diamond jewelry','engagement ring','wedding band','handmade fine jewelry','sustainable fine jewelry',
    'jewelry boutique','jewellery boutique','designer jewelry','custom jewelry','gemstone jewelry','earrings','necklaces','rings','bracelets'
]
CATEGORIES=['Demi-fine Jewellery','Fine Jewellery']

def log(msg):
    line=f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with RUN_LOG.open('a', encoding='utf-8') as f: f.write(line+'\n')

def save_state(**extra):
    try:
        data=json.loads(STATE.read_text()) if STATE.exists() else {}
    except Exception:
        data={}
    data.update({
        'goal':'Collect verified Shopify jewellery leads city-by-city, one city at a time, using free search only.',
        'sheetId': auto.SHEET_ID,
        'sheetTab': auto.TAB,
        'currentCountry': COUNTRY,
        'currentCity': CITY,
        'cityTarget': TARGET,
        'status': extra.get('status','running'),
        'lastUpdateUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    })
    data.update(extra)
    STATE.write_text(json.dumps(data, indent=2), encoding='utf-8')

def main():
    existing, sheet_rows = auto.sheet_domains()
    start_domains=set(existing)
    added=0; dup=0; rejected=0; searches=0; no_results=0; search_errors=0
    save_state(status='running', cityAddedThisRun=0, searchBlocker='web_search Gemini quota 429; using direct Bing scraping')
    log(f'START New York only sheet_rows={sheet_rows} domains={len(existing)}')
    seen_candidates=set()
    consecutive_empty=0
    for term in TERMS:
      for category in CATEGORIES:
       for pat in QUERY_PATTERNS:
        query=pat.format(term=term)
        searches += 1
        log(f'QUERY | {COUNTRY} | {CITY} | {category} | {query}')
        try:
            candidates=auto.search_bing(query)
        except Exception as e:
            search_errors += 1
            log(f'SEARCH_ERROR | {query} | {type(e).__name__}: {e}')
            candidates=[]
        # de-dupe preserving order
        uniq=[]
        for c in candidates:
            d=auto.norm_domain(c)
            if not d or d in seen_candidates: continue
            seen_candidates.add(d); uniq.append(c)
        log(f'CANDIDATES raw={len(candidates)} new={len(uniq)}')
        if not uniq:
            no_results += 1; consecutive_empty += 1
        else:
            consecutive_empty = 0
        if consecutive_empty >= 35 and searches >= 40:
            log('BLOCK_OR_EXHAUSTION | 35 consecutive Bing queries produced no new candidates')
            save_state(status='blocked_or_exhausted', cityAddedThisRun=added, searches=searches, searchErrors=search_errors, noResultQueries=no_results, blocker='35 consecutive Bing queries produced no new candidates; web_search quota 429')
            return
        for cand in uniq:
            d=auto.norm_domain(cand)
            if d in existing:
                dup += 1
                auto.reject(cand, COUNTRY, CITY, category, 'duplicate_domain')
                continue
            lead, reason = auto.verify_candidate(cand, COUNTRY, CITY, category)
            if not lead:
                rejected += 1
                auto.reject(cand, COUNTRY, CITY, category, reason)
                log(f'REJECT | {d} | {reason}')
                continue
            d2=lead['Domain']
            if d2 in existing:
                dup += 1
                auto.reject(cand, COUNTRY, CITY, category, 'duplicate_domain_after_redirect')
                continue
            auto.append_lead(lead)
            existing.add(d2); added += 1
            log(f'ADDED {added}: {lead["Store Name"]} | {lead["Link"]} | {lead["Category"]} | email={lead["Email"] or "blank"}')
            save_state(status='running', cityAddedThisRun=added, searches=searches, duplicates=dup, rejected=rejected, searchErrors=search_errors, noResultQueries=no_results, lastAddedDomain=d2)
            if added >= TARGET:
                save_state(status='target_reached', cityAddedThisRun=added, searches=searches, duplicates=dup, rejected=rejected, searchErrors=search_errors, noResultQueries=no_results)
                log('TARGET_REACHED')
                return
        time.sleep(random.uniform(0.8,1.8))
    save_state(status='city_search_patterns_exhausted', cityAddedThisRun=added, searches=searches, duplicates=dup, rejected=rejected, searchErrors=search_errors, noResultQueries=no_results, blocker='web_search quota 429; Bing free scraping exhausted configured NY queries')
    log(f'FINISH exhausted queries added={added} dup={dup} rejected={rejected} searches={searches} errors={search_errors} no_results={no_results}')

if __name__=='__main__': main()
