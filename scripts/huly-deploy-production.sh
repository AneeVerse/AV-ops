#!/usr/bin/env bash
# One-command production deploy for app.aneeverse.com.
# See docs/HULY-PRODUCTION-DEPLOY.md. Day to day, run deploy.cmd instead.
#
#   ./scripts/huly-deploy-production.sh            # validate -> build -> ship -> smoke
#
# Stages are skipped automatically when nothing they care about changed.
set -euo pipefail

VPS="${HULY_VPS:-root@148.230.67.132}"
SSH_KEY="${HULY_SSH_KEY:-$HOME/.ssh/id_ed25519}"
SCP=(scp -o BatchMode=yes -i "$SSH_KEY")
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=20 -i "$SSH_KEY")
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROD="$REPO_ROOT/dev/prod"
DIST="$PROD/dist"
# Deliberately not FRONT_URL: that name is used by local dev tooling and a stray
# value in the environment would silently point verify/smoke at localhost.
FRONT_URL="${HULY_FRONT_URL:-https://app.aneeverse.com}"

# Paths whose contents end up in the front bundle.
FRONT_PATHS=(plugins packages foundations models dev/prod/src dev/prod/webpack.config.js dev/prod/package.json)
# Paths whose contents end up in the account service bundle.
ACCOUNT_PATHS=(server/account pods/account foundations/core/packages/account-client)
# Paths whose contents end up in the calendar service bundle.
CALENDAR_PATHS=(services/calendar plugins/calendar)
# Paths that need custom backend images this deploy path cannot build. The
# account and calendar pods are excluded: those stages below do build them.
SERVER_PATHS=(server server-plugins pods services)

