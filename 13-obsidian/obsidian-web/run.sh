#!/usr/bin/env bash
set -euo pipefail

export HOME=/root
export USER=root
export LOGNAME=root
export DISPLAY=:1
export XAUTHORITY=/root/.Xauthority
export OBSIDIAN_USER=obsidian
export OBSIDIAN_HOME=/home/obsidian
export OBSIDIAN_RUNTIME=/run/obsidian-runtime
mkdir -p "$OBSIDIAN_RUNTIME"
chown "$OBSIDIAN_USER:$OBSIDIAN_USER" "$OBSIDIAN_RUNTIME"
chmod 700 "$OBSIDIAN_RUNTIME"

SCREEN_GEOMETRY="1600x1000x24"
VNC_PORT=5901
NOVNC_PORT=6080
XVFB_PID_FILE=/run/obsidian-xvfb.pid
FLUXBOX_PID_FILE=/run/obsidian-fluxbox.pid
OBSIDIAN_PID_FILE=/run/obsidian-app.pid
X11VNC_PID_FILE=/run/obsidian-x11vnc.pid
WEBSOCKIFY_PID_FILE=/run/obsidian-websockify.pid

log() {
  printf '[obsidian-web] %s\n' "$*"
}

cleanup() {
  log 'stopping child processes'
  for pidfile in "$WEBSOCKIFY_PID_FILE" "$X11VNC_PID_FILE" "$OBSIDIAN_PID_FILE" "$FLUXBOX_PID_FILE" "$XVFB_PID_FILE"; do
    if [[ -f "$pidfile" ]]; then
      pid=$(cat "$pidfile" || true)
      if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$pidfile"
    fi
  done
}
trap cleanup EXIT INT TERM

if ! pgrep -af "Xvfb :1" >/dev/null; then
  log "starting Xvfb on $DISPLAY"
  Xvfb "$DISPLAY" -screen 0 "$SCREEN_GEOMETRY" -ac +extension RANDR +extension GLX >/var/log/obsidian-xvfb.log 2>&1 &
  echo $! > "$XVFB_PID_FILE"
fi

sleep 2

if ! pgrep -af "fluxbox" >/dev/null; then
  log "starting fluxbox on $DISPLAY"
  fluxbox >/var/log/obsidian-fluxbox.log 2>&1 &
  echo $! > "$FLUXBOX_PID_FILE"
fi

sleep 2

if ! pgrep -af "/opt/obsidian-web/bin/Obsidian.AppImage" >/dev/null; then
  log "starting Obsidian"
  sudo -u "$OBSIDIAN_USER" env HOME="$OBSIDIAN_HOME" USER="$OBSIDIAN_USER" LOGNAME="$OBSIDIAN_USER" DISPLAY="$DISPLAY" XDG_RUNTIME_DIR="$OBSIDIAN_RUNTIME" dbus-run-session -- /opt/obsidian-web/bin/Obsidian.AppImage --no-sandbox --disable-gpu >/var/log/obsidian-app.log 2>&1 &
  echo $! > "$OBSIDIAN_PID_FILE"
fi

if ! pgrep -af "x11vnc.*${VNC_PORT}" >/dev/null; then
  log "starting x11vnc on localhost:${VNC_PORT}"
  x11vnc -display "$DISPLAY" -rfbport "$VNC_PORT" -localhost -forever -shared -nopw -noxdamage -xkb >/var/log/obsidian-x11vnc.log 2>&1 &
  echo $! > "$X11VNC_PID_FILE"
fi

sleep 2

log "starting noVNC on 0.0.0.0:${NOVNC_PORT}"
exec websockify --web=/usr/share/novnc/ "$NOVNC_PORT" "127.0.0.1:${VNC_PORT}" >/var/log/obsidian-websockify.log 2>&1
