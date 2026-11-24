#!/usr/bin/env bash
# Read-only Hermes health check. Run on the VPS as root.
# No production writes, no email, no workflow changes.
# Pass --with-model to also ask the avops profile for a one-word reply.
set -euo pipefail

export HERMES_HOME=/opt/av_ops/docker/hermes_agent
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/0}"
HERMES=/opt/av_ops/docker/hermes_agent/hermes-agent/.hermes/bin/hermes
fail=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    fail=1
  fi
}

check gateway systemctl --user is-active --quiet hermes-gateway.service
check mcp_http curl -sf -m 5 http://127.0.0.1:8765/health
check vault_mount findmnt -n /var/lib/avops/obsidian-ro
if touch /var/lib/avops/obsidian-ro/.hermes-write-test 2>/dev/null; then
  rm -f /var/lib/avops/obsidian-ro/.hermes-write-test
  echo "FAIL vault_readonly"
  fail=1
else
  echo "PASS vault_readonly"
fi
check vault_note test -f /var/lib/avops/obsidian-ro/08_business_knowledge/ocean9-services.md

python3 - << 'PY'
import json, subprocess, sys
payloads = [
    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"health","version":"0"}}},
    {"jsonrpc":"2.0","method":"notifications/initialized"},
    {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_unassigned_issues","arguments":{"limit":20}}},
]
data = "".join(json.dumps(p) + "\n" for p in payloads)
proc = subprocess.run(["/usr/local/bin/node","/opt/av_ops/docker/avops-mcp/server.mjs"], input=data, text=True, capture_output=True, timeout=40)
lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
if not lines:
    print("FAIL mcp_unassigned")
    sys.exit(1)
msg = json.loads(lines[-1])
if msg.get("result", {}).get("isError"):
    print("FAIL mcp_unassigned")
    sys.exit(1)
body = json.loads(msg["result"]["content"][0]["text"])
count = body.get("returned_count")
items = body.get("items") or []
if count != len(items):
    print("FAIL mcp_unassigned_count")
    sys.exit(1)
print(f"PASS mcp_unassigned returned_count={count}")
PY

if ! python3 - << 'PY'
import json, subprocess, sys
payloads = [
    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"health","version":"0"}}},
    {"jsonrpc":"2.0","method":"notifications/initialized"},
    {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo_test","arguments":{"input":"AV OPS TEST"}}},
]
data = "".join(json.dumps(p) + "\n" for p in payloads)
try:
    proc = subprocess.run(["/usr/local/bin/node","/opt/av_ops/docker/avops-n8n-echo/server.mjs"], input=data, text=True, capture_output=True, timeout=20)
except subprocess.TimeoutExpired:
    print("FAIL n8n_echo timeout")
    sys.exit(1)
lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
if not lines:
    print("FAIL n8n_echo empty")
    sys.exit(1)
msg = json.loads(lines[-1])
text = msg.get("result", {}).get("content", [{}])[0].get("text", "")
if msg.get("result", {}).get("isError") or "AV OPS TEST OK" not in text:
    print("FAIL n8n_echo " + text[:180].replace("\n", " "))
    sys.exit(1)
print("PASS n8n_echo")
PY
then
  fail=1
fi

if [ "${1:-}" = "--with-model" ]; then
  reply=$(timeout 90 "$HERMES" -p avops chat -q "Reply with the single word PONG." -Q --reasoning low --max-turns 2 || true)
  if printf '%s' "$reply" | grep -q "PONG"; then
    echo "PASS model"
  else
    echo "FAIL model"
    fail=1
  fi
fi

exit "$fail"