usage() {
  cat <<'EOF'
Usage: huly-deploy-production.sh [command]

Commands:
  deploy       (default) validate -> account -> front -> model -> smoke, skipping what did not change
  validate     Local pre-build checks only (seconds)
  account      Force build + ship the custom account image (server/account code)
  calendar     Force build + ship the custom calendar image (Google Meet / event id)
  front        Force build + ship the front bundle
  model        Force a model sync (push models/** edits into model_tx)
  smoke        Run the logged-in production smoke test
  rollback     Switch production back to the previous front image
  account-rollback  Switch the account service back to its previous image
  calendar-rollback Switch the calendar service back to its previous image
  verify       Show live headers + deployed image/state
  status       Show what would be deployed and why
  prune        Reclaim docker disk space on the VPS
  help         This message

Environment:
  HULY_VPS / HULY_SSH_KEY   SSH target and key
  FRESH=1                   Discard the webpack cache and build from scratch
  FORCE=1                   Deploy even when nothing changed
  SKIP_SMOKE=1              Skip the post-deploy smoke test
  NO_ROLLBACK=1             Leave a failed deploy live instead of rolling back
  ALLOW_SERVER_CHANGES=1    Proceed even though server code changed (front only)
EOF
}

say() { echo; echo "=========== $* ==========="; }
info() { echo "  $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

preflight() {
  [ -f "$SSH_KEY" ] || die "SSH key not found: $SSH_KEY"
  for c in ssh scp tar git node comm; do
    command -v "$c" >/dev/null 2>&1 || die "missing required command: $c"
  done
  "${SSH[@]}" "$VPS" 'true' >/dev/null 2>&1 || die "cannot reach $VPS over SSH"

  # A paused container makes docker exec/cp hang forever, which has broken a
  # deploy before.
  local paused
  paused=$("${SSH[@]}" "$VPS" \
    "docker ps --filter name=front --filter name=nginx --filter status=paused --format '{{.Names}}'")
  if [ -n "$paused" ]; then
    info "unpausing: $(echo "$paused" | tr '\n' ' ')"
    echo "$paused" | while IFS= read -r c; do
      [ -n "$c" ] && "${SSH[@]}" "$VPS" "docker unpause '$c'" >/dev/null
    done
  fi
}

# Fingerprint of everything that affects the front bundle: committed tree plus
# uncommitted edits plus untracked files.
front_fingerprint() {
  cd "$REPO_ROOT"
  {
    git rev-parse HEAD
    git diff HEAD -- "${FRONT_PATHS[@]}"
    git ls-files --others --exclude-standard -- "${FRONT_PATHS[@]}" |
      while IFS= read -r f; do [ -f "$f" ] && git hash-object "$f"; done
  } 2>/dev/null | node -e '
    const h = require("crypto").createHash("sha256")
    process.stdin.on("data", (d) => h.update(d))
    process.stdin.on("end", () => console.log(h.digest("hex").slice(0, 16)))
  '
}

STATE_CACHE=
remote_state() {
  if [ -z "$STATE_CACHE" ]; then
    STATE_CACHE=$("${SSH[@]}" "$VPS" 'cat /opt/huly-front/state.env 2>/dev/null || true')
    [ -n "$STATE_CACHE" ] || STATE_CACHE="#empty"
  fi
  [ "$STATE_CACHE" = "#empty" ] || printf '%s\n' "$STATE_CACHE"
}

state_value() {
  remote_state | sed -n "s/^$1=//p" | head -1
}

# Files changed relative to what is actually live, falling back to the working
# tree when the deployed commit is unknown.
changed_paths() {
  cd "$REPO_ROOT"
  local base
  base=$(state_value GIT_SHA)
  if [ -z "$base" ] || [ "$base" = "unknown" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
    base=HEAD
  fi
  {
    git diff --name-only "$base" -- "$@"
    git ls-files --others --exclude-standard -- "$@"
  } 2>/dev/null | LC_ALL=C sort -u
}

# --------------------------------------------------------------- validate ----
cmd_validate() {
  say "validate"
  info "plugin id collisions"
  node "$REPO_ROOT/scripts/huly-check-plugin-ids.mjs"

  # The account stage ships these, so they are not "unbuildable server changes".
  local server_changes
  server_changes=$(changed_paths "${SERVER_PATHS[@]}" | grep -E '/src/|\.ts$' |
    grep -vE '^(server/account/|pods/account/|services/calendar/)' || true)
  if [ -n "$server_changes" ]; then
    echo
    echo "  Server-side source changed:"
    echo "$server_changes" | sed 's/^/    /'
    echo
    echo "  Production runs official hardcoreeng/*:${HULY_VERSION:-v0.7.426} images, so these"
    echo "  changes will NOT reach production through a front-bundle deploy."
    echo "  They need custom backend images (see docs/HULY-PRODUCTION-DEPLOY.md section C)."
    if [ "${ALLOW_SERVER_CHANGES:-0}" != "1" ]; then
      die "refusing to report a misleading success — re-run with ALLOW_SERVER_CHANGES=1 to deploy the front only"
    fi
    info "ALLOW_SERVER_CHANGES=1 — continuing with front only"
  fi

  local model_changes
  model_changes=$(changed_paths models | grep -E '/src/.*\.ts$' || true)
  if [ -n "$model_changes" ]; then
    echo
    echo "  Model source changed:"
    echo "$model_changes" | sed 's/^/    /'
    info "The deploy will push these into model_tx after the front ships (see 'sync model')."
    info "Docs created without an explicit id cannot be synced — see docs/HULY-PRODUCTION-DEPLOY.md."
  fi
  info "ok"
}

# ------------------------------------------------------------------ build ----
cmd_build() {
  say "build front bundle"
  if [ "${FRESH:-0}" = "1" ]; then
    info "FRESH=1 — clearing webpack cache and dist"
    rm -rf "$PROD/.build_prod" "$DIST"
  fi
  mkdir -p "$DIST"

  # USE_CACHE turns on webpack's filesystem cache, which is the difference
  # between a ~15 min cold build and a couple of minutes.
  if command -v rushx >/dev/null 2>&1; then
    ( cd "$PROD" && USE_CACHE=true NODE_OPTIONS=--max-old-space-size=8192 rushx package )
  else
    # No global rush (e.g. CI) — use the bundled bootstrapper.
    ( cd "$PROD" && USE_CACHE=true NODE_OPTIONS=--max-old-space-size=8192 \
        node "$REPO_ROOT/common/scripts/install-run-rushx.js" package )
  fi

  cp -r "$PROD/public/huly" "$DIST/huly" 2>/dev/null || true
  # config.json is generated by the front container from its environment.
  rm -f "$DIST/config.json"
  [ -f "$DIST/index.html" ] || die "build produced no dist/index.html"

  # Guard against a half-written dist (e.g. two builds racing into the folder).
  local missing=0
  for src in $(grep -oE 'src="/[^"]+\.js"' "$DIST/index.html" | sed -e 's|src="/||' -e 's|"$||'); do
    if [ ! -f "$DIST/$src" ]; then
      echo "  MISSING: $src"
      missing=$((missing + 1))
    fi
  done
  [ "$missing" -eq 0 ] || die "$missing script(s) in index.html are missing from dist — build is inconsistent"
  info "dist ok ($(find "$DIST" -type f | wc -l) files, $(du -sh "$DIST" | cut -f1))"
}

# ------------------------------------------------------------------- ship ----
dist_manifest_hash() {
  node "$REPO_ROOT/scripts/huly-dist-manifest.mjs" "$DIST" | node -e '
    const h = require("crypto").createHash("sha256")
    process.stdin.on("data", (d) => h.update(d))
    process.stdin.on("end", () => console.log(h.digest("hex").slice(0, 16)))
  '
}

cmd_ship() {
  say "ship front"
  local work tag local_mf remote_mf upload_list keep
  work="$REPO_ROOT/dev/prod/.deploy-work"
  rm -rf "$work"
  mkdir -p "$work"
  tag="$(cd "$REPO_ROOT" && git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
  local_mf="$work/local.sha1"
  remote_mf="$work/remote.sha1"
  upload_list="$work/upload.txt"
  keep="$work/keep.txt"

  node "$REPO_ROOT/scripts/huly-dist-manifest.mjs" "$DIST" > "$local_mf"
  "${SSH[@]}" "$VPS" \
    'cd /opt/huly-front/dist 2>/dev/null && find . -type f -exec sha1sum {} + | LC_ALL=C sort -k2 || true' \
    > "$remote_mf"

  # Compare hash+path pairs so a changed file is caught even when its name is
  # not content-addressed (index.html, public assets).
  LC_ALL=C sort "$local_mf" -o "$local_mf"
  LC_ALL=C sort "$remote_mf" -o "$remote_mf"
  comm -23 "$local_mf" "$remote_mf" | sed 's/^[0-9a-f]*  //' | LC_ALL=C sort -u > "$upload_list"
  sed 's/^[0-9a-f]*  //' "$local_mf" | LC_ALL=C sort > "$keep"

  local count
  count=$(wc -l < "$upload_list" | tr -d ' ')
  info "dist files: $(wc -l < "$keep" | tr -d ' ') | on VPS: $(wc -l < "$remote_mf" | tr -d ' ') | uploading: $count"

  if [ "$count" -gt 0 ]; then
    tar -czf "$work/delta.tgz" -C "$DIST" -T "$upload_list"
    info "delta size: $(du -h "$work/delta.tgz" | cut -f1)"
    "${SCP[@]}" "$work/delta.tgz" "$VPS:/tmp/huly-front-delta.tgz"
  else
    info "dist already identical on the VPS — rebuilding image only"
    "${SSH[@]}" "$VPS" 'rm -f /tmp/huly-front-delta.tgz'
  fi

  "${SCP[@]}" "$keep" "$VPS:/tmp/huly-front-keep.txt"
  # Strip CR so the remote script runs regardless of local line-ending settings.
  tr -d '\r' < "$REPO_ROOT/scripts/huly-deploy-front.sh" > "$work/deploy-front.sh"
  "${SCP[@]}" "$work/deploy-front.sh" "$VPS:/tmp/huly-deploy-front.sh"

  say "apply on VPS"
  "${SSH[@]}" "$VPS" \
    "HULY_TAG='$tag' GIT_SHA_IN='$(cd "$REPO_ROOT" && git rev-parse --short HEAD)' FINGERPRINT_IN='$(front_fingerprint)' DIST_HASH_IN='$(dist_manifest_hash)' bash /tmp/huly-deploy-front.sh"

  rm -rf "$work"
}

# ---------------------------------------------------------------- account ----
# The account service is a compiled bundle inside hardcoreeng/account, so unlike
# models/** there is no database-side trick that can add a method to it. Our API
# token endpoints only reach production as an image we built.
ACCOUNT_STATE=/opt/huly-account/state.env

account_fingerprint() {
  cd "$REPO_ROOT"
  {
    git rev-parse HEAD
    git diff HEAD -- "${ACCOUNT_PATHS[@]}"
    git ls-files --others --exclude-standard -- "${ACCOUNT_PATHS[@]}" |
      while IFS= read -r f; do [ -f "$f" ] && git hash-object "$f"; done
  } 2>/dev/null | node -e '
    const h = require("crypto").createHash("sha256")
    process.stdin.on("data", (d) => h.update(d))
    process.stdin.on("end", () => console.log(h.digest("hex").slice(0, 16)))
  '
}

account_state_value() {
  "${SSH[@]}" "$VPS" "sed -n 's/^$1=//p' $ACCOUNT_STATE 2>/dev/null | head -1" || true
}

cmd_account() {
  say "build account bundle"
  # The image itself is built on the VPS, on top of the stock image that already
  # sits there, so there is nothing to gain from producing one here.
  bash "$REPO_ROOT/scripts/huly-build-account.sh" --bundle-only >/dev/null
  local bundle tag
  bundle="$REPO_ROOT/pods/account/bundle/bundle.js"
  [ -s "$bundle" ] || die "account bundle missing at $bundle"
  info "bundle: $(du -h "$bundle" | cut -f1)"

  tag="$(cd "$REPO_ROOT" && git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"

  say "ship account"
  "${SCP[@]}" "$bundle" "$VPS:/tmp/huly-account-bundle.js"
  tr -d '\r' < "$REPO_ROOT/scripts/huly-deploy-account.sh" > "$REPO_ROOT/pods/account/.deploy-account.sh"
  "${SCP[@]}" "$REPO_ROOT/pods/account/.deploy-account.sh" "$VPS:/tmp/huly-deploy-account.sh"
  rm -f "$REPO_ROOT/pods/account/.deploy-account.sh"

  say "apply account on VPS"
  "${SSH[@]}" "$VPS" \
    "HULY_TAG='$tag' FINGERPRINT_IN='$(account_fingerprint)' bash /tmp/huly-deploy-account.sh"
}

account_needs_deploy() {
  [ "${FORCE:-0}" = "1" ] && return 0
  [ "$(account_fingerprint)" != "$(account_state_value ACCOUNT_FINGERPRINT)" ]
}

cmd_account_rollback() {
  say "rollback account"
  tr -d '\r' < "$REPO_ROOT/scripts/huly-deploy-account.sh" > /tmp/huly-account-rollback.sh
  "${SCP[@]}" /tmp/huly-account-rollback.sh "$VPS:/tmp/huly-deploy-account.sh"
  "${SSH[@]}" "$VPS" 'MODE=rollback bash /tmp/huly-deploy-account.sh'
  rm -f /tmp/huly-account-rollback.sh
}

# --------------------------------------------------------------- calendar ----
CALENDAR_STATE=/opt/huly-calendar/state.env

calendar_fingerprint() {
  cd "$REPO_ROOT"
  {
    git rev-parse HEAD
    git diff HEAD -- "${CALENDAR_PATHS[@]}"
    git ls-files --others --exclude-standard -- "${CALENDAR_PATHS[@]}" |
      while IFS= read -r f; do [ -f "$f" ] && git hash-object "$f"; done
  } 2>/dev/null | node -e '
    const h = require("crypto").createHash("sha256")
    process.stdin.on("data", (d) => h.update(d))
    process.stdin.on("end", () => console.log(h.digest("hex").slice(0, 16)))
  '
}

calendar_state_value() {
  "${SSH[@]}" "$VPS" "sed -n 's/^$1=//p' $CALENDAR_STATE 2>/dev/null | head -1" || true
}

cmd_calendar() {
  say "build calendar bundle"
  bash "$REPO_ROOT/scripts/huly-build-calendar.sh" --bundle-only
  local bundle tag
  bundle="$REPO_ROOT/services/calendar/pod-calendar/bundle/bundle.js"
  [ -s "$bundle" ] || die "calendar bundle missing at $bundle"
  info "bundle: $(du -h "$bundle" | cut -f1)"

  tag="$(cd "$REPO_ROOT" && git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"

  say "ship calendar"
  "${SCP[@]}" "$bundle" "$VPS:/tmp/huly-calendar-bundle.js"
  tr -d '\r' < "$REPO_ROOT/scripts/huly-deploy-calendar.sh" > "$REPO_ROOT/services/calendar/pod-calendar/.deploy-calendar.sh"
  "${SCP[@]}" "$REPO_ROOT/services/calendar/pod-calendar/.deploy-calendar.sh" "$VPS:/tmp/huly-deploy-calendar.sh"
  rm -f "$REPO_ROOT/services/calendar/pod-calendar/.deploy-calendar.sh"

  say "apply calendar on VPS"
  "${SSH[@]}" "$VPS" \
    "HULY_TAG='$tag' FINGERPRINT_IN='$(calendar_fingerprint)' bash /tmp/huly-deploy-calendar.sh"
}

calendar_needs_deploy() {
  [ "${FORCE:-0}" = "1" ] && return 0
  [ "$(calendar_fingerprint)" != "$(calendar_state_value CALENDAR_FINGERPRINT)" ]
}

cmd_calendar_rollback() {
  say "rollback calendar"
  tr -d '\r' < "$REPO_ROOT/scripts/huly-deploy-calendar.sh" > /tmp/huly-calendar-rollback.sh
  "${SCP[@]}" /tmp/huly-calendar-rollback.sh "$VPS:/tmp/huly-deploy-calendar.sh"
  "${SSH[@]}" "$VPS" 'MODE=rollback bash /tmp/huly-deploy-calendar.sh'
  rm -f /tmp/huly-calendar-rollback.sh
}

# ------------------------------------------------------------------ model ----
# The transactor serves the model compiled into its image and layers model_tx on
# top, so models/** edits only reach production once the difference between our
# model and the image's model is written into model_tx.
PROD_TRANSACTOR="${HULY_TRANSACTOR:-huly_v7-transactor-1}"
PROD_WORKSPACE="${HULY_WORKSPACE:-huly_v7-workspace-1}"
PROD_COCKROACH="${HULY_COCKROACH:-huly_v7-cockroach-1}"
MODEL_CACHE="$REPO_ROOT/scripts/.model-cache"
REMOTE_PATCH=/opt/huly-front/model-patch.sql

build_model_bundle() {
  info "compiling model packages"
  if command -v rush >/dev/null 2>&1; then
    ( cd "$REPO_ROOT" && rush build --to @hcengineering/model-all )
  else
    ( cd "$REPO_ROOT" && node common/scripts/install-run-rush.js build --to @hcengineering/model-all )
  fi
  info "bundling model.json"
  if command -v rushx >/dev/null 2>&1; then
    ( cd "$REPO_ROOT/models/all" && rushx bundle )
  else
    ( cd "$REPO_ROOT/models/all" && node "$REPO_ROOT/common/scripts/install-run-rushx.js" bundle )
  fi
}

cmd_model() {
  say "sync model"
  mkdir -p "$MODEL_CACHE"

  local image base fork patch local_hash remote_hash
  image=$("${SSH[@]}" "$VPS" "docker inspect --format '{{.Image}}' $PROD_TRANSACTOR" |
    tr -cd 'A-Za-z0-9' | cut -c1-16)
  [ -n "$image" ] || die "cannot inspect $PROD_TRANSACTOR on the VPS"

  # Keyed by image id, so upgrading the transactor re-fetches its model.
  base="$MODEL_CACHE/model-base-$image.json"
  if [ ! -s "$base" ]; then
    info "fetching base model from $PROD_TRANSACTOR"
    "${SSH[@]}" "$VPS" "docker exec $PROD_TRANSACTOR cat /usr/src/app/model.json" > "$base"
    [ -s "$base" ] || die "base model came back empty"
  fi

  info "building model bundle"
  build_model_bundle
  fork="$REPO_ROOT/models/all/bundle/model.json"
  [ -s "$fork" ] || die "model bundle missing at $fork"

  patch="$MODEL_CACHE/patch-production.sql"
  node "$REPO_ROOT/scripts/huly-model-patch.mjs" --base "$base" --fork "$fork" --out "$patch"

  # The generator is deterministic, so an identical patch means production already
  # has it and the transactor does not need recycling.
  local_hash=$(sha1sum < "$patch" | cut -d' ' -f1)
  remote_hash=$("${SSH[@]}" "$VPS" "sha1sum < $REMOTE_PATCH 2>/dev/null | cut -d' ' -f1 || true")
  if [ "${FORCE:-0}" != "1" ] && [ -n "$remote_hash" ] && [ "$local_hash" = "$remote_hash" ]; then
    info "model already in sync"
    return 0
  fi

  "${SCP[@]}" "$patch" "$VPS:/tmp/huly-model-patch.sql"
  "${SSH[@]}" "$VPS" \
    "TRANSACTOR='$PROD_TRANSACTOR' WORKSPACE='$PROD_WORKSPACE' COCKROACH='$PROD_COCKROACH' REMOTE_PATCH='$REMOTE_PATCH' bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/huly-selfhost
source huly_v7.conf
URL_LOCAL=$(echo "$CR_DB_URL" | sed 's/@cockroach:/@127.0.0.1:/')"?sslmode=disable"
docker exec -i "$COCKROACH" ./cockroach sql --url "$URL_LOCAL" < /tmp/huly-model-patch.sql
mkdir -p "$(dirname "$REMOTE_PATCH")"
cp /tmp/huly-model-patch.sql "$REMOTE_PATCH"
docker restart "$WORKSPACE" "$TRANSACTOR" >/dev/null
sleep 12
REMOTE
  info "model applied; workspace + transactor restarted"
}

model_needs_sync() {
  [ "${FORCE:-0}" = "1" ] && return 0
  [ -n "$(changed_paths models)" ] && return 0
  # First run against a workspace that has never had a patch applied.
  ! "${SSH[@]}" "$VPS" "test -s $REMOTE_PATCH"
}

# ------------------------------------------------------------------ smoke ----
cmd_smoke() {
  say "smoke test"
  if [ "${SKIP_SMOKE:-0}" = "1" ]; then
    info "SKIP_SMOKE=1 — skipped"
    return 0
  fi
  local creds email password
  creds=$("${SSH[@]}" "$VPS" 'grep -E "^(EMAIL|PASSWORD)=" /root/huly-login.txt 2>/dev/null || true')
  email=$(printf '%s\n' "$creds" | sed -n 's/^EMAIL=//p' | head -1)
  password=$(printf '%s\n' "$creds" | sed -n 's/^PASSWORD=//p' | head -1)
  if [ -z "$email" ] || [ -z "$password" ]; then
    info "no credentials on VPS — running anonymous checks only"
  else
    info "using production account $email"
  fi
  info "target: $FRONT_URL"
  FRONT_URL="$FRONT_URL" HULY_USER="$email" HULY_PASSWORD="$password" \
    node "$REPO_ROOT/scripts/huly-deploy-smoke.mjs"
}

cmd_rollback() {
  say "rollback"
  tr -d '\r' < "$REPO_ROOT/scripts/huly-deploy-front.sh" > /tmp/huly-rollback.sh
  "${SCP[@]}" /tmp/huly-rollback.sh "$VPS:/tmp/huly-deploy-front.sh"
  "${SSH[@]}" "$VPS" 'MODE=rollback bash /tmp/huly-deploy-front.sh'
  rm -f /tmp/huly-rollback.sh
}

cmd_verify() {
  say "verify"
  curl -sSI --max-time 15 "$FRONT_URL/" | head -8
  echo
  info "deployed state:"
  remote_state | sed 's/^/    /'
  "${SSH[@]}" "$VPS" "docker ps --filter name=front --filter name=nginx --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'"
}

cmd_status() {
  say "status"
  local fp state deployed_fp front_changes
  fp=$(front_fingerprint)
  state=$(remote_state)
  deployed_fp=$(printf '%s\n' "$state" | sed -n 's/^FRONT_FINGERPRINT=//p')
  info "local front fingerprint:    $fp"
  info "deployed front fingerprint: ${deployed_fp:-none}"
  front_changes=$(changed_paths "${FRONT_PATHS[@]}" | head -20)
  if [ -n "$front_changes" ]; then
    info "uncommitted/untracked front changes:"
    echo "$front_changes" | sed 's/^/    /'
  fi
  if [ "$fp" = "$deployed_fp" ]; then
    info "=> front is up to date (use FORCE=1 to deploy anyway)"
  else
    info "=> front needs deploying"
  fi

  local afp deployed_afp
  afp=$(account_fingerprint)
  deployed_afp=$(account_state_value ACCOUNT_FINGERPRINT)
  echo
  info "local account fingerprint:    $afp"
  info "deployed account fingerprint: ${deployed_afp:-none (stock image)}"
  if [ "$afp" = "$deployed_afp" ]; then
    info "=> account image is up to date"
  else
    info "=> account image needs deploying (server/account code)"
  fi

  local cfp deployed_cfp
  cfp=$(calendar_fingerprint)
  deployed_cfp=$(calendar_state_value CALENDAR_FINGERPRINT)
  echo
  info "local calendar fingerprint:    $cfp"
  info "deployed calendar fingerprint: ${deployed_cfp:-none (stock image)}"
  if [ "$cfp" = "$deployed_cfp" ]; then
    info "=> calendar image is up to date"
  else
    info "=> calendar image needs deploying (Google Meet / event sync)"
  fi
}

cmd_prune() {
  say "prune VPS docker disk"
  "${SSH[@]}" "$VPS" 'df -h / | tail -1; docker system df; docker image prune -f; docker builder prune -f 2>/dev/null || true; df -h / | tail -1'
}

# ----------------------------------------------------------------- deploy ----
cmd_deploy() {
  preflight
  cmd_validate

  local fp deployed_fp shipped account_shipped calendar_shipped
  fp=$(front_fingerprint)
  deployed_fp=$(state_value FRONT_FINGERPRINT)
  shipped=0
  account_shipped=0
  calendar_shipped=0

  # Before the front, not after: the UI calls account methods, so the service has
  # to understand them by the time the new bundle is live.
  if account_needs_deploy; then
    cmd_account
    account_shipped=1
  else
    say "account unchanged"
    info "server/account matches what is live — skipping account image"
  fi

  if calendar_needs_deploy; then
    cmd_calendar
    calendar_shipped=1
  else
    say "calendar unchanged"
    info "calendar service matches what is live — skipping calendar image"
  fi

  if [ "$fp" = "$deployed_fp" ] && [ "${FORCE:-0}" != "1" ]; then
    say "front unchanged"
    info "source fingerprint $fp is already live — nothing to build"
    info "use FORCE=1 to redeploy the same code"
  else
    cmd_build
    if [ "$(dist_manifest_hash)" = "$(state_value DIST_HASH)" ] && [ "${FORCE:-0}" != "1" ]; then
      say "bundle identical"
      info "source changed but the built bundle is byte-identical to production"
      info "skipping upload and container restart"
    else
      cmd_ship
      shipped=1
    fi
  fi

  # After the front, never before: a model doc that references a component the live
  # bundle does not have yet is exactly what black-screens the workbench.
  if model_needs_sync; then
    cmd_model
  else
    say "model unchanged"
    info "models/** matches what is live — skipping model sync"
  fi

  if ! cmd_smoke; then
    echo
    echo "!!! smoke test FAILED !!!"
    if [ "$shipped" != "1" ] && [ "$account_shipped" != "1" ] && [ "$calendar_shipped" != "1" ]; then
      die "production was already failing before this run — nothing was deployed, so there is nothing to roll back"
    fi
    if [ "${NO_ROLLBACK:-0}" = "1" ]; then
      die "left the new deploy live because NO_ROLLBACK=1"
    fi
    if [ "$account_shipped" = "1" ]; then
      cmd_account_rollback
    fi
    if [ "$calendar_shipped" = "1" ]; then
      cmd_calendar_rollback
    fi
    if [ "$shipped" = "1" ]; then
      cmd_rollback
    fi
    echo
    die "rolled back what this run deployed — production is serving the last good images"
  fi

  say "done"
  info "live: $FRONT_URL (hard-refresh with Ctrl+F5)"
  remote_state | sed 's/^/    /'
}

case "${1:-deploy}" in
  deploy|all) cmd_deploy ;;
  validate) cmd_validate ;;
  front) preflight; cmd_validate; cmd_build; cmd_ship ;;
  account) preflight; cmd_account ;;
  account-rollback) preflight; cmd_account_rollback ;;
  calendar) preflight; cmd_calendar ;;
  calendar-rollback) preflight; cmd_calendar_rollback ;;
  model) preflight; cmd_model ;;
  smoke) preflight; cmd_smoke ;;
  rollback) preflight; cmd_rollback ;;
  verify) preflight; cmd_verify ;;
  status) preflight; cmd_status ;;
  prune) preflight; cmd_prune ;;
  help|-h|--help) usage ;;
  *) echo "Unknown command: $1"; echo; usage; exit 1 ;;
esac
