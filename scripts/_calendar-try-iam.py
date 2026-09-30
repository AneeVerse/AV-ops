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

def req(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    r.add_header("x-goog-user-project", project)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()[:4000]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:4000]

print("project_get", req("GET", f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}"))
print("iam", req("POST", f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}:getIamPolicy", {}))

print("=== firebase ===")
print("firebase get", req("GET", f"https://firebase.googleapis.com/v1beta1/projects/{project}"))
st, body = req("POST", f"https://firebase.googleapis.com/v1beta1/projects/{project}:addFirebase", {})
print("addFirebase", st, body[:500].replace("\n"," "))

print("=== identitytoolkit ===")
print("itk", req("GET", f"https://identitytoolkit.googleapis.com/admin/v2/projects/{project}/config"))

print("=== gcloud dir ===")
import os
for root, dirs, files in os.walk("/root/.config"):
    for f in files:
        if "gcloud" in root or "chrome" in root.lower() or f.endswith(".db"):
            print(os.path.join(root, f))
