from __future__ import annotations
import sqlite3
from pathlib import Path
from typing import Any, Iterable
from .config import DB_PATH, DATA_DIR

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS videos (
  video_id TEXT PRIMARY KEY,
  sheet_row_number INTEGER,
  short_url TEXT,
  hook_text TEXT,
  insight_text TEXT,
  implication_text TEXT,
  cta_text TEXT,
  cta_sub_text TEXT,
  production_status TEXT NOT NULL DEFAULT 'Not Started',
  current_final_version_id INTEGER,
  latest_version_id INTEGER,
  output_drive_file_id TEXT,
  output_drive_link TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  FOREIGN KEY(current_final_version_id) REFERENCES video_versions(id),
  FOREIGN KEY(latest_version_id) REFERENCES video_versions(id)
);

CREATE TABLE IF NOT EXISTS video_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  render_type TEXT NOT NULL,
  drive_file_id TEXT,
  drive_link TEXT,
  template_version TEXT,
  voice_used TEXT,
  music_used TEXT,
  review_notes TEXT,
  rejection_reason TEXT,
  is_current_final INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, version_number),
  FOREIGN KEY(video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS render_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  version_id INTEGER,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(video_id) REFERENCES videos(video_id) ON DELETE CASCADE,
  FOREIGN KEY(version_id) REFERENCES video_versions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS render_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  version_id INTEGER,
  asset_type TEXT NOT NULL,
  local_path TEXT,
  drive_file_id TEXT,
  provider TEXT,
  provider_job_id TEXT,
  duration REAL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(video_id) REFERENCES videos(video_id) ON DELETE CASCADE,
  FOREIGN KEY(version_id) REFERENCES video_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(production_status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON render_jobs(status);
CREATE INDEX IF NOT EXISTS idx_versions_video ON video_versions(video_id, version_number);
"""


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection | None = None) -> None:
    close = conn is None
    conn = conn or connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        if close:
            conn.close()


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


def one(conn: sqlite3.Connection, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    row = conn.execute(sql, params).fetchone()
    return dict(row) if row else None


def many(conn: sqlite3.Connection, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    return rows_to_dicts(conn.execute(sql, params).fetchall())
