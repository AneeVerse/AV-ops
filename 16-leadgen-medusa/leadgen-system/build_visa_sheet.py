import csv
import io
import json
import re
import html
import zipfile
from pathlib import Path

import requests
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SPREADSHEET_TITLE = "Visa Services Leadgen Research - Facts"
FOLDER_ID = "1ZzjYZSE5w064nACc4X8gDWL7urEpddpm"  # Nami_Leadgen
TOKEN_PATH = Path('/root/.hermes/profiles/leadgen/google_token.json')
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]
US_PLACES_URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip'
US_ZCTA_URL = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip'
UK_CITIES_URL = 'https://www.gov.uk/government/publications/list-of-cities/list-of-cities-html'


def get_creds():
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(json.dumps(json.loads(creds.to_json()), indent=2))
    return creds


def build_svc(api, version):
    return build(api, version, credentials=get_creds(), cache_discovery=False)


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i+size]


def col_letter(n: int) -> str:
    s = ''
    while n:
        n, rem = divmod(n-1, 26)
        s = chr(65 + rem) + s
    return s


def a1(sheet: str, start_row: int, start_col: int, nrows: int, ncols: int) -> str:
    return f"{sheet}!{col_letter(start_col)}{start_row}:{col_letter(start_col+ncols-1)}{start_row+nrows-1}"


def write_block(sheets, spreadsheet_id: str, sheet: str, start_row: int, rows):
    if not rows:
        return
    ncols = max(len(r) for r in rows)
    padded = [r + [''] * (ncols - len(r)) for r in rows]
    rng = a1(sheet, start_row, 1, len(padded), ncols)
    sheets.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=rng,
        valueInputOption='RAW',
        body={'values': padded},
    ).execute()


def parse_us_places():
    print('Fetching US places...')
    resp = requests.get(US_PLACES_URL, timeout=120, headers={'User-Agent': 'Mozilla/5.0'})
    resp.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(resp.content))
    name = z.namelist()[0]
    lines = z.read(name).decode('latin1').splitlines()
    reader = csv.DictReader(lines, delimiter='\t')
    if reader.fieldnames:
        reader.fieldnames = [f.strip() for f in reader.fieldnames]
    rows = []
    for row in reader:
        row = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        nm = row['NAME']
        m = re.search(r' (city and borough|borough and city|city|township|municipality|village|town|borough|CDP|plantation|metro government|urban county|urban township|district|zone|reservation|charter township)$', nm)
        place_type = m.group(1) if m else 'other'
        rows.append([
            row.get('USPS', ''), row.get('GEOID', ''), row.get('ANSICODE', ''), nm,
            place_type, row.get('FUNCSTAT', ''), row.get('ALAND_SQMI', ''), row.get('AWATER_SQMI', ''),
            row.get('INTPTLAT', ''), row.get('INTPTLONG', ''),
        ])
    return rows


def parse_us_zctas():
    print('Fetching US ZCTAs...')
    resp = requests.get(US_ZCTA_URL, timeout=120, headers={'User-Agent': 'Mozilla/5.0'})
    resp.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(resp.content))
    name = z.namelist()[0]
    lines = z.read(name).decode('latin1').splitlines()
    reader = csv.DictReader(lines, delimiter='\t')
    if reader.fieldnames:
        reader.fieldnames = [f.strip() for f in reader.fieldnames]
    rows = []
    for row in reader:
        row = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        rows.append([
            row.get('ZCTA5', row.get('GEOID', '')),
            row.get('GEOID', ''),
            row.get('ALAND_SQMI', ''),
            row.get('AWATER_SQMI', ''),
            row.get('INTPTLAT', ''),
            row.get('INTPTLONG', ''),
        ])
    return rows


def parse_uk_cities():
    print('Fetching UK cities...')
    text = requests.get(UK_CITIES_URL, timeout=60, headers={'User-Agent': 'Mozilla/5.0'}).text
    sections = re.findall(r'\\u003ch4 id=\\"(.*?)\\"\\u003e(.*?)\\u003c/h4\\u003e\\u003cul\\u003e(.*?)\\u003c/ul\\u003e', text)
    rows = []
    for _, region, block in sections:
        for it in re.findall(r'\\u003cli\\u003e(.*?)\\u003c/li\\u003e', block):
            raw = html.unescape(it)
            official = raw.endswith('*')
            city = raw.replace('*', '').replace('\\u0026amp;', '&').replace('&amp;', '&').strip()
            rows.append(['UK', region, city, 'Yes' if official else 'No', UK_CITIES_URL])
    return rows


