#!/usr/bin/env bash
set -euo pipefail
echo '==== public index ===='
curl -sS -k https://huly.aneeverse.com/ | head -c 500
echo
echo
echo '==== config.json ===='
curl -sS -k -o /tmp/huly-cfg.json -w 'config:%{http_code}\n' https://huly.aneeverse.com/config.json
head -c 800 /tmp/huly-cfg.json; echo
echo
echo '==== wizard chunk ===='
curl -sS -k -o /dev/null -w 'lead-chunk:%{http_code} size:%{size_download}\n' https://huly.aneeverse.com/43004.284e18a062493f5bcdfc.js
if docker exec huly_v7-front-1 grep -q 'closeAfterCreate' /app/dist/43004.284e18a062493f5bcdfc.js; then
  echo 'wizard code present in container'
else
  echo 'WARNING: wizard code missing'
fi
echo
echo '==== commit custom image ===='
docker commit huly_v7-front-1 huly-front-custom:lead-wizard
echo 'committed huly-front-custom:lead-wizard'
ls /opt/huly-selfhost
