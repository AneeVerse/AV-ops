from __future__ import annotations
import os
import tempfile
import unittest
from unittest.mock import patch

# Env must be set before importing app modules.
tmp = tempfile.TemporaryDirectory()
os.environ["TRAITDNA_DB_PATH"] = os.path.join(tmp.name, "test.sqlite3")

from app.db import init_db, connect
from app.sync_sheet import rows_from_values, sync_rows
import app.sync_sheet as sync_sheet
from app.workflow import (
    dashboard,
    set_video_status,
    create_dry_run_generation,
    approve_version,
    reject_version,
    queue_regeneration,
    get_video,
)


SHEET_VALUES = [[
    "Video_ID", "Short_URL", "Hook_Text", "Insight_Text", "Implication_Text", "CTA_Text", "CTA Sub Text ", "Production_Status"
], [
    "V0001", "https://x/v1", "Hook 1", "Insight 1", "Imp 1", "CTA 1", "Sub 1", "Ready"
], [
    "V0002", "https://x/v2", "Hook 2", "Insight 2", "Imp 2", "CTA 2", "Sub 2", "Ready"
], [
    "V0003", "https://x/v3", "Hook 3", "Insight 3", "Imp 3", "CTA 3", "Sub 3", "Not Started"
]]


class MVP1CoreTest(unittest.TestCase):
    def _clear(self):
        with connect() as conn:
            conn.execute("UPDATE videos SET current_final_version_id=NULL, latest_version_id=NULL")
            conn.execute("DELETE FROM render_assets")
            conn.execute("DELETE FROM render_jobs")
            conn.execute("DELETE FROM video_versions")
            conn.execute("DELETE FROM videos")
            conn.commit()

    def setUp(self):
        init_db()
        self._clear()
        _, rows = rows_from_values(SHEET_VALUES)
        sync_rows(rows)

    def tearDown(self):
        self._clear()

    def test_next_ready(self):
        d = dashboard()
        self.assertEqual(d["next_ready"]["video_id"], "V0001")
        self.assertEqual(d["recommended"]["video_id"], "V0001")

    def test_dry_generate_approve_tracks_done(self):
        v = create_dry_run_generation("V0001", reason="test render")
        self.assertEqual(v["production_status"], "Needs Review")
        version_id = v["versions"][0]["id"]
        v = approve_version("V0001", version_id, notes="looks good")
        self.assertEqual(v["production_status"], "Approved")
        self.assertEqual(v["current_final_version_id"], version_id)
        self.assertEqual(v["versions"][0]["is_current_final"], 1)
        d = dashboard()
        self.assertEqual(d["next_ready"]["video_id"], "V0002")

    def test_reject_then_queue_regeneration_preserves_history(self):
        v = create_dry_run_generation("V0001")
        v1 = v["versions"][0]["id"]
        v = reject_version("V0001", v1, reason="bad visual")
        self.assertEqual(v["production_status"], "Rejected")
        self.assertEqual(v["versions"][0]["status"], "Rejected")
        v = queue_regeneration("V0001", "regenerate_section_1", reason="bad section 1")
        self.assertEqual(v["production_status"], "Regeneration Queued")
        self.assertEqual(len(v["versions"]), 1)
        self.assertEqual(v["versions"][0]["id"], v1)
        self.assertEqual(v["jobs"][0]["job_type"], "regenerate_section_1")

    def test_duplicate_active_regeneration_job_is_blocked(self):
        queue_regeneration("V0001", "regenerate_section_1", reason="first")
        with self.assertRaises(ValueError):
            queue_regeneration("V0001", "full_render", reason="duplicate")

    def test_sync_does_not_downgrade_after_version_exists(self):
        v = create_dry_run_generation("V0001")
        version_id = v["versions"][0]["id"]
        approve_version("V0001", version_id)
        changed = [row[:] for row in SHEET_VALUES]
        changed[1][-1] = "In Progress"
        _, rows = rows_from_values(changed)
        sync_rows(rows)
        v = get_video("V0001")
        self.assertEqual(v["production_status"], "Approved")

    def test_manual_status_sets_next_video(self):
        set_video_status("V0003", "Ready")
        d = dashboard()
        self.assertEqual(d["next_ready"]["video_id"], "V0001")

    def test_cta_sub_text_header_without_trailing_space_is_supported(self):
        values = [[
            "Video_ID", "Short_URL", "Hook_Text", "Insight_Text", "Implication_Text", "CTA_Text", "CTA Sub Text", "Production_Status"
        ], [
            "V0099", "https://x/v99", "Hook 99", "Insight 99", "Imp 99", "CTA 99", "Sub 99", "Generated"
        ]]
        _, rows = rows_from_values(values)
        sync_rows(rows)
        v = get_video("V0099")
        self.assertEqual(v["cta_sub_text"], "Sub 99")
        self.assertEqual(v["production_status"], "Needs Review")

    def test_fetch_sheet_values_passes_gog_account(self):
        calls = []

        class Result:
            returncode = 0
            stdout = '{"values": [["Video_ID"]]}'
            stderr = ""

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            return Result()

        with patch.object(sync_sheet.subprocess, "run", fake_run):
            values = sync_sheet.fetch_sheet_values("Tab!A1:A1")

        self.assertEqual(values, [["Video_ID"]])
        self.assertIn("--account", calls[0])
        self.assertIn("anees@aneeverse.com", calls[0])


if __name__ == "__main__":
    unittest.main()
