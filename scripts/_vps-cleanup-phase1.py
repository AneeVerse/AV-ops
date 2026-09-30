import paramiko, time
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('148.230.67.132', username='root', key_filename=r'C:\Users\mayur\.ssh\id_ed25519', timeout=30, allow_agent=False, look_for_keys=False)

def run(cmd, t=180):
    print(f'\n$ {cmd[:120]}{"..." if len(cmd)>120 else ""}')
    _,o,e=c.exec_command(cmd, timeout=t)
    out=(o.read()+e.read()).decode('utf-8','replace')
    print(out[-4000:] if len(out)>4000 else out)
    return out

# 1) Stop+disable+remove scrape/chat/codex + unlinked github tools
run('systemctl stop scrapegraphai-web chat-control codex-proxy automation-api traitdna-video-platform 2>&1; systemctl disable scrapegraphai-web chat-control codex-proxy automation-api traitdna-video-platform 2>&1')

# remove unit files
run('rm -f /etc/systemd/system/scrapegraphai-web.service /etc/systemd/system/chat-control.service /etc/systemd/system/codex-proxy.service /etc/systemd/system/automation-api.service /etc/systemd/system/traitdna-video-platform.service; systemctl daemon-reload; echo UNITS_GONE')

# nginx sites
run('''
for s in scrape chat codex; do
  rm -f /etc/nginx/sites-enabled/${s}.aneeverse.com /etc/nginx/sites-available/${s}.aneeverse.com
  ls /etc/nginx/sites-enabled/ | grep -i $s || echo "nginx $s gone"
done
nginx -t && systemctl reload nginx && echo NGINX_OK
''')

# remove app dirs
run('''
rm -rf /opt/scrapegraphai /opt/codex-proxy /tmp/codex-proxy-src
rm -rf /root/.openclaw/workspace/chat-control
rm -rf /root/.openclaw/workspace/projects/traitdna-video-platform
rm -rf /root/.openclaw/workspace/tmp/automation-api-venv
# leave scripts if any but kill venv
echo DIRS_REMOVED
du -sh /opt/scrapegraphai /opt/codex-proxy 2>&1 | head -5
''')

# certbot leftovers optional - keep certs for now (harmless, small)
run('ls /etc/letsencrypt/live/ 2>/dev/null')

print('PHASE1_DONE')
c.close()
