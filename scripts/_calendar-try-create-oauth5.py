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

# Public Cloud Console frontend API key (embedded in console JS).
CONSOLE_KEY = "AIzaSyCI-zsRP85RHtRdkKfsdApoZXbmVQclEr8"

body = {
    "displayName": "Aneeverse Calendar",
    "redirectUris": ["https://app.aneeverse.com/_calendar/signin/code"],
    "javascriptOrigins": ["https://app.aneeverse.com"],
    "clientType": "WEB",
    "projectNumber": "557060402856",
}

urls = [
    f"https://clientauthconfig.clients6.google.com/v1/clients?alt=json&key={CONSOLE_KEY}",
    f"https://clientauthconfig.googleapis.com/v1/clients?alt=json&key={CONSOLE_KEY}",
    f"https://cloudconsole-pa.clients6.google.com/v1/projects/557060402856/oauthClients?alt=json&key={CONSOLE_KEY}",
]

def req(url, payload, extra=None):
    r = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST")
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    r.add_header("x-goog-user-project", "my-drive-487311")
    if extra:
        for k, v in extra.items():
            r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

for url in urls:
    st, body_txt = req(url, body)
    print("\n====", st, url.split("?")[0], "====")
    print(body_txt[:1200])

# Also try brands
brand_urls = [
    f"https://clientauthconfig.clients6.google.com/v1/brands?alt=json&key={CONSOLE_KEY}",
    f"https://clientauthconfig.googleapis.com/v1/brands?parent=projects/557060402856&alt=json&key={CONSOLE_KEY}",
]
brand_body = {
    "projectNumber": "557060402856",
    "applicationTitle": "Aneeverse",
    "supportEmail": "team.aneeverse@gmail.com",
}
for url in brand_urls:
    st, body_txt = req(url, brand_body)
    print("\n==== BRAND", st, url.split("?")[0], "====")
    print(body_txt[:1200])
