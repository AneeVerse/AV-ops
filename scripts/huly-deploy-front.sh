#!/usr/bin/env bash
# Runs ON THE VPS. Applies an already-uploaded front dist delta and switches the
# front container to a newly built image.
#
# Why an image instead of `docker cp` + `docker commit`:
#   - the front container has no volume mounts, so any `docker compose up`
#     recreate silently reverted the UI to stock hardcoreeng/front
#   - each `docker commit` wrote a fresh 2.3 GB image and orphaned the previous
#     one, which is what filled the disk
#
# Inputs (uploaded to /tmp by the orchestrator):
#   /tmp/huly-front-delta.tgz   files to add/replace (may be absent)
#   /tmp/huly-front-keep.txt    full list of files dist should contain
# Env:
#   HULY_TAG        image tag to build (required unless MODE=rollback)
#   MODE            deploy (default) | rollback
#   KEEP_IMAGES     how many huly-front-custom tags to retain (default 3)
#   MIN_FREE_GB     prune when free space is below this (default 6)
set -euo pipefail

STACK=/opt/huly-selfhost
CONF="$STACK/huly_v7.conf"
OVERRIDE="$STACK/compose.override.yml"
FRONT_DIR=/opt/huly-front
STAGE="$FRONT_DIR/dist"
STATE="$FRONT_DIR/state.env"
DELTA=/tmp/huly-front-delta.tgz
KEEP_LIST=/tmp/huly-front-keep.txt
MODE="${MODE:-deploy}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"
MIN_FREE_GB="${MIN_FREE_GB:-6}"

say() { echo "==== $* ===="; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$CONF" ] || die "missing $CONF"
# shellcheck disable=SC1090
source "$CONF"
: "${HULY_VERSION:?HULY_VERSION missing in huly_v7.conf}"
: "${DOCKER_NAME:?DOCKER_NAME missing in huly_v7.conf}"

FRONT_CONTAINER="${DOCKER_NAME}-front-1"
NGINX_CONTAINER="${DOCKER_NAME}-nginx-1"

mkdir -p "$STAGE"
touch "$STATE"
# shellcheck disable=SC1090
source "$STATE"

free_gb() { df -BG --output=avail / | tail -1 | tr -dc '0-9'; }

prune_images() {
  say "prune docker images (free ${1:-?}G)"
  # Keep the newest N custom front tags, drop the rest, then reclaim dangling layers.
  docker images 'huly-front-custom' --format '{{.Tag}}\t{{.CreatedAt}}' |
    sort -k2 -r | tail -n +$((KEEP_IMAGES + 1)) | cut -f1 |
    while IFS= read -r old; do
      if [ -z "$old" ] ||
         [ "huly-front-custom:$old" = "${CURRENT_IMAGE:-}" ] ||
         [ "huly-front-custom:$old" = "${PREVIOUS_IMAGE:-}" ]; then
        continue
      fi
      echo "  removing huly-front-custom:$old"
      docker rmi "huly-front-custom:$old" >/dev/null 2>&1 || true
    done
  docker image prune -f >/dev/null 2>&1 || true
  echo "free after prune: $(free_gb)G"
}

# Point compose at an env-driven image once, so later deploys only rewrite a
# single KEY=value line instead of editing YAML.
ensure_image_pin() {
  if ! grep -q 'image: *\${FRONT_IMAGE' "$OVERRIDE"; then
    say "pinning front image to \${FRONT_IMAGE} in compose.override.yml"
    cp "$OVERRIDE" "$OVERRIDE.bak-$(date +%Y%m%d%H%M%S)"
    if grep -q 'image: *huly-front-custom' "$OVERRIDE"; then
      sed -i 's|image: *huly-front-custom.*|image: ${FRONT_IMAGE}|' "$OVERRIDE"
    else
      # No image line yet: add one to the front service block.
      sed -i '/^  front:/a\    image: ${FRONT_IMAGE}' "$OVERRIDE"
    fi
    grep -q 'image: *\${FRONT_IMAGE' "$OVERRIDE" || die "could not pin FRONT_IMAGE in $OVERRIDE"
  fi
}

set_front_image() {
  local image="$1"
  if grep -q '^FRONT_IMAGE=' "$CONF"; then
    sed -i "s|^FRONT_IMAGE=.*|FRONT_IMAGE=$image|" "$CONF"
  else
    printf '\n# Front image built by scripts/huly-deploy-front.sh\nFRONT_IMAGE=%s\n' "$image" >> "$CONF"
  fi
}

apply_image() {
  local image="$1"
  ensure_image_pin
  set_front_image "$image"
  say "docker compose up -d --force-recreate front ($image)"
  # Compose only substitutes ${FRONT_IMAGE} from the process env — sourcing
  # huly_v7.conf is required. Without --force-recreate, a healthy container can
  # stay on the previous image ("Running") while state.env claims the new tag.
  (
    set -a
    # shellcheck disable=SC1090
    source "$CONF"
    set +a
    cd "$STACK" && docker compose up -d --force-recreate front
  )
  say "restart nginx"
  # Required: nginx caches the front upstream IP and 502s after a recreate.
  docker restart "$NGINX_CONTAINER" >/dev/null
  sleep 6
}

verify_live() {
  say "verify"
  docker exec "$FRONT_CONTAINER" sh -c 'ls -1 /app/dist/index.html >/dev/null' ||
    die "/app/dist/index.html missing inside $FRONT_CONTAINER"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:8087/ || echo 000)
  echo "nginx local: $code"
  [ "$code" = "200" ] || die "nginx returned $code from the front container"
  docker exec "$FRONT_CONTAINER" cat /app/dist/index.html | head -c 300
  echo
}

