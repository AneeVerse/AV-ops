#!/usr/bin/env bash
# Build a custom account image from this fork's server/account code.
#
# Why this exists: the account service is a compiled bundle inside
# hardcoreeng/account, so unlike models/** there is no database-side trick that
# can add a method to it. Anything we add under server/account (the API tokens
# endpoints, for one) only exists once we build and run our own image.
#
# Usage:
#   scripts/huly-build-account.sh [--tag <tag>] [--no-build] [--bundle-only]
#
# Options:
#   --tag <tag>    image tag to produce (default: <short sha>-<timestamp>)
#   --no-build     skip `rush build`, bundle from the current lib/ output
#   --bundle-only  stop after bundle.js; the production deploy builds its image
#                  on the VPS and has no use for a local one
#
# Always also tags huly-account-custom:local, which is what the local stack picks up.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POD="$REPO_ROOT/pods/account"
TAG=""
DO_BUILD=1
BUNDLE_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    --no-build) DO_BUILD=0; shift ;;
    --bundle-only) BUNDLE_ONLY=1; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

say() { echo; echo "=========== $* ==========="; }
info() { echo "  $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

if [ -z "$TAG" ]; then
  TAG="$(cd "$REPO_ROOT" && git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
fi
IMAGE="huly-account-custom:$TAG"

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
  say "compile account packages"
  run_rush build --to @hcengineering/pod-account
fi

say "bundle account service"
run_rushx bundle
[ -s "$POD/bundle/bundle.js" ] || die "bundle missing at $POD/bundle/bundle.js"

# Cheap guard against shipping a bundle built from a stale lib/: the API token
# endpoints are the reason this image exists, so their absence means the build
# did not pick up server/account.
grep -q 'createApiToken' "$POD/bundle/bundle.js" ||
  die "bundle does not contain createApiToken — server/account did not make it into the build"
grep -q 'provisionWorkspaceUser' "$POD/bundle/bundle.js" ||
  die "bundle does not contain provisionWorkspaceUser — server/account did not make it into the build"
grep -q 'setWorkspaceUserPassword' "$POD/bundle/bundle.js" ||
  die "bundle does not contain setWorkspaceUserPassword — server/account did not make it into the build"
grep -q 'sendWorkspaceUserPasswordReset' "$POD/bundle/bundle.js" ||
  die "bundle does not contain sendWorkspaceUserPasswordReset — server/account did not make it into the build"

if [ "$BUNDLE_ONLY" = "1" ]; then
  say "done (bundle only)"
  info "bundle: $POD/bundle/bundle.js"
  exit 0
fi

say "build $IMAGE"
docker build -q -t "$IMAGE" -t huly-account-custom:local "$POD" >/dev/null
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "docker build produced no $IMAGE"

say "done"
info "image: $IMAGE (also tagged huly-account-custom:local)"
info "local stack: restart it (local.cmd) to pick this up"
echo "$TAG"
