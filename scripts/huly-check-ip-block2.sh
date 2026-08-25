#!/usr/bin/env bash
set -euo pipefail
IP=103.181.208.185
echo '==== iptables filter all DROP/REJECT ===='
iptables -S | grep -E 'DROP|REJECT|103.181' | head -80
echo
echo '==== iptables -L -n (INPUT/FORWARD/DOCKER) ===='
iptables -L INPUT -n -v --line-numbers | head -40
echo '--- FORWARD ---'
iptables -L FORWARD -n -v --line-numbers | head -40
echo
echo '==== nftables ===='
nft list ruleset 2>/dev/null | grep -E 'drop|reject|103.181' | head -40 || echo 'no nft or no matches'
echo
echo '==== security agents ===='
systemctl list-units --type=service --all 2>/dev/null | grep -Ei 'fail2ban|crowdsec|bitninja|imunify|csf|lfd|monarx|hostinger|firewall|waf|modsec' || true
dpkg -l 2>/dev/null | grep -Ei 'fail2ban|crowdsec|bitninja|imunify|csf|monarx|modsecurity' || true
echo
echo '==== /var/log mentions of IP ===='
grep -RIl --include='*.log' --include='*.log.1' "$IP" /var/log 2>/dev/null | head -20 || true
echo
echo '==== journal last 2d drop/ban ===='
journalctl --since '2 days ago' 2>/dev/null | grep -F "$IP" | tail -30 || true
echo
echo '==== nginx sites listen ===='
ss -tulpn | grep -E ':80|:443|:8087' || true
echo
echo '==== last access.log IPs ===='
awk '{print $1}' /var/log/nginx/access.log 2>/dev/null | sort | uniq -c | sort -nr | head -20
echo
echo '==== huly nginx access ===='
docker logs --since 48h huly_v7-nginx-1 2>/dev/null | grep -F "$IP" | tail -10 || true
echo
echo '==== host nginx error last ===='
tail -30 /var/log/nginx/error.log 2>/dev/null || true
echo
echo '==== whois-ish ===='
curl -sS --max-time 8 "https://ipinfo.io/$IP" || true
echo
echo '==== test local https ===='
curl -sS -o /dev/null -w 'local443:%{http_code}\n' --resolve app.aneeverse.com:443:127.0.0.1 https://app.aneeverse.com/ || true
