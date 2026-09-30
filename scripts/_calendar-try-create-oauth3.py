#!/usr/bin/env python3
import json, glob, urllib.error, urllib.request
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SA_PATH = "/root/.hermes/profiles/leadgen/google_service_account.json"
creds = service_account.Credentials.from_service_account_file(
    SA_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
creds.refresh(Request())
token = creds.token
project = creds.project_id
number = "557060402856"

print("=== hermes accounts ===")
for p in sorted(glob.glob("/root/.hermes/profiles/*/google_token.json")):
    try:
        d = json.load(open(p))
        print(p.split("/")[-2], "account=", d.get("account"))
    except Exception as e:
        print(p, type(e).__name__)

def req(method, url, body=None, extra=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    r.add_header("x-goog-user-project", project)
    if extra:
        for k, v in extra.items():
            r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()[:3000]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:3000]

print("=== iap brands list ===")
print(req("GET", f"https://iap.googleapis.com/v1/projects/{project}/brands")[0:2])
print(req("GET", f"https://iap.googleapis.com/v1/projects/{number}/brands"))

print("=== create brand ===")
for email in ["drive-access@my-drive-487311.iam.gserviceaccount.com"]:
    st, body = req(
        "POST",
        f"https://iap.googleapis.com/v1/projects/{project}/brands",
        {"applicationTitle": "Aneeverse", "supportEmail": email},
    )
    print("brand", email, st, body[:500].replace("\n", " "))

print("=== clientauthconfig variants ===")
payloads = [
    {"project_id": project, "display_name": "Aneeverse Calendar", "redirect_uris": ["https://app.aneeverse.com/_calendar/signin/code"], "client_type": 1},
    {"projectId": project, "displayName": "Aneeverse Calendar", "redirectUris": ["https://app.aneeverse.com/_calendar/signin/code"], "clientType": 1},
    {"parent": f"projects/{number}", "displayName": "Aneeverse Calendar", "redirectUris": ["https://app.aneeverse.com/_calendar/signin/code"], "clientType": "CLIENT_TYPE_WEB"},
]
for parent in [f"projects/{number}", f"projects/{project}", f"{number}"]:
    st, body = req("GET", f"https://clientauthconfig.googleapis.com/v1/clients?parent={parent}")
    print("LIST parent", parent, st, body[:250].replace("\n", " "))

for i, p in enumerate(payloads):
    for url in [
        "https://clientauthconfig.googleapis.com/v1/clients",
        f"https://clientauthconfig.googleapis.com/v1/clients?parent=projects/{number}",
    ]:
        st, body = req("POST", url, p)
        print("CREATE", i, url[-40:], st, body[:300].replace("\n", " "))
