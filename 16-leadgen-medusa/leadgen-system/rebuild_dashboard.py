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


def get_svc():
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(json.dumps(json.loads(creds.to_json()), indent=2))
    return build('sheets', 'v4', credentials=creds, cache_discovery=False)


def main():
    svc = get_svc()
    meta = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID, fields='sheets(properties(title,sheetId))').execute()
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

    preview = svc.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range='Dashboard!A1:I9').execute().get('values', [])
    print(json.dumps(preview, indent=2))


if __name__ == '__main__':
    main()
