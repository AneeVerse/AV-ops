import json
from pathlib import Path
p='/root/.openclaw/workspace/rb_cb_curated_screener_fixed.json'
rows=json.load(open(p))
known=[
 ('Sterling and Wilson Renewable Energy','https://www.screener.in/company/SWSOLAR/consolidated/','Sterling and Wilson Renewable Energy Ltd'),
 ('PTC India Financial Services','https://www.screener.in/company/PFS/consolidated/','PTC India Financial Services Ltd'),
 ('VIKRAM SOLAR','https://www.screener.in/company/VIKRAMSOLR/consolidated/','Vikram Solar Ltd'),
 ('Jyoti Resins','https://www.screener.in/company/514448/','Jyoti Resins and Adhesives Ltd'),
 ('Gravita India','https://www.screener.in/company/GRAVITA/consolidated/','Gravita India Ltd'),
 ('Sirca Paints','https://www.screener.in/company/SIRCA/','Sirca Paints India Ltd'),
 ('APOLLO PIPES','https://www.screener.in/company/APOLLOPIPE/consolidated/','Apollo Pipes Ltd'),
 ('BLUE STAR','https://www.screener.in/company/BLUESTARCO/consolidated/','Blue Star Ltd'),
 ('Craftsman','https://www.screener.in/company/CRAFTSMAN/consolidated/','Craftsman Automation Ltd'),
 ('Servotech Renewable','https://www.screener.in/company/SERVOTECH/','Servotech Renewable Power System Ltd'),
 ('Tamilnadu Petroproducts','https://www.screener.in/company/TNPETRO/consolidated/','Tamilnadu Petroproducts Ltd'),
 ('Allied Blenders','https://www.screener.in/company/ABDL/consolidated/','Allied Blenders & Distillers Ltd'),
 ('Garware Hi','https://www.screener.in/company/GRWRHITECH/consolidated/','Garware Hi Tech Films Ltd'),
 ('Balrampur Chini','https://www.screener.in/company/BALRAMCHIN/consolidated/','Balrampur Chini Mills Ltd'),
 ('Hero Moto','https://www.screener.in/company/HEROMOTOCO/consolidated/','Hero MotoCorp Ltd'),
 ('GK ENERGY','https://www.screener.in/company/GKENERGY/consolidated/','GK Energy Ltd'),
 ('LARSEN','https://www.screener.in/company/LT/consolidated/','Larsen & Toubro Ltd'),
 ('KP Energy','https://www.screener.in/company/KPEL/consolidated/','K.P. Energy Ltd'),
 ('PNB in','https://www.screener.in/company/PNB/consolidated/','Punjab National Bank'),
 ('NHPC','https://www.screener.in/company/NHPC/consolidated/','NHPC Ltd'),
 ('ACME SOLAR','https://www.screener.in/company/ACMESOLAR/consolidated/','ACME Solar Holdings Ltd'),
 ('ACME Solar','https://www.screener.in/company/ACMESOLAR/consolidated/','ACME Solar Holdings Ltd'),
 ('Voltamp','https://www.screener.in/company/VOLTAMP/consolidated/','Voltamp Transformers Ltd'),
 ('Shilchar','https://www.screener.in/company/SHILCTECH/consolidated/','Shilchar Technologies Ltd'),
]
fixed=0
for r in rows:
    if r.get('Screener'): continue
    hay=(r.get('Company name','')+' '+r.get('Context','')).lower()
    for needle,url,name in known:
        if needle.lower() in hay:
            r['Screener']=url; r['Screener match name']=name
            r['Notes']=r.get('Notes','')+' Screener resolved by manual company-name normalization.'
            fixed+=1; break
Path(p).write_text(json.dumps(rows, ensure_ascii=False, indent=2))
print('manual fixed',fixed,'total resolved',sum(1 for r in rows if r.get('Screener')),'unresolved',sum(1 for r in rows if not r.get('Screener')))
