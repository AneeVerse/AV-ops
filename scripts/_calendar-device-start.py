#!/usr/bin/env python3
"""Start Google device-code login with the existing desktop OAuth client.
Prints only verification_url + user_code. Writes token to /tmp/gcp-user.token.json if approved.
"""
import json, time, urllib.parse, urllib.request, urllib.error

secret = json.load(open("/root/.hermes/profiles/leadgen/google_client_secret.json"))
inst = secret["installed"]
client_id = inst["client_id"]
client_secret = inst["client_secret"]

def post(url, data):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} {e.read().decode()[:800]}")

dc = post(
    "https://oauth2.googleapis.com/device/code",
    {
        "client_id": client_id,
        "scope": "https://www.googleapis.com/auth/cloud-platform openid email",
    },
)
out = {
    "verification_url": dc.get("verification_url") or dc.get("verification_uri"),
    "user_code": dc.get("user_code"),
    "device_code": dc.get("device_code"),
    "interval": dc.get("interval", 5),
    "expires_in": dc.get("expires_in"),
}
open("/tmp/gcp-device.json", "w").write(json.dumps(out))
print("VERIFICATION_URL=" + out["verification_url"])
print("USER_CODE=" + out["user_code"])
print("EXPIRES=" + str(out["expires_in"]))
