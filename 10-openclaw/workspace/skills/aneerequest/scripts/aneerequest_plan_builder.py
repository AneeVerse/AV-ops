#!/usr/bin/env python3
import argparse
import json
import re
import sys

TEAM_HINTS = {
    'design': 'Himanshi',
    'logo': 'Himanshi',
    'graphic': 'Himanshi',
    'banner': 'Himanshi',
    'poster': 'Himanshi',
    'blog': 'Abhijeet',
    'content': 'Abhijeet',
    'finance': 'Abhijeet',
    'payment': 'Abhijeet',
    'lead': 'Abhijeet',
    'ads': 'Suraj',
    'meta ads': 'Suraj',
    'google ads': 'Suraj',
    'ecommerce': 'Suraj',
    'website': 'Mayur',
    'development': 'Mayur',
    'bug': 'Mayur',
    'api': 'Mayur',
    'support dev': 'Sanket'
}


def suggest_assignee(text):
    low = text.lower()
    for key, assignee in TEAM_HINTS.items():
        if key in low:
            return assignee
    return None


def parse_tasks(raw):
    lines = [line.strip(' -\t') for line in raw.splitlines() if line.strip()]
    if len(lines) <= 1:
        parts = [p.strip() for p in re.split(r'[\n;,]+', raw) if p.strip()]
        lines = parts or lines
    tasks = []
    for line in lines:
        tasks.append({
            'title': line,
            'description': '',
            'status': 'Todo',
            'priority': 'Medium',
            'assigned_to': suggest_assignee(line),
            'due_date': None
        })
    return tasks


def main():
    ap = argparse.ArgumentParser(description='Build aneerequest plan from raw text')
    ap.add_argument('--client-organization', default='')
    ap.add_argument('--client-name', default='')
    ap.add_argument('--request-title', default='')
    ap.add_argument('--input', help='Raw text input. If omitted, stdin is used.')
    args = ap.parse_args()

    raw = args.input if args.input is not None else sys.stdin.read()
    raw = raw.strip()
    if not raw:
        print('No input provided', file=sys.stderr)
        sys.exit(1)

    tasks = parse_tasks(raw)
    plan = {
        'client_organization': args.client_organization or None,
        'client_name': args.client_name or None,
        'request_title': args.request_title or None,
        'allow_create_request': False,
        'tasks': tasks,
        'ambiguities': []
    }
    if not plan['client_organization'] and not plan['client_name']:
        plan['ambiguities'].append('Client not specified')
    if not plan['request_title']:
        plan['ambiguities'].append('Request title not specified; use existing relevant request or 00-Updates-Followups')

    print(json.dumps(plan, indent=2))


if __name__ == '__main__':
    main()
