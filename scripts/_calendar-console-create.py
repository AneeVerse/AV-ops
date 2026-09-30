#!/usr/bin/env python3
"""Try Console-style clientauthconfig create with user token + public console API key.
Never prints client secrets.
"""
import json
import urllib.error
import urllib.parse
import urllib.request

TOK = json.load(open("/tmp/gcp-user.token.json"))
access = TOK["access_token"]
number = "192773262442"
project = "aneeverse-cal-760101"
redirect = "https://app.aneeverse.com/_calendar/signin/code"
# Public Cloud Console frontend key (embedded in console JS).
KEYS = [
    "AIzaSyCI-zsRP85RHtRdkKfsdApoZXbmVQclEr8",
    "AIzaSyCI-zsRP85UVOi0DjtiCwWBwQ1djDy741g",
]


def call(method, url, body=None, key=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + access)
    r.add_header("Content-Type", "application/json")
    r.add_header("Origin", "https://console.cloud.google.com")
    r.add_header("Referer", "https://console.cloud.google.com/")
    r.add_header("x-goog-user-project", project)
    if key:
        r.add_header("X-Goog-Api-Key", key)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw[:700]}
        return e.code, parsed


payloads = [
    {
        "displayName": "Aneeverse Calendar",
        "clientType": "WEB",
        "redirectUris": [redirect],
        "javascriptOrigins": ["https://app.aneeverse.com"],
        "projectNumber": number,
    },
    {
        "displayName": "Aneeverse Calendar",
        "clientType": 1,
        "redirectUris": [redirect],
        "javascriptOrigins": ["https://app.aneeverse.com"],
        "projectNumber": int(number),
    },
    {
        "clientType": "WEB_APPLICATION",
        "displayName": "Aneeverse Calendar",
        "web": {
            "redirectUris": [redirect],
            "javascriptOrigins": ["https://app.aneeverse.com"],
        },
        "projectNumber": number,
    },
]

hosts = [
    "https://clientauthconfig.googleapis.com/v1/clients",
    "https://clientauthconfig.clients6.google.com/v1/clients",
]

print("=== discovery with key ===")
st, disc = call(
    "GET",
    "https://clientauthconfig.googleapis.com/$discovery/rest?version=v1&key=" + KEYS[0],
    key=KEYS[0],
)
print("discovery", st, list((disc.get("resources") or {}).keys()) if isinstance(disc, dict) else disc)
if st == 200 and isinstance(disc, dict):
    methods = (disc.get("resources") or {}).get("clients", {}).get("methods", {})
    print("methods", list(methods.keys()))
    if "create" in methods:
        print("create", json.dumps(methods["create"])[:1500])
    schemas = disc.get("schemas") or {}
    for name, sch in schemas.items():
        if "client" in name.lower() or name in ("Client", "Brand"):
            print("schema", name, json.dumps(sch)[:1500])

print("\n=== list brands ===")
for url in [
    f"https://clientauthconfig.googleapis.com/v1/projects/{number}/brands",
    f"https://clientauthconfig.googleapis.com/v1/brands?parent=projects/{number}",
    f"https://clientauthconfig.googleapis.com/v1/brands?projectNumber={number}",
    f"https://clientauthconfig.clients6.google.com/v1/brands?projectNumber={number}&key=" + KEYS[0],
]:
    st, body = call("GET", url, key=KEYS[0])
    print("GET", st, url.split("google.com")[-1][:70], json.dumps(body)[:250] if isinstance(body, dict) else "")

print("\n=== create attempts ===")
for key in KEYS[:1]:
    for host in hosts:
        url = host + "?alt=json&key=" + key
        for i, p in enumerate(payloads):
            st, body = call("POST", url, p, key=key)
            msg = ""
            if isinstance(body, dict):
                if "clientId" in body or "client_id" in body or (body.get("web") or {}).get("client_id"):
                    # persist without printing secret
                    open("/tmp/gcp-web-client.json", "w").write(json.dumps(body))
                    print("SAVED create", i, host)
                    raise SystemExit(0)
                err = body.get("error") or {}
                msg = err.get("message") if isinstance(err, dict) else json.dumps(body)[:180]
            print("POST", i, st, host.split("//")[-1][:40], msg)
