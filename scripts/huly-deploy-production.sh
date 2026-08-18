#!/usr/bin/env bash
# Huly production deploy orchestrator for aneeverse.
# See docs/HULY-PRODUCTION-DEPLOY.md for full context.
set -euo pipefail

VPS="${HULY_VPS:-root@148.230.67.132}"
SSH_KEY="${HULY_SSH_KEY:-$HOME/.ssh/id_ed25519}"
SCP=(scp -o BatchMode=yes -i "$SSH_KEY")
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=20 -i "$SSH_KEY")
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: huly-deploy-production.sh <command>

Commands:
  front          Build tarball locally (if missing), upload, run huly-deploy-front.sh on VPS
  model-tracker  Upload and run huly-insert-issue-viewlets.sh (States/Dashboard for Issues)
  model-company  Upload and run huly-insert-company-app.sh (Company app + Project.company field)
  verify         Curl live site + check front container index.html on VPS
  help           Show this message

Environment:
  HULY_VPS       SSH target (default: root@148.230.67.132)
  HULY_SSH_KEY   SSH private key path
  SKIP_BUILD=1   Skip local webpack when deploying front (use existing huly-front-dist.tgz)

Examples:
  ./scripts/huly-deploy-production.sh front
  ./scripts/huly-deploy-production.sh model-tracker
  ./scripts/huly-deploy-production.sh model-company
  SKIP_BUILD=1 ./scripts/huly-deploy-production.sh front
EOF
}

cmd_front() {
  local tgz="$REPO_ROOT/dev/prod/huly-front-dist.tgz"
  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    echo "==== build front (Git Bash on Windows) ===="
    if [[ -f /e/programs/Git/bin/bash.exe ]]; then
      /e/programs/Git/bin/bash.exe -lc "cd '$REPO_ROOT/dev/prod' && NODE_OPTIONS=--max-old-space-size=8192 rushx package && rm -f huly-front-dist.tgz && cp -r public/huly dist/huly 2>/dev/null || true && rm -f dist/config.json && tar --exclude='*.map' --exclude='*.map.gz' --exclude='report.html' -czf huly-front-dist.tgz -C dist ."
    else
      echo "Run webpack manually — see docs/HULY-PRODUCTION-DEPLOY.md section A"
      exit 1
    fi
  fi
  [[ -f "$tgz" ]] || { echo "Missing $tgz"; exit 1; }
  echo "==== upload ===="
  "${SCP[@]}" "$tgz" "$REPO_ROOT/scripts/huly-deploy-front.sh" "$VPS:/tmp/"
  echo "==== deploy on VPS ===="
  "${SSH[@]}" "$VPS" 'bash /tmp/huly-deploy-front.sh'
}

cmd_model_tracker() {
  echo "==== upload model-tracker script ===="
  "${SCP[@]}" "$REPO_ROOT/scripts/huly-insert-issue-viewlets.sh" "$VPS:/tmp/"
  "${SSH[@]}" "$VPS" 'bash /tmp/huly-insert-issue-viewlets.sh'
}

cmd_model_company() {
  echo "==== upload model-company script ===="
  "${SCP[@]}" "$REPO_ROOT/scripts/huly-insert-company-app.sh" "$VPS:/tmp/"
  "${SSH[@]}" "$VPS" 'bash /tmp/huly-insert-company-app.sh'
}

cmd_verify() {
  echo "==== public ===="
  curl -sSI --max-time 15 https://huly.aneeverse.com/ | head -15
  echo "==== VPS front index ===="
  "${SSH[@]}" "$VPS" "docker exec huly_v7-front-1 cat /app/dist/index.html; docker ps --filter name=huly_v7-front --filter name=huly_v7-nginx --format 'table {{.Names}}\t{{.Status}}'"
}

case "${1:-help}" in
  front) cmd_front ;;
  model-tracker) cmd_model_tracker ;;
  model-company) cmd_model_company ;;
  verify) cmd_verify ;;
  help|-h|--help) usage ;;
  *) echo "Unknown command: $1"; usage; exit 1 ;;
esac
