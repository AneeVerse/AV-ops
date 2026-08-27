#!/usr/bin/env bash
# Runs ON THE VPS. Turns an uploaded calendar bundle into an image and switches
# the calendar container onto it.
#
# Inputs (uploaded to /tmp by the orchestrator):
#   /tmp/huly-calendar-bundle.js   the built calendar service
# Env:
#   HULY_TAG        image tag to build (required unless MODE=rollback)
#   MODE            deploy (default) | rollback
#   KEEP_IMAGES     how many huly-calendar-custom tags to retain (default 3)
set -euo pipefail

STACK=/opt/huly-selfhost
CONF="$STACK/huly_v7.conf"
OVERRIDE="$STACK/compose.override.yml"
CALENDAR_DIR=/opt/huly-calendar
STATE="$CALENDAR_DIR/state.env"
BUNDLE=/tmp/huly-calendar-bundle.js
MODE="${MODE:-deploy}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"

say() { echo "==== $* ===="; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$CONF" ] || die "missing $CONF"
# shellcheck disable=SC1090
source "$CONF"
: "${HULY_VERSION:?HULY_VERSION missing in huly_v7.conf}"
: "${DOCKER_NAME:?DOCKER_NAME missing in huly_v7.conf}"

CALENDAR_CONTAINER="${DOCKER_NAME}-calendar-1"

mkdir -p "$CALENDAR_DIR"
touch "$STATE"
# shellcheck disable=SC1090
source "$STATE"

ensure_image_pin() {
  if ! grep -q 'image: *\${CALENDAR_IMAGE' "$OVERRIDE"; then
    say "pinning calendar image to \${CALENDAR_IMAGE} in compose.override.yml"
    cp "$OVERRIDE" "$OVERRIDE.bak-$(date +%Y%m%d%H%M%S)"
    if grep -qE '^  calendar:' "$OVERRIDE"; then
      if sed -n '/^  calendar:/,/^  [a-z]/p' "$OVERRIDE" | grep -q 'image:'; then
        sed -i '/^  calendar:/,/^  [a-z]/ s|^\( *\)image: .*|\1image: ${CALENDAR_IMAGE}|' "$OVERRIDE"
      else
        sed -i '/^  calendar:/a\    image: ${CALENDAR_IMAGE}' "$OVERRIDE"
      fi
    else
      printf '  calendar:\n    image: ${CALENDAR_IMAGE}\n' >> "$OVERRIDE"
    fi
    grep -q 'image: *\${CALENDAR_IMAGE' "$OVERRIDE" || die "could not pin CALENDAR_IMAGE in $OVERRIDE"
  fi
}

set_calendar_image() {
  local image="$1"
  if grep -q '^CALENDAR_IMAGE=' "$CONF"; then
    sed -i "s|^CALENDAR_IMAGE=.*|CALENDAR_IMAGE=$image|" "$CONF"
  else
    printf '\n# Calendar image built by scripts/huly-deploy-calendar.sh\nCALENDAR_IMAGE=%s\n' "$image" >> "$CONF"
  fi
}

apply_image() {
  local image="$1"
  ensure_image_pin
  set_calendar_image "$image"
  say "docker compose up -d --force-recreate calendar ($image)"
  (
    set -a
    # shellcheck disable=SC1090
    source "$CONF"
    set +a
    cd "$STACK" && docker compose up -d --force-recreate calendar
  )
  sleep 8
}

verify_live() {
  say "verify"
  local status
  status=$(docker inspect --format '{{.State.Status}}' "$CALENDAR_CONTAINER" 2>/dev/null || echo missing)
  [ "$status" = "running" ] || die "$CALENDAR_CONTAINER is $status"

  if ! docker logs --since 120s "$CALENDAR_CONTAINER" 2>&1 | grep -q 'Calendar service has been started'; then
    echo "no recent 'Calendar service has been started' line — probing HTTP instead"
  fi

  local code
  code=$(docker exec "$CALENDAR_CONTAINER" node -e "
    fetch('http://127.0.0.1:8095/signin').then((r) => { console.log(r.status); process.exit(0) })
      .catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
  " 2>/dev/null || true)
  case "$code" in
    401|400|200) echo "calendar HTTP responded $code" ;;
    *) die "calendar HTTP returned nothing usable: ${code:-<empty>}" ;;
  esac

  docker exec "$CALENDAR_CONTAINER" grep -qc 'eventLocationFromGoogle' /usr/src/app/bundle.js ||
    die "deployed bundle has no eventLocationFromGoogle — wrong bundle shipped"
  echo "eventLocationFromGoogle present in the deployed bundle"
}

