#!/usr/bin/env python3
"""Try to enable Calendar API and create a Web OAuth client using the Drive SA.
Prints status only — never prints private keys or client secrets.
"""
import json
import os
import sys
import urllib.error
import urllib.request

SA_PATH = "/root/.hermes/profiles/leadgen/google_service_account.json"

def sa_token(scopes):
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    creds = service_account.Credentials.from_service_account_file(SA_PATH, scopes=scopes)
    creds.refresh(Request())
    return creds.token, creds.project_id

def req(method, url, token, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, raw[:2000]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:2000]

def main():
    try:
        from google.oauth2 import service_account  # noqa: F401
    except ImportError:
        os.system("pip3 install -q google-auth 2>/dev/null")
        from google.oauth2 import service_account  # noqa: F401

    token, project = sa_token(["https://www.googleapis.com/auth/cloud-platform"])
    print("project", project)
    print("token_ok", bool(token))

    status, body = req(
        "GET",
        f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}",
        token,
    )
    print("project_get", status, body[:400].replace("\n", " "))

    status, body = req(
        "POST",
        f"https://serviceusage.googleapis.com/v1/projects/{project}/services/calendar-json.googleapis.com:enable",
        token,
        {},
    )
    print("enable_calendar", status, body[:400].replace("\n", " "))

    # Consent brand (IAP-style public API that sometimes works for brands)
    status, body = req(
        "GET",
        f"https://iap.googleapis.com/v1/projects/{project}/brands",
        token,
    )
    print("iap_brands", status, body[:400].replace("\n", " "))

    # Internal clientauthconfig used by Cloud Console
    for url in [
        f"https://clientauthconfig.googleapis.com/v1/projects/{project}/clients",
        f"https://clientauthconfig.googleapis.com/v1/clients?parent=projects/{project}",
    ]:
        status, body = req("GET", url, token)
        print("list", url.split("googleapis.com")[-1], status, body[:300].replace("\n", " "))

    create_body = {
        "display_name": "Aneeverse Calendar",
        "redirect_uris": ["https://app.aneeverse.com/_calendar/signin/code"],
        "javascript_origins": ["https://app.aneeverse.com"],
        "client_type": 1,  # WEB in some schemas
    }
    for url in [
        f"https://clientauthconfig.googleapis.com/v1/projects/{project}/clients",
        "https://clientauthconfig.googleapis.com/v1/clients",
    ]:
        status, body = req("POST", url, token, create_body)
        print("create", url.split("googleapis.com")[-1], status, body[:400].replace("\n", " "))

if __name__ == "__main__":
    main()
