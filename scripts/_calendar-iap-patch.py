#!/usr/bin/env python3
import json, urllib.error, urllib.request

tokens = json.load(open("/tmp/gcp-user.token.json"))
access = tokens["access_token"]
name = "projects/192773262442/brands/192773262442/identityAwareProxyClients/192773262442-43g2mm2cikcvk5v7jg3fp6m8763gsvoj.apps.googleusercontent.com"
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
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:500]}

print("get", req("GET", f"https://iap.googleapis.com/v1/{name}"))
print("patch", req("PATCH", f"https://iap.googleapis.com/v1/{name}?updateMask=displayName", {"displayName": "Aneeverse Calendar"}))
print("list", req("GET", "https://iap.googleapis.com/v1/projects/192773262442/brands/192773262442/identityAwareProxyClients"))
# Save IAP client to disk without printing secret
# (already stored in previous response on the VM memory only — rewrite from env if file missing)
print("done")
