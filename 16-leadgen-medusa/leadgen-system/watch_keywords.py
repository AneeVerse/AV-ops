import hashlib
import json
import sys
from pathlib import Path

sys.path.append('/root/leadgen-system')

from sync_search_terms import SPREADSHEET_ID, get_svc, main as rebuild_workbook  # noqa: E402

STATE_FILE = Path('/root/leadgen-system/.keywords_fingerprint.json')


def read_keywords(svc):
    values = svc.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range='Keywords!A2:A',
    ).execute().get('values', [])
    return [' '.join(row[0].strip().split()) for row in values if row and row[0].strip()]


def fingerprint(items):
    payload = '\n'.join(items).encode('utf-8')
    return hashlib.sha256(payload).hexdigest()


def main():
    svc = get_svc()
    keywords = read_keywords(svc)
    current = fingerprint(keywords)
    previous = None
    if STATE_FILE.exists():
        try:
            previous = json.loads(STATE_FILE.read_text()).get('fingerprint')
        except Exception:
            previous = None

    if current == previous:
        return

    rebuild_workbook()
    STATE_FILE.write_text(json.dumps({'fingerprint': current, 'keywords': keywords}, indent=2))
    print(json.dumps({'updated': True, 'keywords': len(keywords)}, indent=2))


if __name__ == '__main__':
    main()
