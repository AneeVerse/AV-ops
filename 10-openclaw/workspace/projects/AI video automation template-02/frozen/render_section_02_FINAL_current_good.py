#!/usr/bin/env python3
"""Render Section 2 from template_config.json.

Template-driven Section 2:
- headline/highlight/body/logo text come from template_config.json
- background video comes from the configured assets map
- animation is recreated with FFmpeg, not baked from the reference video
"""
from __future__ import annotations

import json
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "template_config.json"

FONT = ROOT / "assets/fonts/Industry_Bold.otf"
FONT_REG = ROOT / "assets/fonts/Inter-Regular.otf"

RED = "0xD71920"
BLACK = "0x111111"
WHITE = "0xFFFFFF"
BLUE = "0x1C6FD6"


def ff_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "\\'")
        .replace("%", "\\%")
        .replace("\n", " ")
    )


def esc_expr(expr: str) -> str:
    return expr.replace(",", r"\,")


def drawtext(font: Path, text: str, x: int, y: int, size: int, color: str, alpha: str | None = None, shadow: bool = False) -> str:
    extra = f":alpha='{esc_expr(alpha)}'" if alpha else ""
    if shadow:
        extra += ":shadowcolor=black@0.45:shadowx=2:shadowy=2"
    return (
        f"drawtext=fontfile='{font}':text='{ff_text(text)}':"
        f"x={x}:y={y}:fontsize={size}:fontcolor={color}{extra}"
    )


def main() -> None:
    data = json.loads(CONFIG.read_text())
    assets = data["assets"]
    section = next(s for s in data["sections"] if s["id"] == 2)

    duration = float(section.get("duration", data["timing"]["section_02"]))
    background_key = section.get("background")
    if not background_key:
        raise SystemExit("Section 2 needs a background key")
    background = ROOT / assets[background_key]
    if not background.exists():
        raise SystemExit(f"Configured Section 2 background not found: {background}")

    headline = (section.get("headline_lines") or [""])[0]
    highlight = section.get("highlight", "")
    logo_label = section.get("logo_label", "TRUCKER PATH")

    body = section.get("body", "")
    body_lines = textwrap.wrap(body, width=31)[:5]
    while len(body_lines) < 5:
        body_lines.append("")

    fade_start = max(0, duration - 0.45)

    # Match the original reference structure:
    # - clean background video, no white/gray top panel
    # - headline/highlight already visible from frame 0
    # - lower-left Trucker Path logo block appears early
    # - body copy reveals line-by-line, then whole section fades out at end
    ops: list[str] = [
        "scale=1080:1920:force_original_aspect_ratio=increase",
        "crop=1080:1920",
        "fps=30",
        drawtext(FONT, headline, 74, 145, 101, BLACK),
        f"drawbox=x=58:y=250:w=895:h=116:color={RED}:t=fill",
        drawtext(FONT, highlight, 76, 263, 90, WHITE),
        # Editable lower-left label. No icon box.
        drawtext(FONT, logo_label, 58, 1485, 42, WHITE, shadow=True),
    ]

    y = 1543
    for i, line in enumerate(body_lines):
        if line:
            start = 0.35 + i * 0.18
            ops.append(
                drawtext(
                    FONT_REG,
                    line,
                    58,
                    y,
                    54,
                    WHITE,
                    f"if(lt(t,{start:.2f}),0,min(1,(t-{start:.2f})/0.22))",
                    shadow=True,
                )
            )
        y += 66

    ops.append(f"fade=t=out:st={fade_start:.2f}:d=0.45")
    ops.append("format=yuv420p")
    filter_complex = "[0:v]" + ",".join(ops) + "[v]"

    out = ROOT / "work/section_02.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1", "-t", str(duration), "-i", str(background),
        "-f", "lavfi", "-t", str(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-filter_complex", filter_complex,
        "-map", "[v]", "-map", "1:a",
        "-t", str(duration), "-r", "30",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "18",
        "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest",
        str(out),
    ]
    subprocess.run(cmd, check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
