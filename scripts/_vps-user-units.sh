#!/bin/bash
set -u
export XDG_RUNTIME_DIR=/run/user/0
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/0/bus

echo "=== user units ==="
systemctl --user list-units --type=service --all --no-pager | head -80
echo "=== user unit files ==="
ls -la /root/.config/systemd/user/ 2>/dev/null || echo no_user_dir
systemctl --user list-unit-files --no-pager | head -80
echo DONE
