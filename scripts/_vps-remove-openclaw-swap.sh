#!/bin/bash
set -u
# remove openclaw swap safely
if grep -q swapfile-openclaw /proc/swaps 2>/dev/null; then
  swapoff /swapfile-openclaw || swapoff -a
fi
sed -i '/swapfile-openclaw/d' /etc/fstab
# chattr -i if immutable
chattr -i /swapfile-openclaw 2>/dev/null || true
rm -f /swapfile-openclaw
ls -la /swapfile-openclaw 2>&1 | head
grep swap /etc/fstab || echo 'fstab_swap_ok'
free -h | head -3
docker restart huly_v7-redpanda-1 >/dev/null
sleep 2
uptime
vmstat 1 4 | tail -4
echo FINAL
curl -s -o /dev/null -w 'medusa:%{http_code} ' --max-time 8 http://127.0.0.1:9000/health
curl -sk -o /dev/null -w 'huly:%{http_code} studio:%{http_code} n8n:%{http_code}\n' --max-time 8 https://app.aneeverse.com/ https://studio.aneeverse.com/ https://n8n.aneeverse.com/
ls /etc/nginx/sites-enabled/
pgrep -af 'hermes_cli|openclaw' || echo bots_gone
df -h / | tail -1
