import json
import re
import urllib.request
from pathlib import Path

import xlrd
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from build_visa_sheet import parse_us_places, parse_uk_cities

SPREADSHEET_ID = '1CJ9Yh5c_IgeXpSO2xs_47EwiXqy1ILEejt_5j009C0Y'
TOKEN_PATH = Path('/root/.hermes/profiles/leadgen/google_token.json')
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]


def get_svc():
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(json.dumps(json.loads(creds.to_json()), indent=2))
    return build('sheets', 'v4', credentials=creds, cache_discovery=False)


def fetch_state_map():
    txt = urllib.request.urlopen('https://www2.census.gov/geo/docs/reference/state.txt').read().decode('utf-8')
    mapping = {}
    for line in txt.splitlines()[1:]:
        if not line.strip():
            continue
        parts = line.split('|')
        if len(parts) >= 3:
            _, abbr, name = parts[:3]
            mapping[abbr.strip()] = name.strip()
    return mapping


def build_us_rows(state_map):
    rows = []
    for abbr, geoid, ansicode, name, place_type, funcstat, aland, awater, lat, lon in parse_us_places():
        if place_type not in ('city', 'city and borough'):
            continue
        city = re.sub(r'\s+(city and borough|city)$', '', name).strip()
        state = state_map.get(abbr, abbr)
        rows.append([state, city, 'Not scraped yet'])
    return rows


def build_uk_rows():
    rows = []
    for country, region, city, official, source in parse_uk_cities():
        rows.append([region, city, 'Not scraped yet'])
    return rows


def build_india_rows():
    xls = Path('/tmp/india_towns_2001.xls')
    if not xls.exists():
        import subprocess
        subprocess.run([
            'curl', '-L', '-k', '-o', str(xls),
            'https://censusindia.gov.in/nada/index.php/catalog/20036/download/23168/Alphabetical_List_of_Towns_2001_Table_For_India.xls'
        ], check=True)
    book = xlrd.open_workbook(str(xls))
    sh = book.sheet_by_name('Alphabetical list of Towns')
    rows = []
    seen = set()
    for r in range(3, sh.nrows):
        city = str(sh.cell_value(r, 1)).strip()
        state = str(sh.cell_value(r, 3)).strip()
        if not city or not state:
            continue
        while re.search(r'\s*\(([^()]*)\)\s*$', city):
            city = re.sub(r'\s*\(([^()]*)\)\s*$', '', city)
        city = re.sub(r'\s+', ' ', city).strip()
        key = (state, city)
        if key in seen:
            continue
        seen.add(key)
        rows.append([state, city, 'Not scraped yet'])
    return rows


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield i, seq[i:i + size]


def write_sheet_values(svc, sheet, rows, header):
    svc.spreadsheets().values().clear(spreadsheetId=SPREADSHEET_ID, range=f'{sheet}!A1:C').execute()
    data = [{'range': f'{sheet}!A1:C1', 'values': [header]}]
    for i, chunk in chunked(rows, 1000):
        start = i + 2
        end = start + len(chunk) - 1
        data.append({'range': f'{sheet}!A{start}:C{end}', 'values': chunk})
    svc.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'valueInputOption': 'RAW', 'data': data},
    ).execute()


def main():
    svc = get_svc()
    state_map = fetch_state_map()
    us_rows = build_us_rows(state_map)
    uk_rows = build_uk_rows()
    india_rows = build_india_rows()

    meta = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID, fields='sheets(properties(sheetId,title))').execute()
    ids = {s['properties']['title']: s['properties']['sheetId'] for s in meta['sheets']}

    print(json.dumps({'us': len(us_rows), 'uk': len(uk_rows), 'india': len(india_rows)}, indent=2))
    print('US sample:', us_rows[:3])
    print('UK sample:', uk_rows[:3])
    print('India sample:', india_rows[:3])

    for title, rows in [('US', us_rows), ('UK', uk_rows), ('India', india_rows)]:
        row_count = len(rows) + 5
        svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': [
            {'updateSheetProperties': {'properties': {'sheetId': ids[title], 'gridProperties': {'rowCount': row_count, 'columnCount': 3, 'frozenRowCount': 1}}, 'fields': 'gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount'}},
            {'repeatCell': {'range': {'sheetId': ids[title], 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 3}, 'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.26, 'green': 0.54, 'blue': 0.96}, 'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE', 'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'fontSize': 11}}}, 'fields': 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'}},
            {'repeatCell': {'range': {'sheetId': ids[title], 'startRowIndex': 1, 'endRowIndex': row_count, 'startColumnIndex': 2, 'endColumnIndex': 3}, 'cell': {'userEnteredFormat': {'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE'}}, 'fields': 'userEnteredFormat(horizontalAlignment,verticalAlignment)'}},
            {'setDataValidation': {'range': {'sheetId': ids[title], 'startRowIndex': 1, 'endRowIndex': row_count, 'startColumnIndex': 2, 'endColumnIndex': 3}, 'rule': {'condition': {'type': 'ONE_OF_LIST', 'values': [
                {'userEnteredValue': 'Not scraped yet'},
                {'userEnteredValue': 'In progress'},
                {'userEnteredValue': 'Scraped'},
            ]}, 'strict': True, 'showCustomUi': True}}},
        ]}).execute()
        header = ['State/Region', 'City', 'Status'] if title != 'UK' else ['Region', 'City', 'Status']
        write_sheet_values(svc, title, rows, header)

    # Dashboard expansion to 15 columns is handled in a separate step.
    verify = {
        'US': svc.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range='US!A1:C4').execute().get('values', []),
        'UK': svc.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range='UK!A1:C4').execute().get('values', []),
        'India': svc.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range='India!A1:C4').execute().get('values', []),
    }
    print(json.dumps(verify, indent=2))


if __name__ == '__main__':
    main()
