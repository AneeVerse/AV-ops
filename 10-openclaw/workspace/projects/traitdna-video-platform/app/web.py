from __future__ import annotations
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
import html
import json

from .sync_sheet import sync_from_sheet
from .workflow import (
    dashboard,
    list_videos,
    get_video,
    create_dry_run_generation,
    approve_version,
    reject_version,
    queue_regeneration,
    set_video_status,
)

import os

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8787"))


def esc(x) -> str:
    return html.escape("" if x is None else str(x))


def layout(title: str, body: str) -> bytes:
    return f"""<!doctype html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>{esc(title)}</title>
  <style>
    body {{ font-family: Inter, Arial, sans-serif; margin: 0; background: #f7f7fb; color: #16161d; }}
    header {{ background: #111827; color: white; padding: 16px 24px; }}
    header a {{ color: white; margin-right: 18px; text-decoration: none; }}
    main {{ padding: 24px; max-width: 1200px; margin: 0 auto; }}
    .cards {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 12px; margin: 16px 0; }}
    .card {{ background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; box-shadow: 0 1px 2px #0001; }}
    .big {{ font-size: 28px; font-weight: 800; }}
    table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; }}
    th, td {{ border-bottom: 1px solid #eee; padding: 10px; text-align: left; vertical-align: top; }}
    th {{ background: #f0f2f7; font-size: 13px; }}
    .pill {{ padding: 3px 8px; border-radius: 999px; font-size: 12px; background: #e5e7eb; display: inline-block; }}
    .Approved {{ background: #dcfce7; color: #166534; }}
    .Failed, .Rejected {{ background: #fee2e2; color: #991b1b; }}
    .NeedsReview, .Needs-Review {{ background: #fef3c7; color: #92400e; }}
    .Ready {{ background: #dbeafe; color: #1e40af; }}
    button, .btn {{ background: #2563eb; color: white; border: 0; padding: 8px 10px; border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-block; margin: 2px; }}
    .danger {{ background: #dc2626; }} .secondary {{ background: #4b5563; }} .success {{ background: #16a34a; }}
    input, select, textarea {{ padding: 8px; border: 1px solid #d1d5db; border-radius: 8px; }}
    textarea {{ width: 100%; min-height: 60px; }}
    .muted {{ color: #6b7280; }}
    .grid2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
    pre {{ white-space: pre-wrap; background: #111827; color: #d1fae5; padding: 12px; border-radius: 10px; }}
  </style>
</head>
<body>
<header>
  <strong>TraitDNA Video Platform MVP1</strong>
  <nav style='display:inline;margin-left:20px'>
    <a href='/'>Dashboard</a>
    <a href='/videos'>Queue</a>
    <a href='/jobs'>Jobs</a>
  </nav>
</header>
<main>{body}</main>
</body>
</html>""".encode()


def status_pill(status: str) -> str:
    cls = status.replace(" ", "-")
    return f"<span class='pill {esc(cls)}'>{esc(status)}</span>"


def dashboard_page(query: dict[str, list[str]] | None = None) -> bytes:
    query = query or {}
    d = dashboard()
    counts = d["counts"]
    statuses = ["Ready", "Queued", "In Progress", "Needs Review", "Approved", "Rejected", "Regeneration Queued", "Regenerating", "Failed", "Not Started"]
    cards = "".join(f"<div class='card'><div class='muted'>{esc(s)}</div><div class='big'>{counts.get(s,0)}</div></div>" for s in statuses)
    rec = d.get("recommended")
    next_failed = d.get("next_failed")
    next_review = d.get("next_review")
    next_rejected = d.get("next_rejected")
    next_ready = d.get("next_ready")
    notice = ""
    if query.get("synced"):
        inserted = query.get("inserted", ["0"])[0]
        updated = query.get("updated", ["0"])[0]
        total = query.get("total", ["0"])[0]
        notice = f"<div class='card' style='border-color:#86efac;background:#f0fdf4;color:#166534'><strong>Sheet synced.</strong> {esc(total)} rows processed, {esc(inserted)} inserted, {esc(updated)} updated.</div>"
    body = f"""
<h1>Dashboard</h1>
<p class='muted'>Public MVP1 dashboard. Dry-run only: no AI credits are spent from this UI.</p>
{notice}
<form method='post' action='/action'><input type='hidden' name='action' value='sync'><button>Sync Sheet</button></form>
<div class='cards'>{cards}</div>
<div class='grid2'>
  <div class='card'><h3>Recommended Next Action</h3>{video_short(rec) if rec else '<p class=muted>No action found. Mark rows Ready or sync Sheet.</p>'}</div>
  <div class='card'><h3>Next Review</h3>{video_short(next_review) if next_review else '<p class=muted>No Needs Review video found.</p>'}</div>
  <div class='card'><h3>Next Failed</h3>{video_short(next_failed) if next_failed else '<p class=muted>No Failed video found.</p>'}</div>
  <div class='card'><h3>Next Regeneration</h3>{video_short(next_rejected) if next_rejected else '<p class=muted>No Rejected / Regeneration Queued video found.</p>'}</div>
  <div class='card'><h3>Next New Video</h3>{video_short(next_ready) if next_ready else '<p class=muted>No Ready video found.</p>'}</div>
</div>
"""
    return layout("Dashboard", body)


