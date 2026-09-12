#!/bin/bash
exec cloudflared tunnel --url http://127.0.0.1:8088 2> >(tee /opt/codex-proxy/tunnel.log >&2)
