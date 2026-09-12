#!/usr/bin/env python3
import os,json,urllib.request, urllib.error
from pathlib import Path
for path in [Path('/root/.openclaw/workspace/.env'), Path('/root/.env')]:
    if path.exists():
        for line in path.read_text(errors='ignore').splitlines():
            if '=' in line and not line.strip().startswith('#'):
                k,v=line.split('=',1); os.environ.setdefault(k.strip(),v.strip().strip('"').strip("'"))

def test_openrouter(model):
    key=os.getenv('OPENROUTER_API_KEY')
    payload={'model':model,'messages':[{'role':'user','content':'Return JSON only: {"ok":true}'}],'temperature':0}
    req=urllib.request.Request('https://openrouter.ai/api/v1/chat/completions',data=json.dumps(payload).encode(),headers={'Authorization':f'Bearer {key}','Content-Type':'application/json','HTTP-Referer':'https://aneeverse.com','X-Title':'PDF to PPT'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=60) as r:
            d=json.loads(r.read().decode()); return True,d['choices'][0]['message']['content'][:200]
    except urllib.error.HTTPError as e:
        return False, f'HTTP {e.code}: '+e.read().decode(errors='ignore')[:500]
    except Exception as e: return False, repr(e)

def test_gemini(model):
    key=os.getenv('GEMINI_API_KEY')
    url=f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    payload={'contents':[{'parts':[{'text':'Return JSON only: {"ok":true}'}]}],'generationConfig':{'temperature':0,'responseMimeType':'application/json'}}
    req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=60) as r:
            d=json.loads(r.read().decode()); return True,d['candidates'][0]['content']['parts'][0]['text'][:200]
    except urllib.error.HTTPError as e:
        return False, f'HTTP {e.code}: '+e.read().decode(errors='ignore')[:500]
    except Exception as e: return False, repr(e)

for m in ['openai/gpt-4o-mini','google/gemini-2.0-flash-001','openrouter/auto']:
    ok,msg=test_openrouter(m); print('openrouter',m,ok,msg)
for m in ['gemini-1.5-flash','gemini-2.0-flash','gemini-2.5-flash']:
    ok,msg=test_gemini(m); print('gemini',m,ok,msg)
