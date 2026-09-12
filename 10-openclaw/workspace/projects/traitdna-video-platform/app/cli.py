from __future__ import annotations
import argparse
import json
from .db import init_db
from .sync_sheet import sync_from_sheet
from .workflow import dashboard, list_videos, get_video, create_dry_run_generation, approve_version, reject_version, queue_regeneration, set_video_status


def print_json(obj):
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser(description="TraitDNA Video Platform MVP1 CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init-db")

    s = sub.add_parser("sync-sheet")
    s.add_argument("--range", dest="range_", default=None)

    sub.add_parser("dashboard")

    lv = sub.add_parser("list")
    lv.add_argument("--status", default=None)
    lv.add_argument("--limit", type=int, default=300)

    gv = sub.add_parser("get")
    gv.add_argument("video_id")

    gen = sub.add_parser("dry-generate")
    gen.add_argument("video_id")
    gen.add_argument("--type", default="full_render")
    gen.add_argument("--reason", default="")

    appr = sub.add_parser("approve")
    appr.add_argument("video_id")
    appr.add_argument("version_id", type=int)
    appr.add_argument("--notes", default="")

    rej = sub.add_parser("reject")
    rej.add_argument("video_id")
    rej.add_argument("version_id", type=int)
    rej.add_argument("--reason", default="")

    reg = sub.add_parser("queue-regen")
    reg.add_argument("video_id")
    reg.add_argument("--type", required=True)
    reg.add_argument("--reason", default="")

    ss = sub.add_parser("set-status")
    ss.add_argument("video_id")
    ss.add_argument("status")

    args = p.parse_args()
    if args.cmd == "init-db":
        init_db(); print_json({"ok": True})
    elif args.cmd == "sync-sheet":
        print_json(sync_from_sheet(args.range_))
    elif args.cmd == "dashboard":
        print_json(dashboard())
    elif args.cmd == "list":
        print_json(list_videos(args.status, args.limit))
    elif args.cmd == "get":
        print_json(get_video(args.video_id))
    elif args.cmd == "dry-generate":
        print_json(create_dry_run_generation(args.video_id, args.type, args.reason))
    elif args.cmd == "approve":
        print_json(approve_version(args.video_id, args.version_id, args.notes))
    elif args.cmd == "reject":
        print_json(reject_version(args.video_id, args.version_id, args.reason))
    elif args.cmd == "queue-regen":
        print_json(queue_regeneration(args.video_id, args.type, args.reason))
    elif args.cmd == "set-status":
        print_json(set_video_status(args.video_id, args.status))

if __name__ == "__main__":
    main()
