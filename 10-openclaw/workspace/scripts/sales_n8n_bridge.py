#!/usr/bin/env python3
import json
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

SALES_DRAFT_SCRIPT = '/root/.openclaw/workspace/scripts/sales_n8n_next_lead_drafts.py'
SHOPIFY_LINKEDIN_SCRIPT = '/root/.openclaw/workspace/scripts/shopify_company_linkedin_next.py'


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        if urlparse(self.path).path == '/health':
            self._send(200, {'ok': True, 'service': 'sales-n8n-bridge'})
            return
        self._send(404, {'ok': False, 'error': 'not_found'})

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            length = int(self.headers.get('Content-Length') or 0)
            payload = json.loads(self.rfile.read(length).decode('utf-8') or '{}') if length else {}

            if path == '/sales-next-lead-drafts':
                limit = max(1, min(int(payload.get('limit', 2)), 25))
                owner = str(payload.get('owner') or 'Ane')
                dry_run = bool(payload.get('dryRun') or payload.get('dry_run'))
                cmd = ['python3', SALES_DRAFT_SCRIPT, '--limit', str(limit), '--owner', owner]
                if dry_run:
                    cmd.append('--dry-run')
                timeout = 60
            elif path == '/shopify-company-linkedin-next':
                limit = max(1, min(int(payload.get('limit', 1)), 25))
                start_row = max(2, int(payload.get('startRow') or payload.get('start_row') or 2))
                dry_run = bool(payload.get('dryRun') or payload.get('dry_run'))
                write_na = bool(payload.get('writeNA') or payload.get('write_na'))
                cmd = ['python3', SHOPIFY_LINKEDIN_SCRIPT, '--limit', str(limit), '--start-row', str(start_row)]
                if dry_run:
                    cmd.append('--dry-run')
                if write_na:
                    cmd.append('--write-na')
                timeout = 180
            else:
                self._send(404, {'ok': False, 'error': 'not_found'})
                return

            proc = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
            if proc.returncode != 0:
                self._send(500, {'ok': False, 'exitCode': proc.returncode, 'stderr': proc.stderr, 'stdout': proc.stdout})
                return
            result = json.loads(proc.stdout.strip().splitlines()[-1])
            self._send(200, result)
        except Exception as e:
            self._send(500, {'ok': False, 'error': str(e)})


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8012), Handler).serve_forever()
