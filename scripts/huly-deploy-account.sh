#!/usr/bin/env bash
# Runs ON THE VPS. Turns an uploaded account bundle into an image and switches
# the account container onto it.
#
# Why an image at all: the account service is a compiled bundle, so our
# server/account code (the API token endpoints) cannot be layered in from the
# database the way models/** can. Production has to run an image we built.
#
# Why a thin layer on hardcoreeng/account rather than a full build: the base
# image already carries the runtime and the certs; we only replace bundle.js.
# That keeps the added layer at a few MB instead of another 400 MB per deploy,
# which is what filled the disk when the front was deployed via docker commit.
#
# Inputs (uploaded to /tmp by the orchestrator):
#   /tmp/huly-account-bundle.js   the built account service
# Env:
#   HULY_TAG        image tag to build (required unless MODE=rollback)
#   MODE            deploy (default) | rollback
#   KEEP_IMAGES     how many huly-account-custom tags to retain (default 3)
set -euo pipefail

STACK=/opt/huly-selfhost
CONF="$STACK/huly_v7.conf"
OVERRIDE="$STACK/compose.override.yml"
ACCOUNT_DIR=/opt/huly-account
STATE="$ACCOUNT_DIR/state.env"
BUNDLE=/tmp/huly-account-bundle.js
MODE="${MODE:-deploy}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"

say() { echo "==== $* ===="; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$CONF" ] || die "missing $CONF"
# shellcheck disable=SC1090
source "$CONF"
: "${HULY_VERSION:?HULY_VERSION missing in huly_v7.conf}"
: "${DOCKER_NAME:?DOCKER_NAME missing in huly_v7.conf}"

ACCOUNT_CONTAINER="${DOCKER_NAME}-account-1"

mkdir -p "$ACCOUNT_DIR"
touch "$STATE"
# shellcheck disable=SC1090
source "$STATE"

# Point compose at an env-driven image once, so later deploys only rewrite a
# single KEY=value line instead of editing YAML.
ensure_image_pin() {
  if ! grep -q 'image: *\${ACCOUNT_IMAGE' "$OVERRIDE"; then
    say "pinning account image to \${ACCOUNT_IMAGE} in compose.override.yml"
    cp "$OVERRIDE" "$OVERRIDE.bak-$(date +%Y%m%d%H%M%S)"
    if grep -qE '^  account:' "$OVERRIDE"; then
      if sed -n '/^  account:/,/^  [a-z]/p' "$OVERRIDE" | grep -q 'image:'; then
        # Replace the existing image line inside the account block only.
        sed -i '/^  account:/,/^  [a-z]/ s|^\( *\)image: .*|\1image: ${ACCOUNT_IMAGE}|' "$OVERRIDE"
      else
        sed -i '/^  account:/a\    image: ${ACCOUNT_IMAGE}' "$OVERRIDE"
      fi
    else
      printf '  account:\n    image: ${ACCOUNT_IMAGE}\n' >> "$OVERRIDE"
    fi
    grep -q 'image: *\${ACCOUNT_IMAGE' "$OVERRIDE" || die "could not pin ACCOUNT_IMAGE in $OVERRIDE"
  fi
}

set_account_image() {
  local image="$1"
  if grep -q '^ACCOUNT_IMAGE=' "$CONF"; then
    sed -i "s|^ACCOUNT_IMAGE=.*|ACCOUNT_IMAGE=$image|" "$CONF"
  else
    printf '\n# Account image built by scripts/huly-deploy-account.sh\nACCOUNT_IMAGE=%s\n' "$image" >> "$CONF"
  fi
}

apply_image() {
  local image="$1"
  ensure_image_pin
  set_account_image "$image"
  say "docker compose up -d --force-recreate account ($image)"
  # Compose only substitutes ${ACCOUNT_IMAGE} from the process env — sourcing
  # huly_v7.conf into this shell is what actually switches the container.
  # --force-recreate is required when the tag changes but compose would otherwise
  # leave a healthy container on the previous image ("Running" with no recreate).
  (
    set -a
    # shellcheck disable=SC1090
    source "$CONF"
    set +a
    cd "$STACK" && docker compose up -d --force-recreate account
  )
  sleep 10
}

# The account service is what every other service authenticates against, so a
# broken deploy here takes the whole stack down, not just one page.
verify_live() {
  say "verify"
  local status
  status=$(docker inspect --format '{{.State.Status}}' "$ACCOUNT_CONTAINER" 2>/dev/null || echo missing)
  [ "$status" = "running" ] || die "$ACCOUNT_CONTAINER is $status"

  # Prefer a fresh startup line, but fall back to RPC — recreate can be skipped
  # by compose, and --since 60s then misses the original "server started" log.
  if ! docker logs --since 120s "$ACCOUNT_CONTAINER" 2>&1 | grep -q 'server started on port'; then
    echo "no recent 'server started' line — probing RPC instead"
  fi

  # An unauthenticated RPC must still answer with a structured error, which is
  # the difference between "running" and "actually serving". The image is slim:
  # no curl, no wget, so probe with the node that is already in there.
  local body
  body=$(docker exec "$ACCOUNT_CONTAINER" node -e "
    fetch('http://127.0.0.1:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'getLoginInfoByToken', params: {} })
    }).then((r) => r.text()).then((t) => console.log(t.slice(0, 200)))
      .catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
  " 2>&1 || true)
  case "$body" in
    *result*|*error*) echo "account RPC responded" ;;
    *) die "account RPC returned nothing usable: ${body:-<empty>}" ;;
  esac

  # The whole point of the custom image: without this method the API Tokens page
  # is dead, and we would have shipped a 400 MB image for nothing.
  docker exec "$ACCOUNT_CONTAINER" grep -qc 'createApiToken' /usr/src/app/bundle.js ||
    die "deployed bundle has no createApiToken — wrong bundle shipped"
  echo "createApiToken present in the deployed bundle"
}

