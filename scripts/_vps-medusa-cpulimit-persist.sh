#!/bin/bash
# Persist cpulimit for Medusa and confirm settled CPU
cat >/usr/local/bin/medusa-cpulimit-watch.sh <<'EOF'
#!/bin/bash
while true; do
  pid=$(pgrep -f '/node_modules/.bin/medusa start' | head -1)
  if [ -n "$pid" ]; then
    if ! pgrep -f "cpulimit -p $pid" >/dev/null; then
      cpulimit -p "$pid" -l 100 -b
    fi
  fi
  sleep 30
done
EOF
chmod +x /usr/local/bin/medusa-cpulimit-watch.sh

cat >/etc/systemd/system/medusa-cpulimit.service <<'EOF'
[Unit]
Description=Keep Medusa CPU capped at ~1 core
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/medusa-cpulimit-watch.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now medusa-cpulimit.service

sleep 25
pid=$(pgrep -f '/node_modules/.bin/medusa start' | head -1)
echo "medusa pid=$pid"
ps -o pid,pcpu,pmem,etime,cmd -p "$pid"
uptime
curl -s -o /dev/null -w 'health:%{http_code}\n' http://127.0.0.1:9000/health
systemctl is-active medusa-cpulimit
echo PERSIST_DONE
