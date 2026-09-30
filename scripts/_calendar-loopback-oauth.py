#!/usr/bin/env python3
"""Loopback OAuth. GET /health is ignored. GET /oauth2callback captures the code."""
import json
import threading
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

secret = json.load(open("/root/.hermes/profiles/leadgen/google_client_secret.json"))
inst = secret["installed"]
CLIENT_ID = inst["client_id"]
CLIENT_SECRET = inst["client_secret"]
REDIRECT = "http://127.0.0.1:8765/oauth2callback"
SCOPES = "https://www.googleapis.com/auth/cloud-platform openid email"

result = {"code": None, "error": None}

class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
            return
        if u.path != "/oauth2callback":
            self.send_response(404)
            self.end_headers()
            return
        q = urllib.parse.parse_qs(u.query)
        if "error" in q:
            result["error"] = q["error"][0]
            body = b"Auth failed. You can close this tab."
        else:
            result["code"] = q.get("code", [None])[0]
            body = b"Aneeverse calendar setup: Google login OK. You can close this tab."
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(body)

httpd = HTTPServer(("127.0.0.1", 8765), H)
auth = (
    "https://accounts.google.com/o/oauth2/v2/auth?"
    + urllib.parse.urlencode(
        {
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "select_account consent",
        }
    )
)
open("/tmp/gcp-auth-url.txt", "w").write(auth)
print("AUTH_URL_READY", flush=True)
while result["code"] is None and result["error"] is None:
    httpd.handle_request()

if result["error"]:
    raise SystemExit("oauth error: " + result["error"])

token_req = urllib.parse.urlencode(
    {
        "code": result["code"],
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT,
        "grant_type": "authorization_code",
    }
).encode()
req = urllib.request.Request("https://oauth2.googleapis.com/token", data=token_req, method="POST")
with urllib.request.urlopen(req, timeout=30) as resp:
    tokens = json.loads(resp.read().decode())
open("/tmp/gcp-user.token.json", "w").write(json.dumps(tokens))
print("TOKEN_OK=1", flush=True)
print("HAS_REFRESH=" + str("refresh_token" in tokens), flush=True)
print("SCOPE=" + tokens.get("scope", ""), flush=True)
