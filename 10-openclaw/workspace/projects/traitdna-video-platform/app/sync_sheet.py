from __future__ import annotations
import json
import subprocess
from typing import Any
from .config import GOG_ACCOUNT, SHEET_ID, SHEET_RANGE, DEFAULT_STATUS, VALID_STATUSES
from .db import connect, init_db

REQUIRED_HEADERS = [
    "Video_ID",
    "Hook_Text",
    "Insight_Text",
    "Implication_Text",
    "CTA_Text",
    "Production_Status",
]


def normalize_status(value: str | None) -> str:
    value = (value or "").strip()
    if not value:
        return DEFAULT_STATUS
    aliases = {
        "Generated": "Needs Review",  # generated is not done until approved
        "Done": "Approved",
        "InProgress": "In Progress",
        "RegenerationQueued": "Regeneration Queued",
    }
    value = aliases.get(value, value)
    if value not in VALID_STATUSES:
        # Keep bad statuses visible but safe by marking Not Started and preserving issue in last_error.
        return DEFAULT_STATUS
    return value


def fetch_sheet_values(limit_range: str | None = None) -> list[list[str]]:
    rng = limit_range or SHEET_RANGE
    cmd = ["gog", "sheets", "get", SHEET_ID, rng, "--json", "--no-input"]
    if GOG_ACCOUNT:
        cmd.extend(["--account", GOG_ACCOUNT])
    result = subprocess.run(cmd, text=True, capture_output=True)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Unknown gog error").strip()
        raise RuntimeError(f"Google Sheet sync failed via gog: {detail}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Google Sheet sync returned invalid JSON: {e}: {result.stdout[:500]}") from e
    return data.get("values", [])


def rows_from_values(values: list[list[str]]) -> tuple[list[str], list[dict[str, Any]]]:
    if not values:
        raise ValueError("Sheet returned no values")
    headers = values[0]
    missing = [h for h in REQUIRED_HEADERS if h not in headers]
    if "CTA Sub Text " not in headers and "CTA Sub Text" not in headers:
        missing.append("CTA Sub Text")
    if missing:
        raise ValueError(f"Missing required Sheet headers: {missing}")
    rows: list[dict[str, Any]] = []
    for sheet_row_number, vals in enumerate(values[1:], start=2):
        row = {h: (vals[i] if i < len(vals) else "") for i, h in enumerate(headers)}
        video_id = (row.get("Video_ID") or "").strip()
        if not video_id:
            continue
        row["_sheet_row_number"] = sheet_row_number
        rows.append(row)
    return headers, rows


def sync_rows(rows: list[dict[str, Any]]) -> dict[str, int]:
    init_db()
    inserted = updated = 0
    with connect() as conn:
        for row in rows:
            video_id = row["Video_ID"].strip()
            status = normalize_status(row.get("Production_Status"))
            existing = conn.execute("SELECT video_id FROM videos WHERE video_id=?", (video_id,)).fetchone()
            params = {
                "video_id": video_id,
                "sheet_row_number": row.get("_sheet_row_number"),
                "short_url": row.get("Short_URL", ""),
                "hook_text": row.get("Hook_Text", ""),
                "insight_text": row.get("Insight_Text", ""),
                "implication_text": row.get("Implication_Text", ""),
                "cta_text": row.get("CTA_Text", ""),
                "cta_sub_text": row.get("CTA Sub Text ", row.get("CTA Sub Text", "")),
                "production_status": status,
            }
            if existing:
                existing_full = conn.execute(
                    "SELECT production_status, latest_version_id, current_final_version_id FROM videos WHERE video_id=?",
                    (video_id,),
                ).fetchone()
                # Once the platform has created versions/jobs, do not let a plain Sheet sync
                # accidentally downgrade review/approved/regeneration state. The worker/API
                # should explicitly update both DB and Sheet for lifecycle changes.
                if existing_full and (existing_full["latest_version_id"] or existing_full["current_final_version_id"]):
                    params["production_status"] = existing_full["production_status"]
                conn.execute(
                    """
                    UPDATE videos SET
                      sheet_row_number=:sheet_row_number,
                      short_url=:short_url,
                      hook_text=:hook_text,
                      insight_text=:insight_text,
                      implication_text=:implication_text,
                      cta_text=:cta_text,
                      cta_sub_text=:cta_sub_text,
                      production_status=:production_status,
                      updated_at=CURRENT_TIMESTAMP
                    WHERE video_id=:video_id
                    """,
                    params,
                )
                updated += 1
            else:
                conn.execute(
                    """
                    INSERT INTO videos (
                      video_id, sheet_row_number, short_url, hook_text, insight_text,
                      implication_text, cta_text, cta_sub_text, production_status
                    ) VALUES (
                      :video_id, :sheet_row_number, :short_url, :hook_text, :insight_text,
                      :implication_text, :cta_text, :cta_sub_text, :production_status
                    )
                    """,
                    params,
                )
                inserted += 1
        conn.commit()
    return {"inserted": inserted, "updated": updated, "total": len(rows)}


def sync_from_sheet(limit_range: str | None = None) -> dict[str, int]:
    values = fetch_sheet_values(limit_range)
    _, rows = rows_from_values(values)
    return sync_rows(rows)
