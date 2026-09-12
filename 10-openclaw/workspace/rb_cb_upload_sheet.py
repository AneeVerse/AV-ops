import json, subprocess, csv
from pathlib import Path
SID='1l8B_NLb83iuh8tdsOT2Y0gJb2QoBTm3KCvF3nZ7UCVY'

def upload(tab, headers, rows, chunk=20):
    # clear then update headers+first chunks using append after header update
    subprocess.run(['gog','sheets','clear',SID,f"'{tab}'!A:Z"], check=True)
    subprocess.run(['gog','sheets','update',SID,f"'{tab}'!A1",'--values-json',json.dumps([headers],ensure_ascii=False),'--input','USER_ENTERED','--no-input'], check=True)
    for i in range(0,len(rows),chunk):
        vals=[[r.get(h,'') for h in headers] for r in rows[i:i+chunk]]
        subprocess.run(['gog','sheets','append',SID,f"'{tab}'!A:Z",'--values-json',json.dumps(vals,ensure_ascii=False),'--input','USER_ENTERED','--insert','INSERT_ROWS','--no-input'], check=True)
        print(tab, i+len(vals), '/', len(rows))

cur=json.load(open('/root/.openclaw/workspace/rb_cb_curated.json'))
raw=json.load(open('/root/.openclaw/workspace/rb_cb_filtered.json'))
cur_headers=['Company name','Context','Trigger keywords','Source handle','Tweet URL','Screener','Verification status','Confidence','Notes','Date']
raw_headers=['date','handle','matched_keywords','tweet_url','likes','retweets','views','text']
upload('Curated Signals', cur_headers, cur, chunk=15)
upload('Raw Tweets', raw_headers, raw, chunk=20)
# format
subprocess.run(['gog','sheets','freeze',SID,'--rows','1','--no-input'], check=False)
subprocess.run(['gog','sheets','resize-columns',SID,'A:J','--width','180','--no-input'], check=False)
print('done')