save_state() {
  cat > "$STATE" <<EOF
CURRENT_IMAGE=$1
PREVIOUS_IMAGE=$2
ACCOUNT_FINGERPRINT=${FINGERPRINT_IN:-${ACCOUNT_FINGERPRINT:-unknown}}
DEPLOYED_AT=$(date -Iseconds)
EOF
}

prune_images() {
  docker images 'huly-account-custom' --format '{{.Tag}}\t{{.CreatedAt}}' |
    sort -k2 -r | tail -n +$((KEEP_IMAGES + 1)) | cut -f1 |
    while IFS= read -r old; do
      if [ -z "$old" ] ||
         [ "huly-account-custom:$old" = "${CURRENT_IMAGE:-}" ] ||
         [ "huly-account-custom:$old" = "${PREVIOUS_IMAGE:-}" ]; then
        continue
      fi
      echo "  removing huly-account-custom:$old"
      docker rmi "huly-account-custom:$old" >/dev/null 2>&1 || true
    done
  docker image prune -f >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------- rollback ----
if [ "$MODE" = "rollback" ]; then
  TARGET="${HULY_TAG:-}"
  [ -n "$TARGET" ] || TARGET="${PREVIOUS_IMAGE:-}"
  # With no previous custom image, the stock image is the safe place to land.
  [ -n "$TARGET" ] || TARGET="hardcoreeng/account:$HULY_VERSION"
  case "$TARGET" in */*|*:*) IMAGE="$TARGET" ;; *) IMAGE="huly-account-custom:$TARGET" ;; esac
  docker image inspect "$IMAGE" >/dev/null 2>&1 || die "rollback image $IMAGE not present"
  say "ROLLBACK to $IMAGE"
  apply_image "$IMAGE"
  # The stock image legitimately has no createApiToken, so only check liveness.
  docker logs --since 60s "$ACCOUNT_CONTAINER" 2>&1 | grep -q 'server started on port' ||
    die "account did not come back up after rollback"
  save_state "$IMAGE" "${CURRENT_IMAGE:-}"
  echo "rollback done -> $IMAGE"
  exit 0
fi

# ------------------------------------------------------------------ deploy ----
[ -n "${HULY_TAG:-}" ] || die "HULY_TAG is required"
[ -s "$BUNDLE" ] || die "missing uploaded bundle at $BUNDLE"
grep -q 'createApiToken' "$BUNDLE" || die "uploaded bundle has no createApiToken — refusing to ship it"

IMAGE="huly-account-custom:$HULY_TAG"

say "build $IMAGE"
cp "$BUNDLE" "$ACCOUNT_DIR/bundle.js"
cat > "$ACCOUNT_DIR/Dockerfile" <<EOF
FROM hardcoreeng/account:$HULY_VERSION
COPY bundle.js /usr/src/app/bundle.js
EOF
docker build -q -t "$IMAGE" -f "$ACCOUNT_DIR/Dockerfile" "$ACCOUNT_DIR" >/dev/null

PREV="${CURRENT_IMAGE:-}"
apply_image "$IMAGE"

if ! verify_live; then
  echo "!!! account verification failed — rolling back !!!" >&2
  MODE=rollback HULY_TAG="${PREV:-hardcoreeng/account:$HULY_VERSION}" bash "$0"
  die "account deploy failed and was rolled back"
fi

save_state "$IMAGE" "$PREV"
prune_images
rm -f "$BUNDLE"

echo
echo "account deploy done"
echo "  image:    $IMAGE"
echo "  previous: ${PREV:-stock}"
