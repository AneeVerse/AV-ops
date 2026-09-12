#!/usr/bin/env bash
set -u
LOG=/root/hermes-dashboard-post-update-validation.log
exec >"$LOG" 2>&1
printf 'started=%s\n' "$(date --iso-8601=seconds)"
systemctl --user restart hermes-dashboard.service
restart_rc=$?
printf 'restart_rc=%s\n' "$restart_rc"
local_code=000
for i in $(seq 1 60); do
  local_code=$(curl --max-time 5 -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:9119/ 2>/dev/null || true)
  if [ "$local_code" != "000" ]; then break; fi
  sleep 1
done
public_code=$(curl --max-time 20 -sS -o /dev/null -w '%{http_code}' https://bots.aneeverse.com/ 2>/dev/null || true)
printf 'local_http=%s\npublic_http=%s\n' "$local_code" "$public_code"
printf 'dashboard_state=%s\n' "$(systemctl --user is-active hermes-dashboard.service 2>/dev/null || true)"
printf 'dashboard_pid=%s\n' "$(systemctl --user show -p MainPID --value hermes-dashboard.service 2>/dev/null || true)"
printf 'version=%s\n' "$(hermes --version | head -1)"
bad=0
for s in $(systemctl --user list-unit-files --no-legend 'hermes-gateway*.service' | cut -d' ' -f1); do
  state=$(systemctl --user is-active "$s" 2>/dev/null || true)
  printf '%s=%s\n' "$s" "$state"
  [ "$state" = active ] || bad=$((bad+1))
done
printf 'inactive_gateways=%s\ncompleted=%s\n' "$bad" "$(date --iso-8601=seconds)"
if [ "$restart_rc" -eq 0 ] && [ "$local_code" != "000" ] && [ "$public_code" != "000" ] && [ "$bad" -eq 0 ]; then
  printf 'result=PASS\n'
  exit 0
fi
printf 'result=FAIL\n'
exit 1
