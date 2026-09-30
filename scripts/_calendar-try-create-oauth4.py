#!/usr/bin/env python3
import json, urllib.error, urllib.request
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SA_PATH = "/root/.hermes/profiles/leadgen/google_service_account.json"
creds = service_account.Credentials.from_service_account_file(
    SA_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
creds.refresh(Request())
token = creds.token
project = creds.project_id
number = 557060402856

def req(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    r.add_header("x-goog-user-project", project)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print("=== enable apikeys ===")
print(req("POST", f"https://serviceusage.googleapis.com/v1/projects/{project}/services/apikeys.googleapis.com:enable", {})[0],
      req("POST", f"https://serviceusage.googleapis.com/v1/projects/{project}/services/apikeys.googleapis.com:enable", {})[1][:300])

print("=== create api key ===")
st, body = req(
    "POST",
    f"https://apikeys.googleapis.com/v2/projects/{project}/locations/global/keys",
    {"displayName": "aneeverse-calendar-setup", "restrictions": {}},
)
print(st, body[:800])

payloads = [
    {
        "display_name": "Aneeverse Calendar",
        "redirect_uris": ["https://app.aneeverse.com/_calendar/signin/code"],
        "javascript_origins": ["https://app.aneeverse.com"],
        "client_type": 1,
        "project_number": str(number),
    },
    {
        "displayName": "Aneeverse Calendar",
        "redirectUris": ["https://app.aneeverse.com/_calendar/signin/code"],
        "javascriptOrigins": ["https://app.aneeverse.com"],
        "clientType": "WEB",
        "projectNumber": str(number),
    },
    {
        "display_name": "Aneeverse Calendar",
        "redirect_uris": ["https://app.aneeverse.com/_calendar/signin/code"],
        "client_type": "WEB",
        "project_id": project,
        "project_number": number,
    },
]
for i, p in enumerate(payloads):
    st, body = req("POST", "https://clientauthconfig.googleapis.com/v1/clients", p)
    print(f"\n=== payload {i} status {st} ===")
    print(body[:1500])