save_state() {
  cat > "$STATE" <<EOF
CURRENT_IMAGE=$1
PREVIOUS_IMAGE=$2
CALENDAR_FINGERPRINT=${FINGERPRINT_IN:-${CALENDAR_FINGERPRINT:-unknown}}
DEPLOYED_AT=$(date -Iseconds)
EOF
}

prune_images() {
  docker images 'huly-calendar-custom' --format '{{.Tag}}\t{{.CreatedAt}}' |
    sort -k2 -r | tail -n +$((KEEP_IMAGES + 1)) | cut -f1 |
    while IFS= read -r old; do
      if [ -z "$old" ] ||
         [ "huly-calendar-custom:$old" = "${CURRENT_IMAGE:-}" ] ||
         [ "huly-calendar-custom:$old" = "${PREVIOUS_IMAGE:-}" ]; then
        continue
      fi
      echo "  removing huly-calendar-custom:$old"
      docker rmi "huly-calendar-custom:$old" >/dev/null 2>&1 || true
    done
  docker image prune -f >/dev/null 2>&1 || true
}

if [ "$MODE" = "rollback" ]; then
  TARGET="${HULY_TAG:-}"
  [ -n "$TARGET" ] || TARGET="${PREVIOUS_IMAGE:-}"
  [ -n "$TARGET" ] || TARGET="hardcoreeng/calendar:$HULY_VERSION"
  case "$TARGET" in */*|*:*) IMAGE="$TARGET" ;; *) IMAGE="huly-calendar-custom:$TARGET" ;; esac
  docker image inspect "$IMAGE" >/dev/null 2>&1 || die "rollback image $IMAGE not present"
  say "ROLLBACK to $IMAGE"
  apply_image "$IMAGE"
  docker logs --since 60s "$CALENDAR_CONTAINER" 2>&1 | grep -q 'Calendar service has been started' ||
    die "calendar did not come back up after rollback"
  save_state "$IMAGE" "${CURRENT_IMAGE:-}"
  echo "rollback done -> $IMAGE"
  exit 0
fi

[ -n "${HULY_TAG:-}" ] || die "HULY_TAG is required"
[ -s "$BUNDLE" ] || die "missing uploaded bundle at $BUNDLE"
grep -q 'eventLocationFromGoogle' "$BUNDLE" || die "uploaded bundle has no eventLocationFromGoogle — refusing to ship it"

IMAGE="huly-calendar-custom:$HULY_TAG"

say "build $IMAGE"
cp "$BUNDLE" "$CALENDAR_DIR/bundle.js"
cat > "$CALENDAR_DIR/Dockerfile" <<EOF
FROM hardcoreeng/calendar:$HULY_VERSION
COPY bundle.js /usr/src/app/bundle.js
EOF
docker build -q -t "$IMAGE" -f "$CALENDAR_DIR/Dockerfile" "$CALENDAR_DIR" >/dev/null

PREV="${CURRENT_IMAGE:-}"
apply_image "$IMAGE"

if ! verify_live; then
  echo "!!! calendar verification failed — rolling back !!!" >&2
  MODE=rollback HULY_TAG="${PREV:-hardcoreeng/calendar:$HULY_VERSION}" bash "$0"
  die "calendar deploy failed and was rolled back"
fi

save_state "$IMAGE" "$PREV"
prune_images
rm -f "$BUNDLE"

echo
echo "calendar deploy done"
echo "  image:    $IMAGE"
echo "  previous: ${PREV:-stock}"
