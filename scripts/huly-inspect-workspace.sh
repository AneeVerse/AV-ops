#!/usr/bin/env bash
set -euo pipefail
echo '==== compose services ===='
cd /opt/huly-selfhost
docker compose ps --format 'table {{.Name}}\t{{.Image}}\t{{.Status}}' | head -40
echo
echo '==== run-tool ===='
head -80 run-tool.sh
echo
echo '==== workspace env (trimmed) ===='
docker inspect huly_v7-workspace-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Ei 'DB|MONGO|COCKROACH|POSTGRES|ACCOUNT|SECRET|WORKSPACE|MODEL' || true
echo
echo '==== transactor env (trimmed) ===='
docker inspect huly_v7-transactor-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Ei 'DB|MONGO|COCKROACH|POSTGRES|ACCOUNT|SECRET|WORKSPACE|MODEL' || true
