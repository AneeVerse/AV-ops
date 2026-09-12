import json, subprocess
SID='1l8B_NLb83iuh8tdsOT2Y0gJb2QoBTm3KCvF3nZ7UCVY'
rows=json.load(open('/root/.openclaw/workspace/rb_cb_curated_screener_fixed.json'))
raw=json.load(open('/root/.openclaw/workspace/rb_cb_filtered.json'))
headers=['Company name','Context','Trigger keywords','Source handle','Tweet URL','Screener','Screener match name','Verification status','Confidence','Notes','Date']
raw_headers=['date','handle','matched_keywords','tweet_url','likes','retweets','views','text']

def upload(tab, headers, data, chunk=20):
    subprocess.run(['gog','sheets','clear',SID,f"'{tab}'!A:Z"], check=True)
    subprocess.run(['gog','sheets','update',SID,f"'{tab}'!A1",'--values-json',json.dumps([headers],ensure_ascii=False),'--input','USER_ENTERED','--no-input'], check=True)
    for i in range(0,len(data),chunk):
        vals=[[r.get(h,'') for h in headers] for r in data[i:i+chunk]]
        subprocess.run(['gog','sheets','append',SID,f"'{tab}'!A:Z",'--values-json',json.dumps(vals,ensure_ascii=False),'--input','USER_ENTERED','--insert','INSERT_ROWS','--no-input'], check=True)
    print(tab, len(data))

ready=[r for r in rows if r.get('Screener')]
unresolved=[r for r in rows if not r.get('Screener')]
upload('Curated Signals', headers, rows, 15)
upload('Ready for RB', headers, ready, 15)
upload('Unresolved Review', headers, unresolved, 15)
upload('Raw Tweets', raw_headers, raw, 25)
for tab in ['Curated Signals','Ready for RB','Unresolved Review','Raw Tweets']:
    subprocess.run(['gog','sheets','freeze',SID,'--sheet',tab,'--rows','1','--no-input'], check=False)
print('resolved',len(ready),'unresolved',len(unresolved))
