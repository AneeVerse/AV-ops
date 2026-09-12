import json
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SPREADSHEET_ID = '1CJ9Yh5c_IgeXpSO2xs_47EwiXqy1ILEejt_5j009C0Y'
TOKEN_PATH = Path('/root/.hermes/profiles/leadgen/google_token.json')
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]
COUNTRY_TABS = ['US', 'UK', 'India']
STATUS_VALUES = ['Not scraped yet', 'In progress', 'Scraped']
SOURCE_HEADER = ['Country', 'State / Region', 'City', 'Lead Tier (T1-T3 / P1-P3)']
SEARCH_HEADER = ['City', 'Keyword', 'Search Term', 'Status', 'Key']
STATUS_SHEET = 'Search_Status'
BLOCK_SIZE = 250


def get_svc():
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(json.dumps(json.loads(creds.to_json()), indent=2))
    return build('sheets', 'v4', credentials=creds, cache_discovery=False)


def norm(v):
    return ' '.join(str(v).strip().split()).lower()


def make_key(country, state, city, keyword):
    return ' | '.join([norm(country), norm(state), norm(city), norm(keyword)])


def read_keywords(svc):
    values = svc.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range='Keywords!A2:A',
    ).execute().get('values', [])
    return [row[0].strip() for row in values if row and row[0].strip()]


def read_city_rows(svc, tab):
    values = svc.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f'{tab}!A2:D',
    ).execute().get('values', [])
    rows = []
    for row in values:
        if len(row) < 3:
            continue
        country = row[0].strip() if len(row) > 0 and row[0].strip() else tab
        state = row[1].strip() if len(row) > 1 else ''
        city = row[2].strip() if len(row) > 2 else ''
        if not city:
            continue
        lead_tier = row[3].strip() if len(row) > 3 and row[3].strip() else ''
        rows.append({'country': country, 'state': state, 'city': city, 'lead_tier': lead_tier})
    return rows


def chunked(seq, size):
    for idx in range(0, len(seq), size):
        yield idx, seq[idx:idx + size]


def list_sheet_names(svc):
    meta = svc.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields='sheets(properties(title))',
    ).execute()
    return {s['properties']['title'] for s in meta['sheets']}


def read_existing_statuses(svc):
    names = list_sheet_names(svc)
    out = {}

    if STATUS_SHEET in names:
        values = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{STATUS_SHEET}!A2:B',
        ).execute().get('values', [])
        for row in values:
            if len(row) >= 2 and row[0].strip():
                out[row[0].strip()] = row[1].strip() or 'Not scraped yet'
        return out

    if 'Search Terms' in names:
        values = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Search Terms!A2:G',
        ).execute().get('values', [])
        for row in values:
            if len(row) >= 7 and row[6].strip():
                out[row[6].strip()] = row[5].strip() or 'Not scraped yet'
        return out

    for tab in COUNTRY_TABS:
        values = svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{tab}!G2:K',
        ).execute().get('values', [])
        for row in values:
            if len(row) >= 5 and row[4].strip():
                out[row[4].strip()] = row[3].strip() or 'Not scraped yet'
    return out


def ensure_status_sheet(svc, status_map):
    names = list_sheet_names(svc)
    if STATUS_SHEET not in names:
        svc.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'requests': [
                {'addSheet': {'properties': {
                    'title': STATUS_SHEET,
                    'gridProperties': {'rowCount': max(1000, len(status_map) + 10), 'columnCount': 2},
                }}},
            ]},
        ).execute()
        meta = svc.spreadsheets().get(
            spreadsheetId=SPREADSHEET_ID,
            fields='sheets(properties(title,sheetId))',
        ).execute()
        sid = next(s['properties']['sheetId'] for s in meta['sheets'] if s['properties']['title'] == STATUS_SHEET)
        svc.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'requests': [
                {'updateSheetProperties': {
                    'properties': {'sheetId': sid, 'hidden': True},
                    'fields': 'hidden',
                }},
            ]},
        ).execute()
    else:
        meta = svc.spreadsheets().get(
            spreadsheetId=SPREADSHEET_ID,
            fields='sheets(properties(title,sheetId,hidden))',
        ).execute()
        sid = next(s['properties']['sheetId'] for s in meta['sheets'] if s['properties']['title'] == STATUS_SHEET)
        svc.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'requests': [
                {'updateSheetProperties': {
                    'properties': {'sheetId': sid, 'hidden': True},
                    'fields': 'hidden',
                }},
            ]},
        ).execute()

    rows = [['Key', 'Status']]
    rows.extend([[k, status_map[k]] for k in sorted(status_map)])
    svc.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range=f'{STATUS_SHEET}!A:B',
    ).execute()
    svc.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f'{STATUS_SHEET}!A1:B{len(rows)}',
        valueInputOption='RAW',
        body={'values': rows},
    ).execute()


