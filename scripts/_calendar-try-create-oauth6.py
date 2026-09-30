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
KEY = "AIzaSyCI-zsRP85RHtRdkKfsdApoZXbmVQclEr8"

def req(method, url):
    r = urllib.request.Request(url, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("x-goog-user-project", "my-drive-487311")
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, resp.read().decode()[:2000]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:2000]

urls = [
    f"https://clientauthconfig.googleapis.com/v1/brands?key={KEY}",
    f"https://clientauthconfig.googleapis.com/v1/brands?projectNumber=557060402856&key={KEY}",
    f"https://clientauthconfig.googleapis.com/v1/clients?projectNumber=557060402856&key={KEY}",
    f"https://clientauthconfig.googleapis.com/v1/clients:list?projectNumber=557060402856&key={KEY}",
    f"https://clientauthconfig.clients6.google.com/v1/brands?projectNumber=557060402856&alt=json&key={KEY}",
    f"https://clientauthconfig.clients6.google.com/v1/clients?projectNumber=557060402856&alt=json&key={KEY}",
    "https://iap.googleapis.com/v1/projects/my-drive-487311/brands",
    "https://oauth2.googleapis.com/v1/certs",
]
for url in urls:
    st, body = req("GET", url)
    print(f"\n{st} {url[:110]}")
    print(body[:500].replace("\n", " "))