def keyword_rows():
    pairs = [
        ('Generic', 'visa services'), ('Generic', 'visa service'), ('Generic', 'immigration services'), ('Generic', 'immigration service'),
        ('Generic', 'immigration consultant'), ('Generic', 'immigration consultants'), ('Generic', 'immigration advisor'), ('Generic', 'immigration lawyer'),
        ('Generic', 'immigration solicitor'), ('Generic', 'visa consultant'), ('Generic', 'visa consultants'), ('Generic', 'visa agency'),
        ('Generic', 'visa agent'), ('Generic', 'visa application help'), ('Generic', 'visa application service'), ('Generic', 'travel visa services'),
        ('Generic', 'passport and visa services'), ('Generic', 'migration services'), ('Business', 'corporate immigration services'),
        ('Business', 'global mobility services'), ('Business', 'sponsor licence services'), ('Business', 'sponsor licence application'),
        ('Business', 'work permit services'), ('Business', 'employment visa services'), ('Business', 'skilled worker visa'), ('Business', 'work visa'),
        ('Business', 'business visa'), ('Business', 'investor visa'), ('Business', 'company sponsored visa'), ('Personal', 'student visa'),
        ('Personal', 'spouse visa'), ('Personal', 'family visa'), ('Personal', 'dependent visa'), ('Personal', 'visitor visa'), ('Personal', 'tourist visa'),
        ('Personal', 'fiancé visa'), ('Personal', 'partner visa'), ('Personal', 'settlement visa'), ('Personal', 'indefinite leave to remain'),
        ('Personal', 'citizenship application'), ('Personal', 'naturalization application'), ('Country modifiers', 'US immigration services'),
        ('Country modifiers', 'UK immigration services'), ('Country modifiers', 'USA visa services'), ('Country modifiers', 'UK visa services'),
        ('Geo modifiers', 'visa services near me'), ('Geo modifiers', 'immigration services near me'), ('Geo modifiers', 'visa consultant near me'),
        ('Geo modifiers', 'immigration lawyer near me'),
    ]
    return [[cat, kw, 'public search seed'] for cat, kw in pairs]


def plan_rows(us_places_count, us_zcta_count, uk_count, kw_count):
    return [
        ['Step', 'Purpose', 'Source / Output', 'Status'],
        ['1', 'Use verified public source lists for locations', 'US Census Gazetteer Places + ZCTAs; GOV.UK UK cities page', 'done'],
        ['2', 'Load US places into sheet', f'{us_places_count} rows from Census place file', 'done'],
        ['3', 'Load US ZIP-targeting unit into sheet', f'{us_zcta_count} rows from Census ZCTA file', 'done'],
        ['4', 'Load UK cities into sheet', f'{uk_count} rows from GOV.UK list of cities', 'done'],
        ['5', 'Load search keywords', f'{kw_count} seed phrases', 'done'],
        ['6', 'Postal-code granularity decision', 'US ZIP5 vs ZCTA and UK postcode area/district/unit must be confirmed before adding the UK postal rows', 'open'],
        ['7', 'Review and filter leads', 'Use city + keyword combinations for compliant search and outreach', 'next'],
    ]


def postal_scope_rows():
    return [
        ['Country', 'Granularity', 'What it means', 'Status', 'Source'],
        ['US', 'ZCTA', 'ZIP Code Tabulation Area; Census approximation of ZIP territory', 'loaded', US_ZCTA_URL],
        ['US', 'ZIP5', 'USPS ZIP Code', 'not loaded', 'Would need a USPS-derived or licensed source'],
        ['UK', 'postcode area', 'Outward postcode area (e.g. SW, M, B)', 'not loaded', 'Need source selection'],
        ['UK', 'postcode district', 'Outward postcode district (e.g. SW1A, M1)', 'not loaded', 'Need source selection'],
        ['UK', 'postcode unit', 'Full postcode unit', 'not loaded', 'Need source selection'],
    ]


