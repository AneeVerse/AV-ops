#!/usr/bin/env bash
# Build a custom calendar image from this fork's services/calendar code.
#
# Why this exists: the calendar service is a compiled bundle inside
# hardcoreeng/calendar. Google Meet hangoutLink mapping, conference create, and
# the event-id insert fix only exist once we build and run our own image.
#
# Usage:
#   scripts/huly-build-calendar.sh [--tag <tag>] [--no-build] [--bundle-only]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POD="$REPO_ROOT/services/calendar/pod-calendar"
TAG=""
DO_BUILD=1
BUNDLE_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    --no-build) DO_BUILD=0; shift ;;
    --bundle-only) BUNDLE_ONLY=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

say() { echo; echo "=========== $* ==========="; }
info() { echo "  $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

if [ -z "$TAG" ]; then
  TAG="$(cd "$REPO_ROOT" && git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
fi
IMAGE="huly-calendar-custom:$TAG"

run_rush() {
  if command -v rush >/dev/null 2>&1; then
    ( cd "$REPO_ROOT" && rush "$@" )
  else
    ( cd "$REPO_ROOT" && node common/scripts/install-run-rush.js "$@" )
  fi
}

run_rushx() {
  if command -v rushx >/dev/null 2>&1; then
    ( cd "$POD" && rushx "$@" )
  else
    ( cd "$POD" && node "$REPO_ROOT/common/scripts/install-run-rushx.js" "$@" )
  fi
}

if [ "$DO_BUILD" = "1" ]; then
  say "compile calendar packages"
  run_rush build --to @hcengineering/pod-calendar
fi

say "bundle calendar service"
run_rushx bundle
[ -s "$POD/bundle/bundle.js" ] || die "bundle missing at $POD/bundle/bundle.js"

grep -q 'eventLocationFromGoogle' "$POD/bundle/bundle.js" ||
  die "bundle does not contain eventLocationFromGoogle — Meet mapping did not make it into the build"
grep -q 'resolveExternalCalendar' "$POD/bundle/bundle.js" ||
  die "bundle does not contain resolveExternalCalendar — HULY-to-Google remap did not make it into the build"

if [ "$BUNDLE_ONLY" = "1" ]; then
  say "done (bundle only)"
  info "bundle: $POD/bundle/bundle.js"
  exit 0
fi

say "build $IMAGE"
docker build -q -t "$IMAGE" -t huly-calendar-custom:local "$POD" >/dev/null
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "docker build produced no $IMAGE"

say "done"
info "image: $IMAGE (also tagged huly-calendar-custom:local)"
echo "$TAG"
