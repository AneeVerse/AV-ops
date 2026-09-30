#!/usr/bin/env python3
import json, urllib.error, urllib.request

tokens = json.load(open("/tmp/gcp-user.token.json"))
access = tokens["access_token"]
project_id = "aneeverse-cal-760101"
number = "192773262442"
brand = f"projects/{number}/brands/{number}"
redirect = "https://app.aneeverse.com/_calendar/signin/code"

def req(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + access)
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw[:900]}
        return e.code, parsed

print("iap brand get", req("GET", f"https://iap.googleapis.com/v1/{brand}"))

print("\n=== IAP client (locked, for comparison) ===")
st, body = req(
    "POST",
    f"https://iap.googleapis.com/v1/{brand}/identityAwareProxyClients",
    {"displayName": "Aneeverse Calendar IAP"},
)
print("iap_client", st, json.dumps(body)[:800])

print("\n=== clientauthconfig under brand ===")
urls = [
    f"https://clientauthconfig.googleapis.com/v1/{brand}/clients",
    f"https://clientauthconfig.googleapis.com/v1/projects/{number}/brands/{number}/clients",
    f"https://clientauthconfig.googleapis.com/v1/clients?parent={brand}",
]
payloads = [
    {
        "displayName": "Aneeverse Calendar",
        "redirectUris": [redirect],
        "javascriptOrigins": ["https://app.aneeverse.com"],
        "clientType": "WEB",
    },
    {
        "client": {
            "displayName": "Aneeverse Calendar",
            "redirectUris": [redirect],
            "javascriptOrigins": ["https://app.aneeverse.com"],
            "clientType": "WEB",
        }
    },
    {
        "display_name": "Aneeverse Calendar",
        "redirect_uris": [redirect],
        "javascript_origins": ["https://app.aneeverse.com"],
        "client_type": 1,
    },
]
for url in urls:
    st, body = req("GET", url)
    print("GET", st, url.split("googleapis.com")[-1], json.dumps(body)[:250])
    for i, p in enumerate(payloads):
        st, body = req("POST", url, p)
        print("POST", i, st, url.split("googleapis.com")[-1][:50], json.dumps(body)[:300])
        if st in (200, 201) and "error" not in body:
            open("/tmp/gcp-web-client.json", "w").write(json.dumps(body, indent=2))
            print("SAVED")