def build_block_formula():
    return (
        '=IF(COUNTA(Keywords!$A$2:$A)=0,"",'
        'LET('
        'k,FILTER(Keywords!$A$2:$A,Keywords!$A$2:$A<>""),'
        'city,$C2,'
        'state,$B2,'
        'country,$A2,'
        'n,ROWS(k),'
        'MAKEARRAY(n,5,LAMBDA(r,c,LET('
        'keyword,INDEX(k,r),'
        'search,keyword&" "&city,'
        'key,LOWER(country&" | "&state&" | "&city&" | "&keyword),'
        'SWITCH(c,1,city,2,keyword,3,search,4,IFERROR(VLOOKUP(key,Search_Status!A:B,2,FALSE),"Not scraped yet"),5,key)'
        ')))))'
    )


def add_conditional_status_rules(requests, sheet_id, row_count):
    rng = {
        'sheetId': sheet_id,
        'startRowIndex': 1,
        'endRowIndex': row_count,
        'startColumnIndex': 9,
        'endColumnIndex': 10,
    }
    colors = {
        'Not scraped yet': {'red': 0.95, 'green': 0.96, 'blue': 0.98},
        'In progress': {'red': 1.0, 'green': 0.95, 'blue': 0.78},
        'Scraped': {'red': 0.88, 'green': 0.97, 'blue': 0.90},
    }
    for idx, status in enumerate(['Scraped', 'In progress', 'Not scraped yet']):
        requests.append({
            'addConditionalFormatRule': {
                'index': idx,
                'rule': {
                    'ranges': [rng],
                    'booleanRule': {
                        'condition': {
                            'type': 'TEXT_EQ',
                            'values': [{'userEnteredValue': status}],
                        },
                        'format': {
                            'backgroundColor': colors[status],
                            'textFormat': {'bold': True},
                        },
                    },
                },
            }
        })


