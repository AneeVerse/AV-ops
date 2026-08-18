#!/usr/bin/env bash
# Run ON THE VPS. Enables ufw 22/80/443 and blocks public docker ports 8081/8082/8087/8000.
# Use before deactivating Hostinger managed firewall if edge drops random client IPs.
# See docs/HULY-PRODUCTION-DEPLOY.md — Hostinger firewall section.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

iptables -C DOCKER-USER -i eth0 -p tcp --dport 8081 -j DROP 2>/dev/null || iptables -I DOCKER-USER -i eth0 -p tcp --dport 8081 -j DROP
iptables -C DOCKER-USER -i eth0 -p tcp --dport 8082 -j DROP 2>/dev/null || iptables -I DOCKER-USER -i eth0 -p tcp --dport 8082 -j DROP
iptables -C DOCKER-USER -i eth0 -p tcp --dport 8087 -j DROP 2>/dev/null || iptables -I DOCKER-USER -i eth0 -p tcp --dport 8087 -j DROP
iptables -C INPUT -i eth0 -p tcp --dport 8000 -j DROP 2>/dev/null || iptables -I INPUT -i eth0 -p tcp --dport 8000 -j DROP

mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4
if ! dpkg -s iptables-persistent >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq iptables-persistent
fi
netfilter-persistent save 2>/dev/null || true
echo "OS firewall lockdown done"
