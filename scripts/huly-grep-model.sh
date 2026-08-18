#!/usr/bin/env bash
set -euo pipefail
docker exec huly_v7-transactor-1 sh -c 'pwd; ls -l model.json bundle.js'
echo '==== ids ===='
docker exec huly_v7-transactor-1 grep -oE 'task:viewlet:(StatusTable|Dashboard|Kanban)|tracker:viewlet:Issue[A-Za-z]+|view:function:HideArchived' model.json | sort | uniq -c
