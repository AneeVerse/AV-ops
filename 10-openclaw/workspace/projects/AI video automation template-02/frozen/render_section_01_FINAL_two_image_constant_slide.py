#!/usr/bin/env python3
"""Render Section 1 from template_config.json.

Template-driven Section 1:
- headline/highlight/body text come from template_config.json
- screenshots come from the configured assets map
- animation is recreated with FFmpeg values, not baked from reference frames
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
BG = "0xF4F4F1"
BLACK = "0x111111"
WHITE = "0xFFFFFF"
BODY_RED = "0xC01822"


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


def drawtext(font: Path, text: str, x: int, y: int, size: int, color: str, alpha: str | None = None) -> str:
    extra = f":alpha='{esc_expr(alpha)}'" if alpha else ""
    return (
        f"drawtext=fontfile='{font}':text='{ff_text(text)}':"
        f"x={x}:y={y}:fontsize={size}:fontcolor={color}{extra}"
    )


def main() -> None:
    data = json.loads(CONFIG.read_text())
    assets = data["assets"]
    section = next(s for s in data["sections"] if s["id"] == 1)

    duration = float(section.get("duration", data["timing"]["section_01"]))
    headline = section.get("headline_lines", ["", ""])
    if len(headline) < 2:
        headline = headline + [""] * (2 - len(headline))

    screenshot_keys = section.get("screenshots", [])
    primary = section.get("primary_screenshot")
    if primary and primary not in screenshot_keys:
        screenshot_keys.append(primary)
    if not screenshot_keys:
        raise SystemExit("Section 1 needs at least one screenshot key in template_config.json")

    screenshots = [ROOT / assets[key] for key in screenshot_keys]
    if len(screenshots) == 1:
        screenshots.append(screenshots[0])
    for screenshot in screenshots:
        if not screenshot.exists():
            raise SystemExit(f"Configured Section 1 screenshot not found: {screenshot}")

    body_lines = textwrap.wrap(section.get("body", ""), width=39)[:3]
    while len(body_lines) < 3:
        body_lines.append("")

    filters: list[str] = []
    for idx in range(len(screenshots)):
        # Section 1 screenshots are replaceable lower UI/card assets.
        filters.append(f"[{idx}:v]scale=1080:-1,format=rgba[shot{idx}]")

    bg_idx = len(screenshots)
    audio_idx = bg_idx + 1

    # Text animation follows the reference: headline settles first, highlight wipes in,
    # body copy fades in line-by-line, then the screenshot carousel/pan continues below.
    base_ops = [
        drawtext(FONT, headline[0], 74, 117, 124, BLACK),
        drawtext(FONT, headline[1], 74, 272, 124, BLACK),
        f"drawbox=x=57:y=413:w=912:h=156:color={RED}:t=fill",
        drawtext(FONT, section.get("highlight", ""), 84, 437, 118, WHITE),
    ]

    y = 636
    for i, line in enumerate(body_lines):
        if line:
            start = 0.45 + i * 0.12
            base_ops.append(
                drawtext(
                    FONT_REG,
                    line,
                    77,
                    y,
                    50,
                    BODY_RED,
                    f"if(lt(t,{start:.2f}),0,min(1,(t-{start:.2f})/0.35))",
                )
            )
        y += 66

    filters.append(f"[{bg_idx}:v]" + ",".join(base_ops) + "[base]")

    # Lower UI screenshots.
    # Two-image mode is strictly two replaceable screenshots only.
    # Both move right-to-left at one constant linear speed with a small gap.
    # No easing, fades, loops, or duplicated third screenshot.
    if len(screenshots) == 2:
        gap = 40
        speed = (1080 + gap) / duration
        y_expr = "900"
        filters.append(
            f"[base][shot0]overlay=x='-({speed:.6f})*t':y='{y_expr}':enable='between(t\\,0\\,{duration:.3f})'[slide0]"
        )
        filters.append(
            f"[slide0][shot1]overlay=x='{1080 + gap}-({speed:.6f})*t':y='{y_expr}':enable='between(t\\,0\\,{duration:.3f})',format=yuv420p[v]"
        )
    else:
        # Fallback for older multi-image configs: static timed sequence.
        chain = "base"
        starts = [0.00, 0.70, 1.45, 2.25, 3.45]
        for idx in range(len(screenshots)):
            start = starts[idx] if idx < len(starts) else 0.65 + idx * 0.7
            end = starts[idx + 1] if idx + 1 < min(len(screenshots), len(starts)) else duration + 0.1
            out_label = "v" if idx == len(screenshots) - 1 else f"tmp{idx}"
            enable = f"gte(t\\,{start:.2f})" if idx == len(screenshots) - 1 else f"between(t\\,{start:.2f}\\,{end:.2f})"
            suffix = ",format=yuv420p" if idx == len(screenshots) - 1 else ""
            filters.append(
                f"[{chain}][shot{idx}]overlay=x='0':y='900':enable='{enable}'{suffix}[{out_label}]"
            )
            chain = out_label

    filter_complex = ";".join(filters)

    out = ROOT / "work/section_01.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = ["ffmpeg", "-y"]
    for screenshot in screenshots:
        cmd += ["-loop", "1", "-t", str(duration), "-i", str(screenshot)]
    cmd += [
        "-f", "lavfi", "-t", str(duration), "-i", f"color=c={BG}:s=1080x1920:r=30",
        "-f", "lavfi", "-t", str(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-filter_complex", filter_complex,
        "-map", "[v]", "-map", f"{audio_idx}:a",
        "-t", str(duration), "-r", "30",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "18",
        "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest",
        str(out),
    ]
    subprocess.run(cmd, check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