def rebuild_dashboard(svc):
    meta = svc.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields='sheets(properties(title,sheetId))',
    ).execute()
    ids = {s['properties']['title']: s['properties']['sheetId'] for s in meta['sheets']}

    if 'Dashboard' in ids:
        svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': [
            {'deleteSheet': {'sheetId': ids['Dashboard']}},
        ]}).execute()

    svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': [
        {'addSheet': {'properties': {'title': 'Dashboard', 'gridProperties': {'rowCount': 18, 'columnCount': 9, 'frozenRowCount': 1}}}},
    ]}).execute()

    meta = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID, fields='sheets(properties(title,sheetId))').execute()
    dash_id = next(s['properties']['sheetId'] for s in meta['sheets'] if s['properties']['title'] == 'Dashboard')

    values = [
        ['Visa Services Leadgen Dashboard'],
        ['Live from Keywords!A2:A. Search-term rows rebuild when keywords change.'],
        ['Total Countries', '=3', 'Total Keywords', '=COUNTA(Keywords!A2:A)', 'Total Cities', '=COUNTA(US!C2:C)+COUNTA(UK!C2:C)+COUNTA(India!C2:C)', 'Total Search Terms', '=COUNTA(US!K2:K)+COUNTA(UK!K2:K)+COUNTA(India!K2:K)', ''],
        ['United States', '', '', 'United Kingdom', '', '', 'India', '', ''],
        ['Cities total', '=COUNTA(US!C2:C)', '', 'Cities total', '=COUNTA(UK!C2:C)', '', 'Cities total', '=COUNTA(India!C2:C)', ''],
        ['Search terms total', '=COUNTA(US!K2:K)', '', 'Search terms total', '=COUNTA(UK!K2:K)', '', 'Search terms total', '=COUNTA(India!K2:K)', ''],
        ['Not scraped yet', '=COUNTIF(US!J2:J,"Not scraped yet")', '', 'Not scraped yet', '=COUNTIF(UK!J2:J,"Not scraped yet")', '', 'Not scraped yet', '=COUNTIF(India!J2:J,"Not scraped yet")', ''],
        ['In progress', '=COUNTIF(US!J2:J,"In progress")', '', 'In progress', '=COUNTIF(UK!J2:J,"In progress")', '', 'In progress', '=COUNTIF(India!J2:J,"In progress")', ''],
        ['Done', '=COUNTIF(US!J2:J,"Scraped")', '', 'Done', '=COUNTIF(UK!J2:J,"Scraped")', '', 'Done', '=COUNTIF(India!J2:J,"Scraped")', ''],
    ]
    svc.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range='Dashboard!A1:I9',
        valueInputOption='USER_ENTERED',
        body={'values': values},
    ).execute()

    requests = [
        {'mergeCells': {'range': {'sheetId': dash_id, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 9}, 'mergeType': 'MERGE_ALL'}},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 9},
            'cell': {'userEnteredFormat': {
                'backgroundColor': {'red': 0.10, 'green': 0.42, 'blue': 0.84},
                'horizontalAlignment': 'CENTER',
                'verticalAlignment': 'MIDDLE',
                'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True, 'fontSize': 16},
            }},
            'fields': 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
        }},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 1, 'endRowIndex': 2, 'startColumnIndex': 0, 'endColumnIndex': 9},
            'cell': {'userEnteredFormat': {
                'backgroundColor': {'red': 0.95, 'green': 0.97, 'blue': 1.0},
                'horizontalAlignment': 'CENTER',
                'verticalAlignment': 'MIDDLE',
                'textFormat': {'foregroundColor': {'red': 0.22, 'green': 0.28, 'blue': 0.34}, 'italic': True, 'fontSize': 10},
            }},
            'fields': 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
        }},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 2, 'endRowIndex': 3, 'startColumnIndex': 0, 'endColumnIndex': 2},
            'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.98, 'green': 0.99, 'blue': 1.0}, 'borders': {'top': {'style': 'SOLID'}, 'bottom': {'style': 'SOLID'}, 'left': {'style': 'SOLID'}, 'right': {'style': 'SOLID'}}}},
            'fields': 'userEnteredFormat(backgroundColor,borders)',
        }},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 2, 'endRowIndex': 3, 'startColumnIndex': 2, 'endColumnIndex': 4},
            'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.96, 'green': 1.0, 'blue': 0.99}, 'borders': {'top': {'style': 'SOLID'}, 'bottom': {'style': 'SOLID'}, 'left': {'style': 'SOLID'}, 'right': {'style': 'SOLID'}}}},
            'fields': 'userEnteredFormat(backgroundColor,borders)',
        }},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 2, 'endRowIndex': 3, 'startColumnIndex': 4, 'endColumnIndex': 6},
            'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.99, 'green': 0.98, 'blue': 0.95}, 'borders': {'top': {'style': 'SOLID'}, 'bottom': {'style': 'SOLID'}, 'left': {'style': 'SOLID'}, 'right': {'style': 'SOLID'}}}},
            'fields': 'userEnteredFormat(backgroundColor,borders)',
        }},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 2, 'endRowIndex': 3, 'startColumnIndex': 6, 'endColumnIndex': 8},
            'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.97, 'green': 0.97, 'blue': 0.97}, 'borders': {'top': {'style': 'SOLID'}, 'bottom': {'style': 'SOLID'}, 'left': {'style': 'SOLID'}, 'right': {'style': 'SOLID'}}}},
            'fields': 'userEnteredFormat(backgroundColor,borders)',
        }},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 2, 'endRowIndex': 3, 'startColumnIndex': 0, 'endColumnIndex': 9},
            'cell': {'userEnteredFormat': {'horizontalAlignment': 'CENTER', 'textFormat': {'bold': True}}},
            'fields': 'userEnteredFormat(horizontalAlignment,textFormat)',
        }},
        {'repeatCell': {
            'range': {'sheetId': dash_id, 'startRowIndex': 3, 'endRowIndex': 9, 'startColumnIndex': 0, 'endColumnIndex': 9},
            'cell': {'userEnteredFormat': {'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE'}},
            'fields': 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
        }},
        {'updateDimensionProperties': {'range': {'sheetId': dash_id, 'dimension': 'ROWS', 'startIndex': 0, 'endIndex': 1}, 'properties': {'pixelSize': 40}, 'fields': 'pixelSize'}},
        {'updateDimensionProperties': {'range': {'sheetId': dash_id, 'dimension': 'ROWS', 'startIndex': 1, 'endIndex': 2}, 'properties': {'pixelSize': 28}, 'fields': 'pixelSize'}},
        {'updateDimensionProperties': {'range': {'sheetId': dash_id, 'dimension': 'ROWS', 'startIndex': 2, 'endIndex': 9}, 'properties': {'pixelSize': 28}, 'fields': 'pixelSize'}},
    ]
    for col, px in {0: 180, 1: 100, 2: 20, 3: 180, 4: 100, 5: 20, 6: 180, 7: 100, 8: 20}.items():
        requests.append({'updateDimensionProperties': {'range': {'sheetId': dash_id, 'dimension': 'COLUMNS', 'startIndex': col, 'endIndex': col + 1}, 'properties': {'pixelSize': px}, 'fields': 'pixelSize'}})

    svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': requests}).execute()


