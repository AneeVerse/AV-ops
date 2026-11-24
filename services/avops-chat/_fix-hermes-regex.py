"""Wake rule for the Hermes Google Chat adapter.

Direct messages are answered. A company space is answered when the message
names Hermes, @mentions the bot, or continues a thread Hermes already joined.
The credentials space is never hydrated and never answered.

Workspace Events are stored with includeResource false, so a name-only event
in any other space is hydrated and then this rule decides. The 5-minute sync
stays the backfill. This file is the copy that lives in git. Apply it on the
VPS with:

  sudo python3 /opt/av_ops/docker/avops-chat/_fix-hermes-regex.py
"""
from __future__ import annotations

import os
import py_compile
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional

ADAPTER = Path("/opt/av_ops/docker/hermes_agent/hermes-agent/plugins/platforms/google_chat/adapter.py")
SECRET_SPACE = "spaces/AAQACOxtNdo"
START = "    def _might_answer_workspace_event"
END = "    def _on_pubsub_message"

METHODS = '''
    def _space_is_blocked(self, space_name: str, msg=None) -> bool:
        """Credentials spaces are never read and never answered."""
        if (space_name or "") == "spaces/AAQACOxtNdo":
            return True
        space = {}
        if isinstance(msg, dict) and isinstance(msg.get("space"), dict):
            space = msg["space"]
        label = f"{space.get('displayName') or ''} {space.get('display_name') or ''}"
        return re.search(r"password|token|keys", label, re.I) is not None

    def _message_names_hermes(self, msg) -> bool:
        """True for the word Hermes anywhere, or a Chat @mention of the bot."""
        text = f"{(msg or {}).get('argumentText') or ''} {(msg or {}).get('text') or ''}".lower()
        if re.search(r"(^|[^a-z0-9])hermes\\b", text):
            return True
        for ann in (msg or {}).get("annotations") or []:
            if not isinstance(ann, dict):
                continue
            mention = ann.get("userMention") or ann.get("user_mention") or {}
            if not mention and "MENTION" not in str(ann.get("type") or "").upper():
                continue
            user = mention.get("user") or {}
            if str(user.get("type") or "").upper() == "BOT":
                return True
            label = f"{user.get('displayName') or ''} {user.get('name') or ''}".lower()
            if "hermes" in label:
                return True
        return False

    def _might_answer_workspace_event(self, space_name: str, thread_name: Optional[str]) -> bool:
        """Name-only Workspace Events have no text. Hydrate, then the answer gate decides."""
        del thread_name
        if not space_name or self._space_is_blocked(space_name):
            return False
        return True

    def _should_answer_without_mention(self, msg: Dict[str, Any], space_name: str,
                                       space_type: str, thread_name: Optional[str]) -> bool:
        """DMs are open. Company spaces wake on the name Hermes, a bot @mention, or an active thread."""
        if self._space_is_blocked(space_name, msg):
            return False
        st = (space_type or "").upper()
        if st in {"DIRECT_MESSAGE", "DM"} or bool(msg.get("space") and msg.get("space", {}).get("singleUserBotDm")):
            return True
        if space_name in self._free_response_spaces:
            return True
        if self._thread_is_active(thread_name):
            return True
        return self._message_names_hermes(msg)
'''

ENRICH = '''
    def _enrich_sender_email(self, msg: Dict[str, Any], space_name: str) -> Dict[str, Any]:
        """Workspace Events omit the sender email. Fill it from GOOGLE_CHAT_USER_EMAIL_MAP."""
        del space_name
        if not isinstance(msg, dict):
            return msg
        sender = msg.get("sender") or {}
        if not isinstance(sender, dict) or sender.get("email"):
            return msg
        name = str(sender.get("name") or "")
        email = ""
        for part in (os.environ.get("GOOGLE_CHAT_USER_EMAIL_MAP") or "").split(","):
            if "=" not in part:
                continue
            key, value = (piece.strip() for piece in part.split("=", 1))
            bare = name.rsplit("/", 1)[-1]
            if key and value and key in {name, bare, "users/" + bare}:
                email = value.strip().lower()
                break
        if not email:
            return msg
        updated = dict(msg)
        updated_sender = dict(sender)
        updated_sender["email"] = email
        updated["sender"] = updated_sender
        return updated
'''


