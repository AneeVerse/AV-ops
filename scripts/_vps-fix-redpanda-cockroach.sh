#!/bin/bash
set -euo pipefail
cd /opt/huly-selfhost
export CALENDAR_IMAGE="${CALENDAR_IMAGE:-$(docker inspect huly_v7-calendar-1 --format '{{.Config.Image}}' 2>/dev/null || true)}"
echo "CALENDAR_IMAGE=${CALENDAR_IMAGE:-unset}"
OV=compose.override.yml
cp -a "$OV" "${OV}.bak-redpanda-hc-$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path
p = Path('/opt/huly-selfhost/compose.override.yml')
t = p.read_text()
old = """  redpanda:
    deploy:
      resources:
        limits:
          memory: 512M
"""
new = """  redpanda:
    # Broker is fine without SASL on local healthcheck; SASL flags cause false "unhealthy".
    healthcheck:
      test: ["CMD", "rpk", "cluster", "info"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 512M
"""
if 'rpk", "cluster", "info"]' in t and 'user=' not in t.split('redpanda:')[1][:400]:
    # maybe already patched
    if 'CMD", "rpk", "cluster", "info"]' in t:
        print('healthcheck already patched')
    else:
        raise SystemExit('unexpected')
elif old not in t:
    raise SystemExit('redpanda block not found')
else:
    p.write_text(t.replace(old, new, 1))
    print('patched redpanda healthcheck')
PY

# Load env from huly_v7.conf if needed
set -a
# shellcheck disable=SC1091
[ -f ./huly_v7.conf ] && . ./huly_v7.conf || true
set +a

echo "=== recreate redpanda only (volume kept) ==="
# Prefer docker compose; fall back to docker recreate
if docker compose -f compose.yml -f compose.override.yml config >/dev/null 2>&1; then
  # calendar image blank may break full config - recreate via docker directly if needed
  docker compose -f compose.yml -f compose.override.yml up -d --no-deps --force-recreate redpanda 2>&1 | tee /tmp/rp-recreate.log | tail -20
else
  echo compose_config_failed
fi

# If compose failed due to calendar image, recreate manually from running config
if ! docker ps --format '{{.Names}}' | grep -q '^huly_v7-redpanda-1$'; then
  echo 'manual recreate fallback'
  # get previous container config is hard; just restart and update health via temporary approach
  docker start huly_v7-redpanda-1 || true
fi

# Soft CPU caps (no data risk): keep Cockroach from pegging both cores
docker update --cpus="1.0" huly_v7-cockroach-1 2>&1 || true
docker update --cpus="0.75" huly_v7-redpanda-1 2>&1 || true
docker update --cpus="0.5" huly_v7-elastic-1 2>&1 || true

echo "=== wait health ==="
for i in $(seq 1 24); do
  st=$(docker inspect huly_v7-redpanda-1 --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo missing)
  echo "t=${i}0s health=$st"
  if [ "$st" = "healthy" ]; then
    break
  fi
  sleep 10
done

echo "=== verify ==="
docker ps --filter name=huly_v7-redpanda --format '{{.Names}} {{.Status}}'
docker exec huly_v7-redpanda-1 rpk cluster info 2>&1 | head -25
curl -sk -o /dev/null -w 'huly:%{http_code}\n' --max-time 10 https://app.aneeverse.com/
curl -s -o /dev/null -w 'medusa:%{http_code}\n' --max-time 8 http://127.0.0.1:9000/health
uptime
vmstat 1 3 | tail -3
ps -o pid,pcpu,pmem,cmd -C cockroach --sort=-pcpu | head -3
echo FIX_DONE
