#!/usr/bin/env bash
set -euo pipefail
echo '==== compose.override.yml ===='
cat /opt/huly-selfhost/compose.override.yml
echo
echo '==== front service in compose.yml ===='
grep -n -A 20 '^  front:' /opt/huly-selfhost/compose.yml | head -30
