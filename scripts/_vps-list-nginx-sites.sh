#!/usr/bin/env bash
tar -tzf /root/vps-restore-backup/infra/nginx.tar.gz | grep sites-available
echo "=== cert live on disk ==="
ls /etc/letsencrypt/live 2>/dev/null || echo no_live
echo "=== dns ==="
getent hosts bots.aneeverse.com || true
