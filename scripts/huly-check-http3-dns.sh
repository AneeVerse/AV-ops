#!/usr/bin/env bash
set -euo pipefail
echo '==== DNS A/AAAA ===='
dig +short A app.aneeverse.com
dig +short AAAA app.aneeverse.com
dig +short A aneeverse.com
dig +short AAAA aneeverse.com
echo
echo '==== nginx http3/quic/altsvc ===='
grep -RIn --include='*.conf' -E 'http3|quic|alt-svc|listen .*443' /etc/nginx 2>/dev/null | head -50
echo
echo '==== curl headers ===='
curl -sSI https://app.aneeverse.com/ | head -30
echo
echo '==== udp 443 listen ===='
ss -ulpn | grep -E ':443|:80' || echo 'no udp 80/443'
echo
echo '==== ipv6 ping local ===='
ip -6 addr show eth0 | head -20
echo
echo '==== access 103.181.208 ===='
grep -h '103.181.208' /var/log/nginx/access.log /var/log/nginx/access.log.1 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -nr
echo
echo '==== ipv6 access sample ===='
awk '$1 ~ /:/ {print $1}' /var/log/nginx/access.log 2>/dev/null | sort | uniq -c | sort -nr | head -15
echo
echo '==== ip6tables DROP ===='
ip6tables -S 2>/dev/null | grep -E 'DROP|REJECT|80|443' | head -30 || echo 'no ip6tables'
echo
echo '==== huly site conf ===='
ls /etc/nginx/sites-enabled
echo '---'
grep -n 'listen\|server_name\|add_header\|quic' /etc/nginx/sites-enabled/app.aneeverse.com 2>/dev/null || grep -n 'listen\|server_name' /etc/nginx/sites-available/app.aneeverse.com 2>/dev/null | head -40
