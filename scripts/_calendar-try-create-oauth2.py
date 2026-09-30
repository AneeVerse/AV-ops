#!/usr/bin/env python3
import json
import urllib.error
import urllib.request
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SA_PATH = "/root/.hermes/profiles/leadgen/google_service_account.json"
creds = service_account.Credentials.from_service_account_file(
    SA_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
creds.refresh(Request())
token = creds.token
project = creds.project_id

def req(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()[:4000]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:4000]

print("=== discovery ===")
st, body = req("GET", "https://clientauthconfig.googleapis.com/$discovery/rest?version=v1")
print(st, body[:2500])

print("=== enable iap + crm ===")
for svc in ["iap.googleapis.com", "cloudresourcemanager.googleapis.com", "clientauthconfig.googleapis.com"]:
    st, body = req(
        "POST",
        f"https://serviceusage.googleapis.com/v1/projects/{project}/services/{svc}:enable",
        {},
    )
    print(svc, st, body[:250].replace("\n", " "))

print("=== calendar api status ===")
st, body = req(
    "GET",
    f"https://serviceusage.googleapis.com/v1/projects/{project}/services/calendar-json.googleapis.com",
)
print(st, body[:400].replace("\n", " "))

bodies = [
    {
        "displayName": "Aneeverse Calendar",
        "redirectUris": ["https://app.aneeverse.com/_calendar/signin/code"],
        "javascriptOrigins": ["https://app.aneeverse.com"],
        "clientType": "WEB",
    },
    {
        "client": {
            "display_name": "Aneeverse Calendar",
            "redirect_uris": ["https://app.aneeverse.com/_calendar/signin/code"],
            "javascript_origins": ["https://app.aneeverse.com"],
            "client_type": "WEB",
        }
    },
]
urls = [
    "https://clientauthconfig.googleapis.com/v1/clients",
    f"https://clientauthconfig.googleapis.com/v1/clients?parent=projects/{project}",
    f"https://clientauthconfig.googleapis.com/v1/projects/{project}/brands/-/clients",
]
for url in urls:
    for i, b in enumerate(bodies):
        st, body = req("POST", url, b)
        print("POST", url.split(".com")[-1], "body", i, st, body[:350].replace("\n", " "))