def main():
    us_places = parse_us_places()
    us_zctas = parse_us_zctas()
    uk_cities = parse_uk_cities()
    keywords = keyword_rows()

    print(f'US places: {len(us_places)}')
    print(f'US ZCTAs: {len(us_zctas)}')
    print(f'UK cities: {len(uk_cities)}')
    print(f'Keywords: {len(keywords)}')

    sheets = build_svc('sheets', 'v4')
    drive = build_svc('drive', 'v3')

    meta = sheets.spreadsheets().create(body={'properties': {'title': SPREADSHEET_TITLE}}).execute()
    spreadsheet_id = meta['spreadsheetId']
    print('Spreadsheet ID:', spreadsheet_id)

    # move to desired folder
    file_meta = drive.files().get(fileId=spreadsheet_id, fields='parents').execute()
    parents = ','.join(file_meta.get('parents', []))
    drive.files().update(fileId=spreadsheet_id, addParents=FOLDER_ID, removeParents=parents, fields='id, parents').execute()

    # rename default sheet and add others
    current = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    default_id = current['sheets'][0]['properties']['sheetId']
    batch = {'requests': [
        {'updateSheetProperties': {'properties': {'sheetId': default_id, 'title': 'Plan'}, 'fields': 'title'}},
        {'addSheet': {'properties': {'title': 'US_Places'}}},
        {'addSheet': {'properties': {'title': 'US_ZCTAs'}}},
        {'addSheet': {'properties': {'title': 'UK_Cities'}}},
        {'addSheet': {'properties': {'title': 'Keywords'}}},
        {'addSheet': {'properties': {'title': 'Postal_Scope'}}},
    ]}
    sheets.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body=batch).execute()

    # Expand sheet grids so large value writes won't exceed row limits
    meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    title_to_id = {s['properties']['title']: s['properties']['sheetId'] for s in meta['sheets']}
    resize_requests = [
        {'updateSheetProperties': {'properties': {'sheetId': title_to_id['Plan'], 'gridProperties': {'rowCount': 50, 'columnCount': 8}}, 'fields': 'gridProperties(rowCount,columnCount)'}},
        {'updateSheetProperties': {'properties': {'sheetId': title_to_id['US_Places'], 'gridProperties': {'rowCount': 40000, 'columnCount': 10}}, 'fields': 'gridProperties(rowCount,columnCount)'}},
        {'updateSheetProperties': {'properties': {'sheetId': title_to_id['US_ZCTAs'], 'gridProperties': {'rowCount': 40000, 'columnCount': 6}}, 'fields': 'gridProperties(rowCount,columnCount)'}},
        {'updateSheetProperties': {'properties': {'sheetId': title_to_id['UK_Cities'], 'gridProperties': {'rowCount': 200, 'columnCount': 5}}, 'fields': 'gridProperties(rowCount,columnCount)'}},
        {'updateSheetProperties': {'properties': {'sheetId': title_to_id['Keywords'], 'gridProperties': {'rowCount': 200, 'columnCount': 3}}, 'fields': 'gridProperties(rowCount,columnCount)'}},
        {'updateSheetProperties': {'properties': {'sheetId': title_to_id['Postal_Scope'], 'gridProperties': {'rowCount': 50, 'columnCount': 5}}, 'fields': 'gridProperties(rowCount,columnCount)'}},
    ]
    sheets.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={'requests': resize_requests}).execute()

    # write data
    write_block(sheets, spreadsheet_id, 'Plan', 1, plan_rows(len(us_places), len(us_zctas), len(uk_cities), len(keywords)))
    write_block(sheets, spreadsheet_id, 'US_Places', 1, [['USPS', 'GEOID', 'ANSICODE', 'NAME', 'PlaceType', 'FUNCSTAT', 'ALAND_SQMI', 'AWATER_SQMI', 'INTPTLAT', 'INTPTLONG']])
    for i, chunk in enumerate(chunked(us_places, 5000), start=0):
        write_block(sheets, spreadsheet_id, 'US_Places', 2 + i * 5000, chunk)
        print(f'Wrote US_Places chunk {i+1}')

    write_block(sheets, spreadsheet_id, 'US_ZCTAs', 1, [['ZCTA5', 'GEOID', 'ALAND_SQMI', 'AWATER_SQMI', 'INTPTLAT', 'INTPTLONG']])
    for i, chunk in enumerate(chunked(us_zctas, 5000), start=0):
        write_block(sheets, spreadsheet_id, 'US_ZCTAs', 2 + i * 5000, chunk)
        print(f'Wrote US_ZCTAs chunk {i+1}')

    write_block(sheets, spreadsheet_id, 'UK_Cities', 1, [['Country', 'Region', 'City', 'OfficialCityStatus', 'Source']])
    write_block(sheets, spreadsheet_id, 'UK_Cities', 2, uk_cities)

    write_block(sheets, spreadsheet_id, 'Keywords', 1, [['Category', 'Keyword', 'SourceType']])
    write_block(sheets, spreadsheet_id, 'Keywords', 2, keywords)

    write_block(sheets, spreadsheet_id, 'Postal_Scope', 1, postal_scope_rows())

    url = f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit'
    print(json.dumps({'spreadsheetId': spreadsheet_id, 'spreadsheetUrl': url}, indent=2))


if __name__ == '__main__':
    main()
