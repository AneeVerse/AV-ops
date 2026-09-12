from __future__ import annotations
from pathlib import Path
import os

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = Path(os.environ.get("TRAITDNA_DB_PATH", DATA_DIR / "traitdna_platform.sqlite3"))

SHEET_ID = "1MMslDeXLGBKG6tjPao1_pRIGzaRTOlubwn5UJssB8xE"
SHEET_TAB = "300_Video_Master_Attribution"
SHEET_RANGE = f"{SHEET_TAB}!A1:AF"
GOG_ACCOUNT = os.environ.get("GOG_ACCOUNT", "anees@aneeverse.com")
DRIVE_GEN_FOLDER_ID = "1ICdGOWUiR3905Vuef-pqbXJ0fvg8paND"

VALID_STATUSES = {
    "Not Started",
    "Ready",
    "Queued",
    "In Progress",
    "Needs Review",
    "Approved",
    "Rejected",
    "Regeneration Queued",
    "Regenerating",
    "Failed",
}

DEFAULT_STATUS = "Not Started"
TEMPLATE_VERSION = "traitdna_batchflow_mvp1_dryrun"
