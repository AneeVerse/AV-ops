#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace')
DISPATCHER = ROOT / 'scripts' / 'automation10_assignment_dispatcher_local.py'
REPLY_PARSER = ROOT / 'scripts' / 'automation10_reply_parser_local.py'
FOLLOWUP = ROOT / 'scripts' / 'automation10_followup_engine_local.py'
DASHBOARD = ROOT / 'scripts' / 'automation10_dashboard_local.py'


def run_json(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or f'command failed: {cmd}')
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f'invalid JSON from {cmd}: {e}\nOutput: {proc.stdout[:500]}')


def main():
    dispatch = run_json(['python3', str(DISPATCHER)])
    replies = run_json(['python3', str(REPLY_PARSER)])
    followup = run_json(['python3', str(FOLLOWUP)])
    dashboard = run_json(['python3', str(DASHBOARD)])

    output = {
        'status': 'success',
        'dispatcher': dispatch,
        'reply_parser': replies,
        'followup': followup,
        'dashboard_counts': dashboard.get('counts', {}),
        'dashboard_summary_text': dashboard.get('summary_text'),
    }
    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
