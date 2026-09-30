#!/bin/bash
set -euo pipefail
python3 -m venv /tmp/gauth-venv
/tmp/gauth-venv/bin/pip install -q google-auth
cp /tmp/calendar-try-create-oauth.py /tmp/calendar-try-create-oauth2.py
# script already tries pip; just run with venv python
/tmp/gauth-venv/bin/python /tmp/calendar-try-create-oauth.py