save_state() {
  cat > "$STATE" <<EOF
CURRENT_IMAGE=$1
PREVIOUS_IMAGE=$2
GIT_SHA=${GIT_SHA_IN:-${GIT_SHA:-unknown}}
FRONT_FINGERPRINT=${FINGERPRINT_IN:-${FRONT_FINGERPRINT:-unknown}}
DIST_HASH=${DIST_HASH_IN:-${DIST_HASH:-unknown}}
DEPLOYED_AT=$(date -Iseconds)
EOF
}

# ---------------------------------------------------------------- rollback ----
if [ "$MODE" = "rollback" ]; then
  TARGET="${HULY_TAG:-}"
  [ -n "$TARGET" ] || TARGET="${PREVIOUS_IMAGE:-}"
  [ -n "$TARGET" ] || die "no rollback target (PREVIOUS_IMAGE unset and HULY_TAG not given)"
  case "$TARGET" in */*|*:*) IMAGE="$TARGET" ;; *) IMAGE="huly-front-custom:$TARGET" ;; esac
  docker image inspect "$IMAGE" >/dev/null 2>&1 || die "rollback image $IMAGE not present"
  say "ROLLBACK to $IMAGE"
  apply_image "$IMAGE"
  verify_live
  save_state "$IMAGE" "${CURRENT_IMAGE:-}"
  echo "rollback done -> $IMAGE"
  exit 0
fi

# ------------------------------------------------------------------ deploy ----
[ -n "${HULY_TAG:-}" ] || die "HULY_TAG is required"
IMAGE="huly-front-custom:$HULY_TAG"

FREE=$(free_gb)
echo "free space: ${FREE}G"
if [ "$FREE" -lt "$MIN_FREE_GB" ]; then
  prune_images "$FREE"
  FREE=$(free_gb)
fi
if [ "$FREE" -lt 3 ]; then
  die "only ${FREE}G free on / — cannot safely build the front image"
fi

if [ -f "$DELTA" ]; then
  say "extract delta into $STAGE"
  tar -xzf "$DELTA" -C "$STAGE"
else
  echo "no delta tarball — dist unchanged"
fi

# Remove files that are no longer part of the build. config.json is generated by
# the front entrypoint at runtime; branding.json is deployment-specific.
if [ -f "$KEEP_LIST" ]; then
  say "remove stale files"
  ( cd "$STAGE" && find . -type f | sort ) > /tmp/huly-front-current.txt
  sed -e 's|\r$||' "$KEEP_LIST" | sort > /tmp/huly-front-keep-sorted.txt
  removed=0
  while IFS= read -r f; do
    case "$f" in ./config.json|./branding.json) continue ;; esac
    rm -f "$STAGE/$f"
    removed=$((removed + 1))
  done < <(comm -23 /tmp/huly-front-current.txt /tmp/huly-front-keep-sorted.txt)
  echo "removed $removed stale file(s)"
fi

# Keep deployment-specific branding that is not produced by webpack.
if [ ! -f "$STAGE/branding.json" ] && docker exec "$FRONT_CONTAINER" test -f /app/dist/branding.json 2>/dev/null; then
  docker cp "$FRONT_CONTAINER:/app/dist/branding.json" "$STAGE/branding.json"
  echo "kept branding.json from running container"
fi

say "integrity check"
[ -f "$STAGE/index.html" ] || die "index.html missing in $STAGE"
missing=0
for src in $(grep -oE 'src="/[^"]+\.js"' "$STAGE/index.html" | sed -e 's|src="/||' -e 's|"$||'); do
  if [ ! -f "$STAGE/$src" ]; then
    echo "  MISSING: $src"
    missing=$((missing + 1))
  fi
done
[ "$missing" -eq 0 ] || die "$missing script(s) referenced by index.html are absent — refusing to deploy a broken bundle"
echo "index.html scripts all present ($(find "$STAGE" -type f | wc -l) files, $(du -sh "$STAGE" | cut -f1))"

say "build $IMAGE"
cat > "$FRONT_DIR/Dockerfile" <<EOF
FROM hardcoreeng/front:$HULY_VERSION
RUN rm -rf /app/dist
COPY dist /app/dist
EOF
docker build -q -t "$IMAGE" -f "$FRONT_DIR/Dockerfile" "$FRONT_DIR" >/dev/null

PREV="${CURRENT_IMAGE:-}"
apply_image "$IMAGE"
verify_live
save_state "$IMAGE" "$PREV"

prune_images "$(free_gb)"
rm -f "$DELTA" "$KEEP_LIST" /tmp/huly-front-current.txt /tmp/huly-front-keep-sorted.txt
rm -rf /tmp/huly-front-extract /tmp/huly-front-dist.tgz

echo
echo "deploy done"
echo "  image:    $IMAGE"
echo "  previous: ${PREV:-none}"
echo "  free:     $(free_gb)G"
