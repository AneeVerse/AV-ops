#!/usr/bin/env bash
set -u
echo "=== pm2 ==="
pm2 list
echo "=== obsidian ==="
systemctl is-active obsidian-web || true
ss -ltnp | grep -E '6080|8087|9000|8000|3000|54321|8001' || true
echo "=== http ==="
curl -s -o /dev/null -w 'huly8087 %{http_code}\n' http://127.0.0.1:8087/
curl -sk -o /dev/null -w 'app.aneeverse %{http_code}\n' --resolve app.aneeverse.com:443:127.0.0.1 https://app.aneeverse.com/
curl -sk -o /dev/null -w 'cultura %{http_code}\n' --resolve culturajewels.com:443:127.0.0.1 https://culturajewels.com/
curl -sk -o /dev/null -w 'studio %{http_code}\n' --resolve studio.aneeverse.com:443:127.0.0.1 https://studio.aneeverse.com/
curl -sk -o /dev/null -w 'supabase %{http_code}\n' --resolve supabase.aneeverse.com:443:127.0.0.1 https://supabase.aneeverse.com/
curl -sk -o /dev/null -w 'md %{http_code}\n' --resolve md.aneeverse.com:443:127.0.0.1 https://md.aneeverse.com/
echo "=== docker extra ==="
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'contentbeta|supabase|hermes|n8n' || true
echo "=== hermes procs ==="
ps aux | grep -E '[h]ermes|[n]8n' || echo none
echo "=== cultura counts ==="
sudo -u postgres psql -d onecarat_medusa -c "SELECT 'product', count(*) FROM product UNION ALL SELECT 'image', count(*) FROM image;"
echo "=== vault ==="
find /opt/av_ops/memory/obsidian -name '*.md' | wc -l
echo "=== tree ==="
find /opt/av_ops -maxdepth 3 -type d | sort
echo "=== pm2 logs backend ==="
pm2 logs backend --nostream --lines 20 || true
echo "=== pm2 logs frontend ==="
pm2 logs frontend --nostream --lines 15 || true
echo "=== pm2 logs contentbeta ==="
pm2 logs contentbeta --nostream --lines 15 || true
echo "=== obsidian app log ==="
tail -n 20 /var/log/obsidian-app.log || true
