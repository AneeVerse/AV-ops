#!/usr/bin/env python3
"""After loopback login: refresh token, inspect identity, list OAuth clients.
Never prints secrets or access tokens.
"""
import json
import urllib.error
import urllib.parse
import urllib.request

TOK = "/tmp/gcp-user.token.json"
secret = json.load(open("/root/.hermes/profiles/leadgen/google_client_secret.json"))
inst = secret["installed"]
tokens = json.load(open(TOK))


def post_form(url, data):
    body = urllib.parse.urlencode(data).encode()
    r = urllib.request.Request(url, data=body, method="POST")
    r.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())


def req(method, url, access, body=None):
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
            parsed = {"raw": raw[:800]}
        return e.code, parsed


if tokens.get("refresh_token"):
    refreshed = post_form(
        "https://oauth2.googleapis.com/token",
        {
            "client_id": inst["client_id"],
            "client_secret": inst["client_secret"],
            "refresh_token": tokens["refresh_token"],
            "grant_type": "refresh_token",
        },
    )
    tokens["access_token"] = refreshed["access_token"]
    if refreshed.get("refresh_token"):
        tokens["refresh_token"] = refreshed["refresh_token"]
    open(TOK, "w").write(json.dumps(tokens, indent=2))
    print("token_refreshed=1")
else:
    print("token_refreshed=0")

access = tokens["access_token"]
st, info = req("GET", "https://www.googleapis.com/oauth2/v2/userinfo", access)
print("user", st, {k: info.get(k) for k in ("email", "verified_email", "hd") if isinstance(info, dict)})

project_id = open("/tmp/gcp-cal-project.txt").read().strip()
print("project", project_id)
st, proj = req("GET", f"https://cloudresourcemanager.googleapis.com/v1/projects/{project_id}", access)
print("project_get", st, {k: proj.get(k) for k in ("projectId", "projectNumber", "name", "lifecycleState")})
number = str(proj.get("projectNumber", "192773262442"))

st, disc = req("GET", "https://clientauthconfig.googleapis.com/$discovery/rest?version=v1", access)
if st == 200 and isinstance(disc, dict):
    resources = list((disc.get("resources") or {}).keys())
    print("discovery_resources", resources)
    clients = (disc.get("resources") or {}).get("clients", {}).get("methods", {})
    print("clients_methods", list(clients.keys()))
    if "create" in clients:
        print("create_path", clients["create"].get("path"), "http", clients["create"].get("httpMethod"))
        print("create_params", list((clients["create"].get("parameters") or {}).keys())[:20])
        schema_ref = clients["create"].get("request", {})
        print("create_request", json.dumps(schema_ref)[:400])
    schemas = disc.get("schemas") or {}
    for name in ("Client", "OAuthClient", "Brand", "WebClient"):
        if name in schemas:
            print("schema", name, json.dumps(schemas[name])[:1200])
else:
    print("discovery", st, json.dumps(disc)[:400] if isinstance(disc, dict) else disc)

print("\n=== list clients ===")
for url in [
    f"https://clientauthconfig.googleapis.com/v1/projects/{number}/clients",
    f"https://clientauthconfig.googleapis.com/v1/clients?projectNumber={number}",
    f"https://iap.googleapis.com/v1/projects/{number}/brands/{number}/identityAwareProxyClients",
]:
    st, body = req("GET", url, access)
    keys = list(body.keys()) if isinstance(body, dict) else type(body).__name__
    print("GET", st, url.split(".com")[-1][:80], keys, json.dumps(body)[:350] if isinstance(body, dict) else "")