def patch_text(text: str) -> str:
    start = text.find(START)
    end = text.find(END)
    if start < 0 or end < 0 or start > end:
        raise SystemExit("wake-rule markers missing from adapter.py")
    if "_message_names_hermes" not in text[start:end]:
        text = text[:start] + METHODS.lstrip("\n") + "\n\n" + text[end:]
        end = text.find(END)
    if "def _enrich_sender_email" not in text:
        text = text[:end] + ENRICH.lstrip("\n") + "\n\n" + text[end:]
    return text


class _Probe:
    _free_response_spaces = {"spaces/AAQAOk6L6k8"}
    _threads: set[str] = set()

    def _thread_is_active(self, name):
        return bool(name) and name in self._threads


def _bind():
    namespace = {"re": re, "os": os, "Optional": Optional, "Dict": Dict, "Any": Any}
    exec("class Adapter:\n" + METHODS + "\n" + ENRICH + "\n", namespace)
    return namespace["Adapter"]


def check() -> None:
    Adapter = _bind()
    bot = Adapter()
    bot._free_response_spaces = {"spaces/AAQAOk6L6k8"}
    bot._threads = set()
    bot._thread_is_active = lambda name: bool(name) and name in bot._threads
    secret = SECRET_SPACE
    company = "spaces/AAQAiYhvg_U"
    test = "spaces/AAQAOk6L6k8"
    assert bot._might_answer_workspace_event(secret, None) is False
    assert bot._might_answer_workspace_event(company, None) is True
    assert bot._should_answer_without_mention({}, secret, "SPACE", None) is False
    assert bot._should_answer_without_mention(
        {"space": {"displayName": "client passwords"}}, company, "SPACE", None
    ) is False
    assert bot._should_answer_without_mention({"text": "hello"}, company, "DIRECT_MESSAGE", None) is True
    assert bot._should_answer_without_mention({"text": "hello"}, test, "SPACE", None) is True
    assert bot._should_answer_without_mention({"text": "ship the banner"}, company, "SPACE", None) is False
    assert bot._should_answer_without_mention(
        {"text": "can hermes assign this today"}, company, "SPACE", None
    ) is True
    assert bot._should_answer_without_mention(
        {"argumentText": "please", "annotations": [{"type": "USER_MENTION", "userMention": {"user": {"type": "BOT", "displayName": "Hermes"}}}]},
        company, "SPACE", None,
    ) is True
    assert bot._should_answer_without_mention({"text": "hermetic seal"}, company, "SPACE", None) is False
    bot._threads.add(company + "/threads/abc")
    assert bot._should_answer_without_mention(
        {"text": "the file is ready"}, company, "SPACE", company + "/threads/abc"
    ) is True
    os.environ["GOOGLE_CHAT_USER_EMAIL_MAP"] = "users/109320900444412543011=mayur@aneeverse.com"
    filled = bot._enrich_sender_email({"sender": {"name": "users/109320900444412543011"}}, company)
    assert filled["sender"]["email"] == "mayur@aneeverse.com"
    kept = bot._enrich_sender_email({"sender": {"name": "users/1", "email": "kept@aneeverse.com"}}, company)
    assert kept["sender"]["email"] == "kept@aneeverse.com"
    print("PASS wake-rule")


def main() -> None:
    if "--check" in sys.argv:
        check()
        return
    check()
    target = Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else ADAPTER
    original = target.read_text()
    updated = patch_text(original)
    if updated == original:
        print("ALREADY")
    else:
        target.write_text(updated)
        print("PATCHED")
    py_compile.compile(str(target), doraise=True)
    print("COMPILED", target)


if __name__ == "__main__":
    main()
