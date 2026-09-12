#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/root/.hermes/profiles/leadgen/.env"

if ! grep -Eq '^DISCORD_BOT_TOKEN=.+$' "$ENV_FILE" 2>/dev/null; then
  echo "Missing DISCORD_BOT_TOKEN in $ENV_FILE"
  echo "Add the worker bot token, then run: leadgen gateway start"
  exit 1
fi

leadgen gateway start
