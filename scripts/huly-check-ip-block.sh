#!/usr/bin/env bash
set -euo pipefail
IP=103.181.208.185
echo '==== host ===='
hostname; date -u
echo
echo '==== ufw ===='
ufw status verbose 2>/dev/null || echo 'no ufw'
echo
echo '==== iptables INPUT drops involving IP ===='
iptables -S INPUT 2>/dev/null | grep -E "$IP|DROP|REJECT" | head -50 || true
echo
echo '==== nft/ipset ===='
ipset list 2>/dev/null | head -40 || echo 'no ipset'
echo
echo '==== fail2ban ===='
fail2ban-client status 2>/dev/null || echo 'no fail2ban'
if command -v fail2ban-client >/dev/null; then
  fail2ban-client status 2>/dev/null | awk '/Jail list/{print}'
  for j in $(fail2ban-client status 2>/dev/null | sed -n 's/.*Jail list:\s*//p' | tr ',' ' '); do
    echo "-- jail $j"
    fail2ban-client status "$j" 2>/dev/null | grep -E 'Currently banned|Banned IP|Total banned' || true
    fail2ban-client get "$j" banned 2>/dev/null | grep -F "$IP" && echo "FOUND in $j" || true
  done
fi
echo
echo '==== nginx deny ===='
grep -RIn --include='*.conf' -E "deny $IP|allow $IP|deny all|$IP" /etc/nginx 2>/dev/null | head -40 || true
echo
echo '==== hosts.deny / allow ===='
grep -n "$IP" /etc/hosts.deny /etc/hosts.allow 2>/dev/null || echo 'not in hosts.deny/allow'
echo
echo '==== recent nginx access from IP ===='
grep -h "$IP" /var/log/nginx/access.log /var/log/nginx/access.log.1 2>/dev/null | tail -20 || true
echo
echo '==== recent nginx error from IP ===='
grep -h "$IP" /var/log/nginx/error.log /var/log/nginx/error.log.1 2>/dev/null | tail -20 || true
echo
echo '==== firewalld ===='
firewall-cmd --list-all 2>/dev/null | head -40 || echo 'no firewalld'
echo
echo '==== csf ===='
csf -g "$IP" 2>/dev/null | head -20 || echo 'no csf'
echo
echo '==== crowdsec ===='
cscli decisions list 2>/dev/null | grep -F "$IP" || echo 'no crowdsec match'
echo
echo '==== docker nginx / huly ===='
docker exec huly_v7-nginx-1 sh -c "grep -RIn '$IP\|deny ' /etc/nginx 2>/dev/null | head" || true
