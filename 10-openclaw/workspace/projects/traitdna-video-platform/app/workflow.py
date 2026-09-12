from __future__ import annotations
import sqlite3
from typing import Any
from .config import TEMPLATE_VERSION
from .db import connect, init_db, many, one

ACTIVE_JOB_STATUSES = {"queued", "validating", "generating", "in_progress", "regenerating"}
REGEN_JOB_TYPES = {"full_render", "regenerate_section_1", "regenerate_section_3", "reassemble_only", "audio_remix_only"}


def dashboard() -> dict[str, Any]:
    init_db()
    with connect() as conn:
        counts = {r["production_status"]: r["count"] for r in conn.execute(
            "SELECT production_status, COUNT(*) count FROM videos GROUP BY production_status"
        )}
        next_failed = one(conn, "SELECT * FROM videos WHERE production_status='Failed' ORDER BY video_id LIMIT 1")
        next_review = one(conn, "SELECT * FROM videos WHERE production_status='Needs Review' ORDER BY video_id LIMIT 1")
        next_rejected = one(conn, "SELECT * FROM videos WHERE production_status IN ('Rejected','Regeneration Queued') ORDER BY video_id LIMIT 1")
        next_ready = one(conn, """
            SELECT v.* FROM videos v
            WHERE v.production_status='Ready'
              AND NOT EXISTS (
                SELECT 1 FROM video_versions vv
                WHERE vv.video_id=v.video_id AND vv.status='Approved' AND vv.is_current_final=1
              )
            ORDER BY v.video_id LIMIT 1
        """)
        recommended = next_failed or next_review or next_rejected or next_ready
        return {
            "counts": counts,
            "next_failed": next_failed,
            "next_review": next_review,
            "next_rejected": next_rejected,
            "next_ready": next_ready,
            "recommended": recommended,
        }


def list_videos(status: str | None = None, limit: int = 300) -> list[dict[str, Any]]:
    init_db()
    with connect() as conn:
        if status:
            return many(conn, "SELECT * FROM videos WHERE production_status=? ORDER BY video_id LIMIT ?", (status, limit))
        return many(conn, "SELECT * FROM videos ORDER BY video_id LIMIT ?", (limit,))


def get_video(video_id: str) -> dict[str, Any] | None:
    init_db()
    with connect() as conn:
        video = one(conn, "SELECT * FROM videos WHERE video_id=?", (video_id,))
        if not video:
            return None
        video["versions"] = many(conn, "SELECT * FROM video_versions WHERE video_id=? ORDER BY version_number DESC", (video_id,))
        video["jobs"] = many(conn, "SELECT * FROM render_jobs WHERE video_id=? ORDER BY id DESC LIMIT 20", (video_id,))
        return video


def _active_job_exists(conn: sqlite3.Connection, video_id: str) -> bool:
    q = ",".join("?" for _ in ACTIVE_JOB_STATUSES)
    row = conn.execute(f"SELECT id FROM render_jobs WHERE video_id=? AND status IN ({q}) LIMIT 1", (video_id, *ACTIVE_JOB_STATUSES)).fetchone()
    return row is not None


def _next_version_number(conn: sqlite3.Connection, video_id: str) -> int:
    row = conn.execute("SELECT COALESCE(MAX(version_number),0)+1 n FROM video_versions WHERE video_id=?", (video_id,)).fetchone()
    return int(row["n"])


