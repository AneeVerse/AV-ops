#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_URL = 'https://github.com/AneeVerse/horeca1.git'
DEFAULT_MODEL = 'openrouter/stepfun/step-3.5-flash:free'


def load_env(paths=None):
    paths = paths or ['/root/.env', '/root/.openclaw/workspace/.env']
    for path in paths:
        p = Path(path)
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ[k] = v


def git_recent_commits(since='2 days ago', limit=30):
    with tempfile.TemporaryDirectory() as tmp:
        repo = Path(tmp) / 'repo'
        subprocess.run(
            ['git', 'clone', '--filter=blob:none', '--no-checkout', REPO_URL, str(repo)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        out = subprocess.check_output(
            [
                'git', '-C', str(repo), 'log', f'--since={since}', '--date=iso',
                f'--pretty=format:%ad | %an | %s', f'-n{limit}'
            ],
            text=True,
        )
        return out.strip()


def summarize_with_openrouter(commits_text):
    prompt = (
        'Summarize these HORECA1 GitHub commits from the last 2 days for an internal team Google Chat update. '
        'Keep it concise, practical, grouped by work areas, and end with a one-line overall status. '
        'Do not mention missing data or speculate.\n\n'
        f'Commits:\n{commits_text}'
    )
    payload = {
        'model': os.environ.get('HORECA1_SUMMARY_MODEL', DEFAULT_MODEL),
        'messages': [
            {'role': 'system', 'content': 'You write concise business progress summaries for internal team chat.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=json.dumps(payload).encode(),
        headers={
            'Authorization': f"Bearer {os.environ['OPENROUTER_API_KEY']}",
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode())
    return data['choices'][0]['message']['content'].strip()


def post_google_chat(text):
    req = urllib.request.Request(
        os.environ['HORECA1_GOOGLE_CHAT_WEBHOOK'],
        data=json.dumps({'text': text}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def deterministic_summary(commits_text):
    lines = [line.strip() for line in commits_text.splitlines() if line.strip()]
    if not lines:
        return 'No new commits found in the last 2 days. Overall status: no code-update activity detected.'
    buckets = {
        'AI / mapping': [],
        'Admin / fixes': [],
        'UI / product': [],
        'Other': [],
    }
    for line in lines:
        lower = line.lower()
        if any(k in lower for k in ['mapping', 'embed', 'ai', 'brand sku']):
            buckets['AI / mapping'].append(line)
        elif any(k in lower for k in ['fix(', 'approve', 'reject', 'validator', 'patch']):
            buckets['Admin / fixes'].append(line)
        elif any(k in lower for k in ['image', 'modal', 'dropdown', 'store', 'product', 'frontend', 'analytics']):
            buckets['UI / product'].append(line)
        else:
            buckets['Other'].append(line)
    out = []
    for name, items in buckets.items():
        if not items:
            continue
        out.append(f'{name}:')
        for item in items[:5]:
            subject = item.split(' | ', 2)[-1]
            out.append(f'- {subject}')
        out.append('')
    out.append('Overall status: recent work is active and mainly focused on product/admin improvements plus AI-assisted brand mapping.')
    return '\n'.join(out).strip()


def run(send=True):
    load_env()
    commits = git_recent_commits()
    try:
        summary_body = summarize_with_openrouter(commits)
        mode = 'llm'
    except Exception:
        summary_body = deterministic_summary(commits)
        mode = 'deterministic_fallback'
    text = f'HORECA1 progress summary (last 2 days)\n\n{summary_body}'
    result = {
        'status': 'success',
        'mode': mode,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'repo_url': REPO_URL,
        'commits': commits,
        'text': text,
    }
    if send:
        result['chat_response'] = post_google_chat(text)
    return result


if __name__ == '__main__':
    import sys
    send = '--no-send' not in sys.argv
    print(json.dumps(run(send=send), indent=2))
