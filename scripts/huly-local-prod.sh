#!/usr/bin/env bash
# Tunnel production docker nginx to localhost, then run local webpack against that stack.
# Usage (Git Bash): ./scripts/huly-local-prod.sh
set -euo pipefail

VPS="${HULY_VPS:-root@148.230.67.132}"
SSH_KEY="${HULY_SSH_KEY:-$HOME/.ssh/id_ed25519}"
LOCAL_PORT="${HULY_LOCAL_TUNNEL_PORT:-18087}"

echo "==== SSH tunnel  localhost:${LOCAL_PORT}  ->  ${VPS}:127.0.0.1:8087 ===="
echo "Keep this window open. In another terminal:"
echo "  cd dev/prod"
echo "  HULY_PROD_PROXY=http://127.0.0.1:${LOCAL_PORT} rushx dev-aneeverse"
echo "Then open http://localhost:8080  (login with the same production account)"
echo

exec ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -i "$SSH_KEY" \
  -L "${LOCAL_PORT}:127.0.0.1:8087" \
  "$VPS"
