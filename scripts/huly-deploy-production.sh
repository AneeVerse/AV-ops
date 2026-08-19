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
  all            Deploy front + model-client + model-company + model-company-drive + verify
  front          Build tarball locally (if missing), upload, run huly-deploy-front.sh on VPS
  model-tracker  Upload and run huly-insert-issue-viewlets.sh (States/Dashboard for Issues)
  model-company  Upload and run huly-insert-company-app.sh (Company app + Project.company field)
  model-company-drive  Upload company drive model patch (folder fields + triggers need ship + upgrade)
  model-client   Generate and apply Client classes/funnel/navigator into live model_tx
  verify         Curl live site + check front container index.html on VPS
  help           Show this message

Environment:
  HULY_VPS       SSH target (default: root@148.230.67.132)
  HULY_SSH_KEY   SSH private key path
  SKIP_BUILD=1   Skip local webpack when deploying front (use existing huly-front-dist.tgz)
  SKIP_FRONT=1   Skip front stage for `all`
  SKIP_MODEL_CLIENT=1         Skip model-client stage for `all`
  SKIP_MODEL_COMPANY=1        Skip model-company stage for `all`
  SKIP_MODEL_COMPANY_DRIVE=1  Skip model-company-drive stage for `all`
  SKIP_VERIFY=1               Skip verify stage for `all`

Examples:
  ./scripts/huly-deploy-production.sh front
  ./scripts/huly-deploy-production.sh model-tracker
  ./scripts/huly-deploy-production.sh model-company
  SKIP_BUILD=1 ./scripts/huly-deploy-production.sh front
EOF
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 1; }
}

preflight() {
  [[ -f "$SSH_KEY" ]] || { echo "SSH key not found: $SSH_KEY"; exit 1; }
  require_command ssh
  require_command scp
  require_command node
}

stage() {
  local name="$1"
  echo
  echo "==== stage: $name ===="
}

cmd_front() {
  preflight
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

cmd_model_company_drive() {
  echo "==== upload model-company-drive script ===="
  "${SCP[@]}" "$REPO_ROOT/scripts/huly-insert-company-drive.sh" "$VPS:/tmp/"
  "${SSH[@]}" "$VPS" 'bash /tmp/huly-insert-company-drive.sh'
}

cmd_model_client() {
  local sql="$REPO_ROOT/scripts/.huly-client-model.sql"
  echo "==== generate Client model SQL ===="
  node "$REPO_ROOT/scripts/huly-local-apply-fork-model.mjs" --dump-sql > "$sql"
  echo "==== upload model-client ===="
  "${SCP[@]}" "$sql" "$REPO_ROOT/scripts/huly-insert-client-model.sh" "$VPS:/tmp/"
  echo "==== apply on VPS ===="
  "${SSH[@]}" "$VPS" 'bash /tmp/huly-insert-client-model.sh /tmp/.huly-client-model.sql'
  rm -f "$sql"
}

cmd_verify() {
  preflight
  echo "==== public ===="
  curl -sSI --max-time 15 https://huly.aneeverse.com/ | head -15
  echo "==== VPS front index ===="
  "${SSH[@]}" "$VPS" "docker exec huly_v7-front-1 cat /app/dist/index.html; docker ps --filter name=huly_v7-front --filter name=huly_v7-nginx --format 'table {{.Names}}\t{{.Status}}'"
}

cmd_all() {
  preflight

  if [[ "${SKIP_FRONT:-0}" != "1" ]]; then
    stage "front"
    cmd_front
  else
    echo "Skipping front stage (SKIP_FRONT=1)"
  fi

  if [[ "${SKIP_MODEL_COMPANY:-0}" != "1" ]]; then
    stage "model-company"
    cmd_model_company
  else
    echo "Skipping model-company stage (SKIP_MODEL_COMPANY=1)"
  fi

  if [[ "${SKIP_MODEL_COMPANY_DRIVE:-0}" != "1" ]]; then
    stage "model-company-drive"
    cmd_model_company_drive
  else
    echo "Skipping model-company-drive stage (SKIP_MODEL_COMPANY_DRIVE=1)"
  fi

  # Client model must run after company patches — it owns Company app navigatorModel
  # (funnel spaces sidebar + SpaceView create-client button config).
  if [[ "${SKIP_MODEL_CLIENT:-0}" != "1" ]]; then
    stage "model-client"
    cmd_model_client
  else
    echo "Skipping model-client stage (SKIP_MODEL_CLIENT=1)"
  fi

  if [[ "${SKIP_VERIFY:-0}" != "1" ]]; then
    stage "verify"
    cmd_verify
  else
    echo "Skipping verify stage (SKIP_VERIFY=1)"
  fi
}

case "${1:-help}" in
  all) cmd_all ;;
  front) cmd_front ;;
  model-tracker) cmd_model_tracker ;;
  model-company) cmd_model_company ;;
  model-company-drive) cmd_model_company_drive ;;
  model-client) cmd_model_client ;;
  verify) cmd_verify ;;
  help|-h|--help) usage ;;
  *) echo "Unknown command: $1"; usage; exit 1 ;;
esac
