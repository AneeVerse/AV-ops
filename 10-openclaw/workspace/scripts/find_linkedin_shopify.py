#!/usr/bin/env python3
import json, re, subprocess, sys, time, urllib.parse, urllib.request
from html import unescape

SHEET_ID = "1jbiO0aTKh048tHkiJfIrtXgOZZftbABG3eVBmtxx13o"
TAB = "Shopify"
START_ROW = 5
END_ROW = 455
BATCH_UPDATE_SIZE = 20
SLEEP = 1.2

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def run(cmd):
    p = subprocess.run(cmd, text=True, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\nSTDOUT:{p.stdout}\nSTDERR:{p.stderr}")
    return p.stdout

def gog_get(range_):
    out = run(["gog", "sheets", "get", SHEET_ID, range_, "--json", "--no-input"])
    return json.loads(out).get("values", [])

def gog_update(range_, values):
    payload = json.dumps(values, ensure_ascii=False)
    out = run(["gog", "sheets", "update", SHEET_ID, range_, "--values-json", payload, "--input", "USER_ENTERED", "--no-input"])
    return out.strip()

def norm_slug(s):
    s = (s or "").lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s

def domain_slug(url):
    try:
        host = urllib.parse.urlparse(url if url.startswith("http") else "https://"+url).netloc.lower()
    except Exception:
        return ""
    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    base = host.split(".")[0]
    return norm_slug(base)

def fetch(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read(180000).decode("utf-8", "ignore")
            return r.geturl(), r.status, raw
    except Exception:
        return url, None, ""

def linkedin_page_ok(url, company_name, website):
    final, status, html = fetch(url)
    if status != 200 or "/company/" not in final:
        return False, ""
    text = unescape(re.sub(r"<[^>]+>", " ", html))
    text_l = re.sub(r"\s+", " ", text.lower())
    title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I|re.S)
    title_text = unescape(re.sub(r"\s+", " ", title.group(1))).strip() if title else ""
    name_tokens = [t for t in re.findall(r"[a-z0-9]+", company_name.lower()) if len(t) > 2 and t not in {"the", "and", "for", "every", "day", "new", "york", "jewelry", "jewellery", "fine", "official", "store"}]
    dom = domain_slug(website)
    score = 0
    if title_text and any(t in title_text.lower() for t in name_tokens[:3]): score += 2
    if dom and dom in text_l: score += 3
    for t in name_tokens[:4]:
        if t in text_l: score += 1
    if "linkedin" in title_text.lower() and score >= 3:
        return True, final.split("?")[0].rstrip("/")
    return False, ""

def search_ddg(company, website):
    q = f'site:linkedin.com/company "{company}" {website}'
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(q)
    final, status, html = fetch(url, timeout=10)
    if status not in (200, 202) or "challenge" in html.lower():
        return ""
    links = re.findall(r"https?%3A%2F%2Fwww\.linkedin\.com%2Fcompany%2F[^&\"']+", html)
    seen = []
    for enc in links:
        link = urllib.parse.unquote(enc).split("?")[0].rstrip("/")
        if link not in seen:
            seen.append(link)
    for link in seen[:5]:
        ok, canonical = linkedin_page_ok(link, company, website)
        if ok:
            return canonical
    return ""

def find_linkedin(company, website):
    ds = domain_slug(website)
    ns = norm_slug(company)
    candidates = []
    for s in [ds, ns, ns.replace("-and-", "-"), ns.replace("-", "")]:
        if s and s not in candidates:
            candidates.append(s)
    for s in candidates:
        ok, canonical = linkedin_page_ok(f"https://www.linkedin.com/company/{s}", company, website)
        if ok:
            return canonical
        time.sleep(0.4)
    return search_ddg(company, website)

def main():
    values = gog_get(f"{TAB}!A1:K{END_ROW}")
    if not values or len(values[0]) < 11 or values[0][10] != "Company LinkedIn":
        gog_update(f"{TAB}!K1", [["Company LinkedIn"]])
    updates = []
    processed = found = skipped = 0
    for idx, row in enumerate(values[START_ROW-1:], start=START_ROW):
        company = row[0].strip() if len(row)>0 and row[0] else ""
        website = row[1].strip() if len(row)>1 and row[1] else ""
        existing = row[10].strip() if len(row)>10 and row[10] else ""
        if not company or existing:
            skipped += 1
            continue
        link = find_linkedin(company, website)
        processed += 1
        print(json.dumps({"row": idx, "company": company, "website": website, "linkedin": link}, ensure_ascii=False), flush=True)
        updates.append((idx, link or "NOT FOUND"))
        if link:
            found += 1
        if len(updates) >= BATCH_UPDATE_SIZE:
            for r, v in updates:
                gog_update(f"{TAB}!K{r}", [[v]])
            updates.clear()
        time.sleep(SLEEP)
    for r, v in updates:
        gog_update(f"{TAB}!K{r}", [[v]])
    print(json.dumps({"done": True, "processed": processed, "found": found, "skipped": skipped}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