def video_short(v: dict | None) -> str:
    if not v:
        return ""
    return f"<p><strong>{esc(v['video_id'])}</strong> {status_pill(v['production_status'])}</p><p>{esc(v.get('hook_text','')[:140])}</p><a class='btn' href='/video?id={esc(v['video_id'])}'>Open</a>"


def videos_page(query: dict[str, list[str]]) -> bytes:
    status = query.get("status", [None])[0]
    videos = list_videos(status=status, limit=500)
    filter_links = ["All", "Ready", "Needs Review", "Approved", "Rejected", "Failed", "In Progress", "Not Started"]
    links = " ".join(f"<a class='btn secondary' href='/videos{'' if s=='All' else '?status='+esc(s)}'>{esc(s)}</a>" for s in filter_links)
    rows = []
    for v in videos:
        rows.append(f"""
<tr>
<td><a href='/video?id={esc(v['video_id'])}'>{esc(v['video_id'])}</a></td>
<td>{status_pill(v['production_status'])}</td>
<td>{esc(v.get('hook_text','')[:100])}</td>
<td>{'<a href="'+esc(v['output_drive_link'])+'" target="_blank">Open</a>' if v.get('output_drive_link') else '<span class=muted>None</span>'}</td>
<td><a class='btn' href='/video?id={esc(v['video_id'])}'>View</a></td>
</tr>""")
    body = f"""
<h1>Video Queue</h1>
<p>{links}</p>
<table><thead><tr><th>Video ID</th><th>Status</th><th>Hook</th><th>Output</th><th>Actions</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
"""
    return layout("Queue", body)


def video_page(query: dict[str, list[str]]) -> bytes:
    video_id = query.get("id", [""])[0]
    v = get_video(video_id)
    if not v:
        return layout("Not found", "<h1>Video not found</h1>")
    versions = v.get("versions", [])
    jobs = v.get("jobs", [])
    latest = versions[0] if versions else None
    version_rows = "".join(f"""
<tr><td>v{vv['version_number']}</td><td>{status_pill(vv['status'])}</td><td>{esc(vv['render_type'])}</td><td>{esc(vv.get('review_notes') or '')}{' / Rejected: '+esc(vv.get('rejection_reason')) if vv.get('rejection_reason') else ''}</td><td>{'YES' if vv['is_current_final'] else ''}</td></tr>
""" for vv in versions)
    job_rows = "".join(f"<tr><td>{j['id']}</td><td>{esc(j['job_type'])}</td><td>{esc(j['status'])}</td><td>{esc(j.get('reason') or '')}</td></tr>" for j in jobs)
    approve_reject = ""
    if latest:
        approve_reject = f"""
<form method='post' action='/action' style='display:inline'><input type='hidden' name='action' value='approve'><input type='hidden' name='video_id' value='{esc(v['video_id'])}'><input type='hidden' name='version_id' value='{latest['id']}'><button class='success'>Approve latest v{latest['version_number']}</button></form>
<form method='post' action='/action'><input type='hidden' name='action' value='reject'><input type='hidden' name='video_id' value='{esc(v['video_id'])}'><input type='hidden' name='version_id' value='{latest['id']}'><textarea name='reason' placeholder='Reason for rejection'></textarea><button class='danger'>Reject latest</button></form>
"""
    body = f"""
<h1>{esc(v['video_id'])} {status_pill(v['production_status'])}</h1>
<div class='grid2'>
  <div class='card'><h3>Content</h3><p><b>Hook:</b> {esc(v['hook_text'])}</p><p><b>Insight:</b> {esc(v['insight_text'])}</p><p><b>Implication:</b> {esc(v['implication_text'])}</p><p><b>CTA:</b> {esc(v['cta_text'])}</p><p><b>CTA Sub:</b> {esc(v['cta_sub_text'])}</p></div>
  <div class='card'><h3>Actions</h3>
    <form method='post' action='/action' style='display:inline'><input type='hidden' name='action' value='dry_generate'><input type='hidden' name='video_id' value='{esc(v['video_id'])}'><button>Dry-run Generate</button></form>
    {approve_reject}
    <h4>Queue Regeneration</h4>
    <form method='post' action='/action'>
      <input type='hidden' name='action' value='queue_regen'><input type='hidden' name='video_id' value='{esc(v['video_id'])}'>
      <select name='job_type'><option>full_render</option><option>regenerate_section_1</option><option>regenerate_section_3</option><option>reassemble_only</option><option>audio_remix_only</option></select>
      <textarea name='reason' placeholder='Why regenerate?'></textarea><button>Queue Regeneration</button>
    </form>
    <h4>Manual Status</h4>
    <form method='post' action='/action'><input type='hidden' name='action' value='set_status'><input type='hidden' name='video_id' value='{esc(v['video_id'])}'><select name='status'><option>Ready</option><option>Not Started</option><option>Failed</option></select><button class='secondary'>Set</button></form>
  </div>
</div>
<h2>Versions</h2><table><thead><tr><th>Version</th><th>Status</th><th>Type</th><th>Notes</th><th>Current Final</th></tr></thead><tbody>{version_rows or '<tr><td colspan=5 class=muted>No versions yet.</td></tr>'}</tbody></table>
<h2>Jobs</h2><table><thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Reason</th></tr></thead><tbody>{job_rows or '<tr><td colspan=4 class=muted>No jobs yet.</td></tr>'}</tbody></table>
"""
    return layout(v["video_id"], body)


