#!/usr/bin/env python3
import sys, json, time
from pathlib import Path
sys.path.insert(0, '/root/.openclaw/workspace/tools')
import shopify_city_lead_automation as auto
COUNTRY='US'; CITY='New York'
CANDIDATES=[
 'https://www.catbirdnyc.com/','https://www.stoneandstrand.com/','https://auratenewyork.com/','https://wwake.com/',
 'https://mociun.com/','https://marlaaaron.com/','https://ringconcierge.com/','https://jenniferfisherjewelry.com/',
 'https://bonbonwhims.com/','https://agmesnyc.com/','https://sarahchloe.com/','https://www.melissajoymanning.com/',
 'https://www.alexisbittar.com/','https://www.kinnstudio.com/','https://www.verlas.com/','https://www.vrai.com/',
 'https://www.gabrielaartigas.com/','https://www.jadeandjules.com/','https://www.zoechicco.com/','https://www.kataoka-jewelry.com/',
 'https://www.laurenbjewelry.com/','https://www.annasheffield.com/','https://www.greenwichjewelers.com/','https://www.judithripka.com/',
 'https://www.jemmawynne.com/','https://www.ondyn.com/','https://www.efcollection.com/','https://www.nishinyc.com/',
 'https://www.lizziefortunato.com/','https://www.bingbangnyc.com/','https://www.adornmonde.com/','https://www.loveweld.com/',
 'https://www.theclearcut.co/','https://www.withclarity.com/','https://www.noemiefinejewelry.com/','https://www.taylorandhart.com/',
 'https://www.idyl.com/','https://www.grownbrilliance.com/','https://www.kwiat.com/','https://www.foundrae.com/',
 'https://www.sauer1891.com/','https://www.lorenstewart.com/','https://www.brinkerandeliza.com/','https://www.janewin.com/',
 'https://www.monicarichkosann.com/','https://www.sophieratner.com/','https://www.bario-neal.com/','https://www.jennykwon.com/'
]
STATE=Path('/root/.openclaw/workspace/outputs/shopify_city_leads/automation_state.json')
LOG=Path('/root/.openclaw/workspace/outputs/shopify_city_leads/seed_verify_run.log')

def log(s):
 print(s, flush=True)
 with LOG.open('a',encoding='utf-8') as f:f.write(s+'\n')

def save(**kw):
 try: data=json.loads(STATE.read_text())
 except Exception: data={}
 data.update({'currentCountry':COUNTRY,'currentCity':CITY,'lastUpdateUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
 data.update(kw); STATE.write_text(json.dumps(data,indent=2),encoding='utf-8')

def main():
 existing, rows=auto.sheet_domains(); added=0; dup=0; rej=0
 log(f'SEED_START rows={rows} domains={len(existing)}')
 for cand in CANDIDATES:
  d=auto.norm_domain(cand)
  if d in existing:
   dup+=1; log(f'DUP | {d}'); continue
  accepted=False; reasons=[]
  for cat in ['Fine Jewellery','Demi-fine Jewellery']:
   lead, reason=auto.verify_candidate(cand, COUNTRY, CITY, cat)
   if lead:
    d2=lead['Domain']
    if d2 in existing:
     dup+=1; log(f'DUP_AFTER | {d2}'); accepted=True; break
    auto.append_lead(lead); existing.add(d2); added+=1; accepted=True
    log(f'ADDED {added} | {lead["Store Name"]} | {lead["Link"]} | {lead["Category"]} | email={lead["Email"] or "blank"} | notes={lead["Notes"]}')
    save(status='running_seed_verification', seedAddedThisRun=added, seedDuplicates=dup, seedRejected=rej, lastAddedDomain=d2)
    break
   reasons.append(f'{cat}:{reason}')
  if not accepted:
   rej+=1; log(f'REJECT | {d} | {"; ".join(reasons)}')
 log(f'SEED_FINISH added={added} dup={dup} rejected={rej}')
 save(status='seed_candidates_processed', seedAddedThisRun=added, seedDuplicates=dup, seedRejected=rej)
if __name__=='__main__': main()
