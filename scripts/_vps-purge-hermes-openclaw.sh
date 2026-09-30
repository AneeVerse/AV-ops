#!/bin/bash
set -u
export XDG_RUNTIME_DIR=/run/user/0
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/0/bus

echo "=== 1) stop+mask user units ==="
UNITS=$(systemctl --user list-unit-files --no-legend --no-pager 2>/dev/null | awk '/^(hermes-|openclaw-|jwel-gemini-)/ {print $1}')
if [ -n "$UNITS" ]; then
  systemctl --user disable --now $UNITS 2>/dev/null || true
  systemctl --user mask $UNITS 2>/dev/null || true
fi
# force kill leftovers
pkill -9 -f 'hermes_cli' 2>/dev/null || true
pkill -9 -f 'openclaw/dist/index.js' 2>/dev/null || true
pkill -9 -f 'openclaw-gateway' 2>/dev/null || true

echo "=== 2) stop+disable system units ==="
for u in novino-gateway-proxy sales1-next sales-n8n-bridge automation-api hermes-dashboard-firewall; do
  systemctl disable --now "$u" 2>/dev/null || true
  rm -f "/etc/systemd/system/$u.service" "/etc/systemd/system/multi-user.target.wants/$u.service"
done
systemctl daemon-reload || true

echo "=== 3) remove nginx bot sites ==="
rm -f /etc/nginx/sites-enabled/bot.aneeverse.com /etc/nginx/sites-enabled/bots.aneeverse.com
rm -f /etc/nginx/sites-available/bot.aneeverse.com /etc/nginx/sites-available/bots.aneeverse.com
nginx -t && systemctl reload nginx

echo "=== 4) remove user systemd unit files ==="
rm -rf /root/.config/systemd/user/hermes-* \
       /root/.config/systemd/user/openclaw-* \
       /root/.config/systemd/user/jwel-gemini-* \
       /root/.config/systemd/user/default.target.wants/hermes-* \
       /root/.config/systemd/user/default.target.wants/openclaw-* \
       /root/.config/systemd/user/default.target.wants/jwel-gemini-* \
       /root/.config/systemd/user/*.service.d 2>/dev/null || true
# remove masked stubs
find /root/.config/systemd/user -maxdepth 1 -type l -name 'hermes-*' -delete 2>/dev/null || true
find /root/.config/systemd/user -maxdepth 1 -type l -name 'openclaw-*' -delete 2>/dev/null || true
find /etc/systemd/user -iname '*hermes*' -delete 2>/dev/null || true
find /etc/systemd/user -iname '*openclaw*' -delete 2>/dev/null || true
systemctl --user daemon-reload 2>/dev/null || true

echo "=== 5) uninstall openclaw npm global if present ==="
npm uninstall -g openclaw 2>/dev/null || true
rm -rf /usr/lib/node_modules/openclaw 2>/dev/null || true

echo "=== 6) remove hermes install ==="
rm -rf /usr/local/lib/hermes-agent /usr/local/bin/hermes 2>/dev/null || true
which hermes 2>/dev/null || echo hermes_bin_gone

echo "=== 7) remove data homes (FULL) ==="
# move projects pointers first
rm -rf /root/projects/hermes /root/projects/bot.aneeverse 2>/dev/null || true
# remove runtime data
rm -rf /root/.hermes /root/.openclaw /root/.hermes-last-update-backup 2>/dev/null || true
# openclaw swap leftover
swapoff /swapfile-openclaw 2>/dev/null || true
rm -f /swapfile-openclaw /etc/systemd/system/swapfile\\x2dopenclaw.swap 2>/dev/null || true
# bashrc completion line
sed -i '/openclaw\/completions/d' /root/.bashrc 2>/dev/null || true

echo "=== 8) leftover search ==="
pgrep -af 'hermes|openclaw' || echo 'no procs'
ls /root/.hermes /root/.openclaw 2>&1 | head
df -h / | tail -1
du -sh /root /var/lib/docker 2>/dev/null | head
echo REMOVE_DONE
