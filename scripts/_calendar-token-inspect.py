#!/usr/bin/env python3
import json, os
print("log:")
print(open("/tmp/calendar-loopback.log").read())
p = "/tmp/gcp-user.token.json"
print("token_file", os.path.exists(p))
if os.path.exists(p):
    d = json.load(open(p))
    print("keys", sorted(d.keys()))
    print("scope", d.get("scope", ""))
    print("has_access", "access_token" in d)
    print("has_refresh", "refresh_token" in d)
    print("token_type", d.get("token_type"))
    print("expires_in", d.get("expires_in"))
