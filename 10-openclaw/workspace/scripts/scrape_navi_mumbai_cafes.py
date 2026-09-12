#!/usr/bin/env python3
import csv, json, re, time, urllib.parse
from pathlib import Path
from typing import Any
import requests

LOCALITIES = [
    "Airoli", "Rabale", "Ghansoli", "Kopar Khairane", "Turbhe", "Vashi", "APMC Vashi",
    "Sanpada", "Juinagar", "Nerul", "Seawoods", "CBD Belapur", "Belapur", "Kharghar",
    "Kamothe", "Kalamboli", "Khandeshwar", "New Panvel", "Panvel", "Ulwe", "Dronagiri",
    "Taloja", "Karanjade"
]

# Keep broad because Google labels many real cafes as bakery/dessert/restaurant.
CAFE_KEYWORDS = [
    "cafe", "coffee", "tea", "bakery", "dessert", "patisserie", "waffle", "bistro",
    "breakfast", "brunch", "chocolate", "ice cream", "donut", "pastry", "sandwich"
]
EXCLUDE_KEYWORDS = [
    "barber", "cyber cafe", "internet cafe", "medical", "hospital", "chemist", "salon", "spa",
    "banquet", "caterer", "catering", "tiffin", "hostel", "hotel"  # hotel often pollutes Maps cafe searches
]

HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121 Safari/537.36"}

def clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name or "").strip()
    # Remove SEO suffixes where obvious, but keep brand/location names intact.
    name = re.sub(r"\s*\|\s*Cafe in .*$", "", name, flags=re.I).strip()
    return name

def is_cafe(title: str, cats: list[str], addr: str) -> bool:
    hay = " ".join([title or "", addr or "", " ".join(cats or [])]).lower()
    if any(x in hay for x in EXCLUDE_KEYWORDS):
        # Do not exclude if category/name strongly says cafe/coffee.
        strong = any(x in (title or "").lower() for x in ["cafe", "coffee", "starbucks", "tokai", "mccafe", "third wave"])
        if not strong:
            return False
    return any(k in hay for k in CAFE_KEYWORDS)

def fetch_query(query: str) -> list[dict[str, Any]]:
    url = "https://www.google.com/maps/search/" + urllib.parse.quote_plus(query)
    r = requests.get(url, headers=HEADERS, timeout=25)
    r.raise_for_status()
    m = re.search(r'href="(/search\?tbm=map[^\"]+)', r.text)
    if not m:
        return []
    pb_url = "https://www.google.com" + urllib.parse.unquote(m.group(1).replace("&amp;", "&"))
    rr = requests.get(pb_url, headers=HEADERS, timeout=30)
    rr.raise_for_status()
    txt = rr.text
    if txt.startswith(")]}'"):
        txt = txt.split("\n", 1)[1]
    try:
        data = json.loads(txt)
    except Exception:
        return []
    rows = []
    bucket = data[64] if isinstance(data, list) and len(data) > 64 and isinstance(data[64], list) else []
    for item in bucket:
        if not (isinstance(item, list) and len(item) > 1 and isinstance(item[1], list)):
            continue
        a = item[1]
        title = clean_name(a[11] if len(a) > 11 and isinstance(a[11], str) else "")
        addr_parts = a[2] if len(a) > 2 and isinstance(a[2], list) else []
        addr = ", ".join([str(x) for x in addr_parts if x])
        coords = a[9] if len(a) > 9 and isinstance(a[9], list) else []
        lat = coords[2] if len(coords) > 2 and isinstance(coords[2], (int, float)) else None
        lng = coords[3] if len(coords) > 3 and isinstance(coords[3], (int, float)) else None
        cid = a[10] if len(a) > 10 and isinstance(a[10], str) else ""
        cats = a[13] if len(a) > 13 and isinstance(a[13], list) else []
        cats = [str(c) for c in cats if c]
        area = a[14] if len(a) > 14 and isinstance(a[14], str) else ""
        rating = None
        if len(a) > 4 and isinstance(a[4], list) and len(a[4]) > 7:
            rating = a[4][7]
        if not title or not is_cafe(title, cats, addr):
            continue
        maps = f"https://www.google.com/maps?q={lat},{lng}" if lat and lng else "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote_plus(f"{title} {addr}")
        website = ""
        if len(a) > 7 and isinstance(a[7], list) and len(a[7]) > 1 and isinstance(a[7][1], str):
            website = a[7][1]
            if len(a[7]) > 0 and isinstance(a[7][0], str) and a[7][0].startswith('/url?q='):
                website = urllib.parse.parse_qs(urllib.parse.urlparse(a[7][0]).query).get('q', [website])[0]
        phone = ""
        if len(a) > 178 and isinstance(a[178], list) and a[178]:
            p = a[178][0]
            if isinstance(p, list) and p:
                phone = str(p[0] or "")
        rows.append({
            "Name": title,
            "Area / Locality": area,
            "Search Locality": query,
            "Search Query": query,
            "Address": addr,
            "Google Maps Link": maps,
            "Phone": phone,
            "Website": website,
            "Email": "",
            "Rating": rating or "",
            "Categories": "; ".join(cats),
            "Google CID": cid,
        })
    return rows

def main():
    all_rows = []
    for loc in LOCALITIES:
        for qprefix in ["cafe in", "coffee shop in", "tea cafe in", "bakery cafe in", "dessert cafe in"]:
            query = f"{qprefix} {loc} Navi Mumbai"
            print("Fetching", query, flush=True)
            try:
                rows = fetch_query(query)
                for row in rows:
                    row["Search Locality"] = loc
                    row["Search Query"] = query
                print("  rows", len(rows), flush=True)
                all_rows.extend(rows)
            except Exception as e:
                print("  ERROR", e, flush=True)
            time.sleep(0.45)
    # Dedupe by CID, then by name+rounded coords/map link
    seen = set(); deduped = []
    for r in all_rows:
        key = r.get("Google CID") or (r["Name"].lower(), r["Google Maps Link"])
        if key in seen: continue
        seen.add(key); deduped.append(r)
    deduped.sort(key=lambda r: (r["Search Locality"], r["Name"].lower()))
    outdir = Path("/root/.openclaw/workspace/data")
    outdir.mkdir(exist_ok=True)
    json_path = outdir / "navi_mumbai_cafes_deep.json"
    csv_path = outdir / "navi_mumbai_cafes_deep.csv"
    json_path.write_text(json.dumps(deduped, ensure_ascii=False, indent=2))
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Name", "Area / Locality", "Search Locality", "Address", "Google Maps Link", "Phone", "Website", "Email", "Rating", "Categories", "Google CID", "Search Query"])
        w.writeheader(); w.writerows(deduped)
    print(f"Saved {len(deduped)} unique cafes")
    print(csv_path)

if __name__ == "__main__":
    main()