def main():
    svc = get_svc()
    keywords = read_keywords(svc)
    existing_status = read_existing_statuses(svc)

    # Build a fresh static status map keyed by country/state/city/keyword.
    status_map = dict(existing_status)
    city_rows_by_tab = {}
    status_counts = {}
    totals = {}

    for tab in COUNTRY_TABS:
        city_rows = read_city_rows(svc, tab)
        city_rows_by_tab[tab] = city_rows
        counts = {s: 0 for s in STATUS_VALUES}
        total = len(city_rows) * len(keywords)
        totals[tab] = total
        for city in city_rows:
            for keyword in keywords:
                key = make_key(city['country'], city['state'], city['city'], keyword)
                status = status_map.get(key, 'Not scraped yet')
                if status not in STATUS_VALUES:
                    status = 'Not scraped yet'
                status_map[key] = status
                counts[status] += 1
        status_counts[tab] = counts

    # Keep a hidden backup of statuses by key.
    ensure_status_sheet(svc, status_map)

    meta = svc.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields='sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)))',
    ).execute()
    props = {s['properties']['title']: s['properties'] for s in meta['sheets']}

    for tab in COUNTRY_TABS:
        p = props[tab]
        sid = p['sheetId']
        city_rows = city_rows_by_tab[tab]
        desired_rows = max(p['gridProperties'].get('rowCount', 0), len(city_rows) * BLOCK_SIZE + 5)
        if desired_rows != p['gridProperties'].get('rowCount', 0) or p['gridProperties'].get('columnCount', 0) != 11:
            svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': [{
                'updateSheetProperties': {
                    'properties': {
                        'sheetId': sid,
                        'gridProperties': {'rowCount': desired_rows, 'columnCount': 11},
                    },
                    'fields': 'gridProperties.rowCount,gridProperties.columnCount',
                }
            }]}).execute()
            meta = svc.spreadsheets().get(
                spreadsheetId=SPREADSHEET_ID,
                fields='sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)))',
            ).execute()
            props = {s['properties']['title']: s['properties'] for s in meta['sheets']}
            p = props[tab]
            sid = p['sheetId']
            desired_rows = p['gridProperties']['rowCount']

        # Clear prior search/formula area and source area before rebuilding.
        svc.spreadsheets().values().clear(spreadsheetId=SPREADSHEET_ID, range=f'{tab}!A:K').execute()

        svc.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{tab}!A1:D1',
            valueInputOption='RAW',
            body={'values': [SOURCE_HEADER]},
        ).execute()
        source_values = [[r['country'], r['state'], r['city'], r['lead_tier']] for r in city_rows]
        for start, chunk in chunked(source_values, 4000):
            r1 = start + 2
            r2 = r1 + len(chunk) - 1
            svc.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f'{tab}!A{r1}:D{r2}',
                valueInputOption='RAW',
                body={'values': chunk},
            ).execute()

        svc.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{tab}!G1:K1',
            valueInputOption='RAW',
            body={'values': [SEARCH_HEADER]},
        ).execute()

        formula_rows = []
        for idx, city in enumerate(city_rows):
            start_row = 2 + idx * BLOCK_SIZE
            formula_rows.append({
                'range': f'{tab}!G{start_row}',
                'values': [[build_block_formula().replace('$A2', f'$A{idx + 2}').replace('$B2', f'$B{idx + 2}').replace('$C2', f'$C{idx + 2}')]],
            })
        # Write formulas in chunks to avoid oversized payloads.
        for start, chunk in chunked(formula_rows, 500):
            svc.spreadsheets().values().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={'valueInputOption': 'USER_ENTERED', 'data': chunk},
            ).execute()

        requests = [
            {'repeatCell': {
                'range': {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 4},
                'cell': {'userEnteredFormat': {
                    'backgroundColor': {'red': 0.14, 'green': 0.38, 'blue': 0.76},
                    'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True},
                    'horizontalAlignment': 'CENTER',
                    'verticalAlignment': 'MIDDLE',
                }},
                'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            }},
            {'repeatCell': {
                'range': {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 6, 'endColumnIndex': 11},
                'cell': {'userEnteredFormat': {
                    'backgroundColor': {'red': 0.10, 'green': 0.42, 'blue': 0.84},
                    'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'bold': True},
                    'horizontalAlignment': 'CENTER',
                    'verticalAlignment': 'MIDDLE',
                }},
                'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            }},
            {'repeatCell': {
                'range': {'sheetId': sid, 'startRowIndex': 1, 'endRowIndex': desired_rows, 'startColumnIndex': 0, 'endColumnIndex': 4},
                'cell': {'userEnteredFormat': {'verticalAlignment': 'MIDDLE'}},
                'fields': 'userEnteredFormat(verticalAlignment)',
            }},
            {'repeatCell': {
                'range': {'sheetId': sid, 'startRowIndex': 1, 'endRowIndex': desired_rows, 'startColumnIndex': 5, 'endColumnIndex': 6},
                'cell': {'userEnteredFormat': {'backgroundColor': {'red': 0.15, 'green': 0.18, 'blue': 0.24}}},
                'fields': 'userEnteredFormat(backgroundColor)',
            }},
            {'repeatCell': {
                'range': {'sheetId': sid, 'startRowIndex': 1, 'endRowIndex': desired_rows, 'startColumnIndex': 6, 'endColumnIndex': 11},
                'cell': {'userEnteredFormat': {'verticalAlignment': 'MIDDLE', 'backgroundColor': {'red': 0.98, 'green': 0.99, 'blue': 1.0}}},
                'fields': 'userEnteredFormat(verticalAlignment,backgroundColor)',
            }},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 0, 'endIndex': 1}, 'properties': {'pixelSize': 140}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 1, 'endIndex': 2}, 'properties': {'pixelSize': 140}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 2, 'endIndex': 3}, 'properties': {'pixelSize': 180}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 3, 'endIndex': 4}, 'properties': {'pixelSize': 130}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 4, 'endIndex': 5}, 'properties': {'pixelSize': 16}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 5, 'endIndex': 6}, 'properties': {'pixelSize': 18, 'hiddenByUser': False}, 'fields': 'pixelSize,hiddenByUser'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 6, 'endIndex': 7}, 'properties': {'pixelSize': 180}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 7, 'endIndex': 8}, 'properties': {'pixelSize': 170}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 8, 'endIndex': 9}, 'properties': {'pixelSize': 220}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 9, 'endIndex': 10}, 'properties': {'pixelSize': 120}, 'fields': 'pixelSize'}},
            {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': 10, 'endIndex': 11}, 'properties': {'pixelSize': 300, 'hiddenByUser': True}, 'fields': 'pixelSize,hiddenByUser'}},
        ]
        add_conditional_status_rules(requests, sid, desired_rows)
        svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': requests}).execute()

    names = list_sheet_names(svc)
    if 'Search Terms' in names:
        meta = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID, fields='sheets(properties(title,sheetId))').execute()
        sid = next(s['properties']['sheetId'] for s in meta['sheets'] if s['properties']['title'] == 'Search Terms')
        svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': [
            {'deleteSheet': {'sheetId': sid}},
        ]}).execute()

    rebuild_dashboard(svc)

    summary = {
        'keywords': len(keywords),
        'search_rows': totals,
        'status_counts': status_counts,
        'status_sheet_rows': len(status_map),
        'sheets': sorted(list_sheet_names(svc)),
    }
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()