def create_dry_run_generation(video_id: str, job_type: str = "full_render", reason: str = "") -> dict[str, Any]:
    """MVP1 dry-run: create a completed job and Needs Review version without calling AI APIs."""
    if job_type not in REGEN_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")
    init_db()
    with connect() as conn:
        video = conn.execute("SELECT * FROM videos WHERE video_id=?", (video_id,)).fetchone()
        if not video:
            raise ValueError(f"Unknown video_id: {video_id}")
        if _active_job_exists(conn, video_id):
            raise ValueError(f"Active job already exists for {video_id}")
        version_number = _next_version_number(conn, video_id)
        cur = conn.execute(
            """
            INSERT INTO video_versions (
              video_id, version_number, status, render_type, template_version, review_notes
            ) VALUES (?, ?, 'Needs Review', ?, ?, ?)
            """,
            (video_id, version_number, job_type, TEMPLATE_VERSION, reason),
        )
        version_id = cur.lastrowid
        conn.execute(
            """
            INSERT INTO render_jobs (video_id, version_id, job_type, status, reason, started_at, completed_at)
            VALUES (?, ?, ?, 'completed_dry_run', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (video_id, version_id, job_type, reason),
        )
        conn.execute(
            "UPDATE videos SET production_status='Needs Review', latest_version_id=?, updated_at=CURRENT_TIMESTAMP WHERE video_id=?",
            (version_id, video_id),
        )
        conn.commit()
        return get_video(video_id) or {}


def approve_version(video_id: str, version_id: int, notes: str = "") -> dict[str, Any]:
    init_db()
    with connect() as conn:
        version = conn.execute("SELECT * FROM video_versions WHERE id=? AND video_id=?", (version_id, video_id)).fetchone()
        if not version:
            raise ValueError("Version not found")
        conn.execute("UPDATE video_versions SET is_current_final=0 WHERE video_id=?", (video_id,))
        conn.execute(
            "UPDATE video_versions SET status='Approved', is_current_final=1, review_notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (notes, version_id),
        )
        conn.execute(
            """
            UPDATE videos SET production_status='Approved', current_final_version_id=?, latest_version_id=?,
              approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
            WHERE video_id=?
            """,
            (version_id, version_id, video_id),
        )
        conn.commit()
        return get_video(video_id) or {}


def reject_version(video_id: str, version_id: int, reason: str = "") -> dict[str, Any]:
    init_db()
    with connect() as conn:
        version = conn.execute("SELECT * FROM video_versions WHERE id=? AND video_id=?", (version_id, video_id)).fetchone()
        if not version:
            raise ValueError("Version not found")
        conn.execute(
            "UPDATE video_versions SET status='Rejected', rejection_reason=?, is_current_final=0, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (reason, version_id),
        )
        conn.execute(
            "UPDATE videos SET production_status='Rejected', latest_version_id=?, updated_at=CURRENT_TIMESTAMP WHERE video_id=?",
            (version_id, video_id),
        )
        conn.commit()
        return get_video(video_id) or {}


def set_video_status(video_id: str, status: str) -> dict[str, Any]:
    allowed = {"Not Started", "Ready", "Queued", "In Progress", "Needs Review", "Approved", "Rejected", "Regeneration Queued", "Regenerating", "Failed"}
    if status not in allowed:
        raise ValueError(f"Unsupported status: {status}")
    init_db()
    with connect() as conn:
        row = conn.execute("SELECT video_id FROM videos WHERE video_id=?", (video_id,)).fetchone()
        if not row:
            raise ValueError(f"Unknown video_id: {video_id}")
        conn.execute("UPDATE videos SET production_status=?, updated_at=CURRENT_TIMESTAMP WHERE video_id=?", (status, video_id))
        conn.commit()
    return get_video(video_id) or {}


def queue_regeneration(video_id: str, job_type: str, reason: str = "") -> dict[str, Any]:
    if job_type not in REGEN_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")
    init_db()
    with connect() as conn:
        if _active_job_exists(conn, video_id):
            raise ValueError(f"Active job already exists for {video_id}")
        video = conn.execute("SELECT * FROM videos WHERE video_id=?", (video_id,)).fetchone()
        if not video:
            raise ValueError(f"Unknown video_id: {video_id}")
        cur = conn.execute(
            "INSERT INTO render_jobs (video_id, job_type, status, reason) VALUES (?, ?, 'queued', ?)",
            (video_id, job_type, reason),
        )
        conn.execute("UPDATE videos SET production_status='Regeneration Queued', updated_at=CURRENT_TIMESTAMP WHERE video_id=?", (video_id,))
        conn.commit()
        result = get_video(video_id) or {}
        result["queued_job_id"] = cur.lastrowid
        return result