def jobs_page() -> bytes:
    from .db import connect, many
    with connect() as conn:
        jobs = many(conn, "SELECT * FROM render_jobs ORDER BY id DESC LIMIT 100")
    rows = "".join(f"<tr><td>{j['id']}</td><td><a href='/video?id={esc(j['video_id'])}'>{esc(j['video_id'])}</a></td><td>{esc(j['job_type'])}</td><td>{esc(j['status'])}</td><td>{esc(j.get('reason') or '')}</td></tr>" for j in jobs)
    return layout("Jobs", f"<h1>Jobs</h1><table><tr><th>ID</th><th>Video</th><th>Type</th><th>Status</th><th>Reason</th></tr>{rows}</table>")


class Handler(BaseHTTPRequestHandler):
    def send_html(self, content: bytes, code: int = 200, include_body: bool = True):
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if include_body:
            self.wfile.write(content)

    def send_plain(self, content: bytes, code: int = 200, include_body: bool = True):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if include_body:
            self.wfile.write(content)

    def render_get(self, path: str, query: dict[str, list[str]]) -> tuple[bytes, int, str]:
        if path == "/":
            return dashboard_page(query), 200, "text/html"
        if path == "/videos":
            return videos_page(query), 200, "text/html"
        if path == "/video":
            return video_page(query), 200, "text/html"
        if path == "/jobs":
            return jobs_page(), 200, "text/html"
        if path == "/health":
            return b"OK", 200, "text/plain"
        return layout("404", "<h1>404</h1>"), 404, "text/html"

    def do_GET(self):
        parsed = urlparse(self.path)
        q = parse_qs(parsed.query)
        content, code, content_type = self.render_get(parsed.path, q)
        if content_type == "text/plain":
            self.send_plain(content, code)
        else:
            self.send_html(content, code)

    def do_HEAD(self):
        parsed = urlparse(self.path)
        q = parse_qs(parsed.query)
        content, code, content_type = self.render_get(parsed.path, q)
        if content_type == "text/plain":
            self.send_plain(content, code, include_body=False)
        else:
            self.send_html(content, code, include_body=False)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode()
        form = {k: v[0] for k, v in parse_qs(body).items()}
        action = form.get("action")
        try:
            if action == "sync":
                result = sync_from_sheet()
                target = f"/?synced=1&inserted={result['inserted']}&updated={result['updated']}&total={result['total']}"
            elif action == "dry_generate":
                create_dry_run_generation(form["video_id"], reason="UI dry-run generate")
                target = f"/video?id={form['video_id']}"
            elif action == "approve":
                approve_version(form["video_id"], int(form["version_id"]), notes="Approved from UI")
                target = f"/video?id={form['video_id']}"
            elif action == "reject":
                reject_version(form["video_id"], int(form["version_id"]), reason=form.get("reason", ""))
                target = f"/video?id={form['video_id']}"
            elif action == "queue_regen":
                queue_regeneration(form["video_id"], form["job_type"], reason=form.get("reason", ""))
                target = f"/video?id={form['video_id']}"
            elif action == "set_status":
                set_video_status(form["video_id"], form["status"])
                target = f"/video?id={form['video_id']}"
            else:
                raise ValueError(f"Unknown action: {action}")
            self.send_response(303)
            self.send_header("Location", target)
            self.end_headers()
        except Exception as e:
            self.send_html(layout("Error", f"<h1>Error</h1><pre>{esc(e)}</pre><p><a href='/'>Dashboard</a></p>"), 500)


def run(host: str = HOST, port: int = PORT):
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"TraitDNA MVP1 UI running on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    run()
