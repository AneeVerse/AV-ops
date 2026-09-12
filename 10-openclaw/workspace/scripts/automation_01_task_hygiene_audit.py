#!/usr/bin/env python3
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone

ROOT = "/root/.openclaw/workspace"
ENV_PATH = "/root/.env"
DB_SCRIPT = os.path.join(ROOT, "scripts", "avbot_db.py")


def load_env(path=ENV_PATH):
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k, v)


def supabase_get(table, select, extra_query=""):
    base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    query = f"select={urllib.parse.quote(select, safe=',()*') }"
    if extra_query:
        query += "&" + extra_query
    url = f"{base}/rest/v1/{table}?{query}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def normalize_text(v):
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    return str(v).strip()


def has_value(v):
    return normalize_text(v) != ""


def log_db(title, findings):
    summary = (
        f"Checked {findings['total_tasks']} tasks, found {findings['issue_count']} issues and "
        f"{findings['warning_count']} warnings."
    )
    cmd = (
        f"python3 {DB_SCRIPT} add-client-audit SYSTEM task_hygiene_audit "
        f"{json.dumps(summary)} {json.dumps(json.dumps(findings))}"
    )
    os.system(cmd)


def main():
    load_env()
    tasks = supabase_get(
        "tasks",
        "id,title,description,priority,due_date,assigned_to,request_id,status"
    )
    requests = supabase_get("requests", "id,title,client_id")
    links = supabase_get("task_request_links", "task_id,request_id")
    clients = supabase_get("clients", "id,organization,status")

    requests_by_id = {r["id"]: r for r in requests}
    clients_by_id = {c["id"]: c for c in clients}
    links_by_task = Counter(l["task_id"] for l in links if l.get("task_id"))

    issues = []
    warnings = []
    issue_counter = Counter()
    warning_counter = Counter()

    for task in tasks:
        tid = task["id"]
        title = task.get("title") or "(untitled)"
        request_id = task.get("request_id")
        request = requests_by_id.get(request_id) if request_id else None
        client = clients_by_id.get(request.get("client_id")) if request and request.get("client_id") else None

        def add_issue(code, detail):
            issue_counter[code] += 1
            issues.append({
                "task_id": tid,
                "task_title": title,
                "code": code,
                "detail": detail,
            })

        def add_warning(code, detail):
            warning_counter[code] += 1
            warnings.append({
                "task_id": tid,
                "task_title": title,
                "code": code,
                "detail": detail,
            })

        if not has_value(task.get("assigned_to")):
            add_issue("missing_assigned_to", "assigned_to is empty")
        if not has_value(task.get("description")):
            add_issue("missing_description", "description is empty")
        if not has_value(request_id):
            add_issue("missing_request_id", "request_id is empty")
        if links_by_task[tid] == 0:
            add_issue("missing_task_request_link", "no task_request_links row found")
        if request_id and not request:
            add_issue("broken_request_chain", f"request_id {request_id} does not exist")
        if request and not has_value(request.get("client_id")):
            add_issue("request_missing_client_id", f"request {request.get('title') or request_id} has no client_id")
        if request and request.get("client_id") and not client:
            add_issue("broken_client_chain", f"client_id {request.get('client_id')} does not exist")
        if not has_value(task.get("due_date")):
            add_warning("missing_due_date", "due_date is empty")
        if not has_value(task.get("priority")):
            add_warning("missing_priority", "priority is empty")

    findings = {
        "automation": "automation_01_task_hygiene_audit",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "total_tasks": len(tasks),
        "total_requests": len(requests),
        "total_clients": len(clients),
        "issue_count": len(issues),
        "warning_count": len(warnings),
        "issue_breakdown": dict(issue_counter),
        "warning_breakdown": dict(warning_counter),
        "issues": issues,
        "warnings": warnings,
    }

    if "--record-db" in sys.argv:
        log_db("Automation 1 - Daily Task Hygiene Audit", findings)

    print(json.dumps(findings, indent=2))


if __name__ == "__main__":
    main()
