#!/bin/bash
set -euo pipefail
install -m 644 /tmp/avops-sync/server.mjs /opt/av_ops/docker/avops-mcp/server.mjs
install -m 644 /tmp/avops-sync/sync.mjs /opt/av_ops/docker/avops-chat/sync.mjs
install -m 644 /tmp/avops-sync/oauth-upgrade.mjs /opt/av_ops/docker/avops-chat/oauth-upgrade.mjs
if [ ! -f /opt/av_ops/docker/avops-chat/operate.json ]; then
  printf '%s\n' '["spaces/AAQAOk6L6k8"]' > /opt/av_ops/docker/avops-chat/operate.json
fi
systemctl restart avops-mcp.service
systemctl is-active avops-mcp.service
NODE_PATH=/opt/av_ops/docker/avops-mcp/node_modules node /tmp/avops-sync/people-probe.mjs
