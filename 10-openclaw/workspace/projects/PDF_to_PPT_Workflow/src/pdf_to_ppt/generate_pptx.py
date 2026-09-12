from __future__ import annotations

import json
import re
from copy import deepcopy
from io import BytesIO
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

from .deck_schema import DeckPlan

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)
NAVY = RGBColor(18, 31, 61)
BLUE = RGBColor(47, 103, 246)
LIGHT = RGBColor(246, 248, 252)
GREY = RGBColor(95, 105, 125)
WHITE = RGBColor(255, 255, 255)


ROOT = Path(__file__).resolve().parents[2]


def _rgb(hex_color: str) -> RGBColor:
    h = hex_color.strip().lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _clean_text(text: str) -> str:
    return re.sub(r"\*\*(.*?)\*\*", r"\1", text or "").strip()


def _set_run(run, size: int, bold: bool = False, color: RGBColor = NAVY) -> None:
    run.font.name = "Aptos"
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def _set_run_font(run, font_name: str, size: int, bold: bool = False, color: RGBColor = NAVY) -> None:
    run.font.name = font_name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def _textbox(slide, x, y, w, h, text: str = ""):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    if text:
        tf.text = text
    return box


def _add_title(slide, title: str, subtitle: str = "") -> None:
    box = _textbox(slide, Inches(0.8), Inches(0.65), Inches(11.8), Inches(1.2))
    p = box.text_frame.paragraphs[0]
    p.text = title
    _set_run(p.runs[0], 34, True, NAVY)
    if subtitle:
        p2 = box.text_frame.add_paragraph()
        p2.text = subtitle
        p2.space_before = Pt(8)
        _set_run(p2.runs[0], 15, False, GREY)


def _add_bullets(slide, bullets: list[str], x, y, w, h, font_size: int = 18) -> None:
    box = _textbox(slide, x, y, w, h)
    tf = box.text_frame
    for idx, bullet in enumerate(bullets[:6]):
        p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        p.text = bullet
        p.level = 0
        p.space_after = Pt(8)
        _set_run(p.runs[0], font_size, False, NAVY)


def _add_footer(slide, slide_number: int) -> None:
    box = _textbox(slide, Inches(11.9), Inches(7.0), Inches(0.7), Inches(0.25))
    p = box.text_frame.paragraphs[0]
    p.text = str(slide_number)
    p.alignment = PP_ALIGN.RIGHT
    _set_run(p.runs[0], 9, False, GREY)


def _add_card(slide, x, y, w, h, fill=WHITE):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = RGBColor(225, 230, 240)
    return shape


def _load_template(template_config_path: str | Path | None) -> dict | None:
    if not template_config_path:
        return None
    path = Path(template_config_path)
    if not path.is_absolute():
        path = ROOT / path
    data = json.loads(path.read_text(encoding="utf-8"))
    data["_path"] = str(path)
    return data


def _asset_path(template: dict, key: str) -> Path | None:
    value = template.get("assets", {}).get(key)
    if not value:
        return None
    path = Path(value)
    if not path.is_absolute():
        path = ROOT / path
    return path


def _ensure_png_logo(template: dict) -> Path | None:
    logo = _asset_path(template, "logo")
    if not logo or not logo.exists():
        return None
    if logo.suffix.lower() in {".png", ".jpg", ".jpeg"}:
        return logo
    out_dir = ROOT / "work" / "template_assets"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{logo.stem}.png"
    if out.exists() and out.stat().st_mtime >= logo.stat().st_mtime:
        return out
    if logo.suffix.lower() == ".svg":
        try:
            import cairosvg

            cairosvg.svg2png(url=str(logo), write_to=str(out), output_width=900)
            return out
        except Exception:
            return None
    return None


def _append_editable_reference_slide(prs: Presentation, reference_pptx: Path, slide_number: int | None = None) -> None:
    """Append a one-slide reference PPTX as editable PowerPoint objects.

    Text boxes, auto-shapes, and lines are copied as DrawingML. Pictures are
    reinserted as picture objects so they remain movable/editable in PowerPoint.
    """
    ref = Presentation(str(reference_pptx))
    src_slide = ref.slides[0]
    dst_slide = prs.slides.add_slide(prs.slide_layouts[6])

    # Match explicit background when available.
    try:
        if src_slide.background.fill.type is not None:
            dst_slide.background.fill.solid()
            dst_slide.background.fill.fore_color.rgb = src_slide.background.fill.fore_color.rgb
    except Exception:
        pass

    for shape in src_slide.shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            pic = dst_slide.shapes.add_picture(
                BytesIO(shape.image.blob),
                shape.left,
                shape.top,
                width=shape.width,
                height=shape.height,
            )
            try:
                pic.crop_left = shape.crop_left
                pic.crop_right = shape.crop_right
                pic.crop_top = shape.crop_top
                pic.crop_bottom = shape.crop_bottom
            except Exception:
                pass
            continue

        newel = deepcopy(shape.element)
        dst_slide.shapes._spTree.insert_element_before(newel, "p:extLst")

    if slide_number is not None:
        for shape in dst_slide.shapes:
            if getattr(shape, "has_text_frame", False) and shape.text.strip().isdigit():
                shape.text_frame.clear()
                shape.text_frame.text = str(slide_number)
                break


def _remove_empty_placeholders(slide) -> None:
    """Remove default empty placeholders that Google Slides can display visibly."""
    for shape in list(slide.shapes):
        if not getattr(shape, "is_placeholder", False):
            continue
        if getattr(shape, "has_text_frame", False) and shape.text.strip():
            continue
        shape.element.getparent().remove(shape.element)


def _render_truckstop_direction_slide(prs: Presentation, template: dict, palette: dict[str, RGBColor]) -> None:
    """Editable rebuild of the client's 'Where Truckstop Is Going' slide."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _remove_empty_placeholders(slide)
    bg = slide.background.fill
    bg.solid(); bg.fore_color.rgb = palette["white"]

    # Section label
    kicker = _textbox(slide, Inches(0.607), Inches(0.30), Inches(3.1), Inches(0.27), "DIRECTION & MOMENTUM")
    _set_run_font(kicker.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "data"), 8, True, palette["red"])

    # Title
    title = _textbox(slide, Inches(0.402), Inches(0.40), Inches(12.0), Inches(0.70), "Where Truckstop Is Going")
    _set_run_font(title.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "heading"), 30, True, palette["dark"])

    # Subtitle
    sub = _textbox(slide, Inches(0.532), Inches(1.33), Inches(10.4), Inches(0.65))
    tf = sub.text_frame; tf.clear(); tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run(); r.text = "From finding capacity → to controlling your network"
    _set_run_font(r, _truckstop_font(template), 14, True, palette["dark"])
    p2 = tf.add_paragraph()
    r2 = p2.add_run(); r2.text = "Truckstop is becoming the system brokers use to source, manage, and pay carriers in one place."
    _set_run_font(r2, _truckstop_font(template), 13, False, palette["grey"])

    # Timeline line and nodes
    line = slide.shapes.add_connector(1, Inches(0.72), Inches(4.42), Inches(12.25), Inches(4.42))
    line.line.color.rgb = palette["border"]
    line.line.width = Pt(1.25)
    for x in [2.18, 3.99, 5.80, 7.60, 9.41, 11.22]:
        dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(4.36), Inches(0.13), Inches(0.13))
        dot.fill.solid(); dot.fill.fore_color.rgb = palette["red"]
        dot.line.fill.background()

    cards = [
        (0.583, 2.291, "Capacity You Control", "Move from searching to directing freight", [
            "Private Loads as your owned network",
            "Waterfall routing to tier and release capacity",
            "Reach carriers you trust first, then expand",
            "Better coverage with fewer calls",
        ]),
        (4.199, 2.291, "MCP-Connected Workflows", "Work inside your TMS, email, and tools", [
            "Push loads directly from your TMS",
            "Deep links from email into live capacity",
            "No rekeying. No swivel chair",
            "Faster execution across your team",
        ]),
        (7.814, 2.291, "AI That Improves Decisions", "Less guesswork. Better outcomes", [
            "Smart carrier matching based on history and behavior",
            "Rate guidance tied to real market data",
            "AI support inside daily workflows",
            "Faster decisions under pressure",
        ]),
        (2.391, 4.805, "Built-In Compliance and Risk", "Protect every load without slowing down", [
            "RMIS and Risk Factors in every decision",
            "Continuous monitoring, not one-time onboarding",
            "Fraud signals before you assign the load",
            "Fewer surprises after pickup",
        ]),
        (6.007, 4.805, "Payments and Back Office in Flow", "From booking → to getting paid and paying carriers", [
            "Factoring and payment tools built in",
            "Faster carrier payments to secure capacity",
            "Clear visibility into pay terms and risk",
            "Less time chasing paperwork",
        ]),
        (9.622, 4.805, "Coverage Across All Freight Types", "Handle more loads without adding complexity", [
            "Standard, specialized, and heavy haul in one system",
            "Better tools for complex moves",
            "Expand into higher-value freight with confidence",
        ]),
    ]
    icon_positions = [(1.892, 3.75), (5.508, 3.75), (9.123, 3.75), (3.70, 4.424), (7.316, 4.424), (10.931, 4.424)]
    icon_labels = ["↗", "↔", "AI", "✓", "$", "+"]

    for idx, ((x, y, heading, tagline, bullets), (ix, iy), icon_label) in enumerate(zip(cards, icon_positions, icon_labels)):
        _add_ts_card(slide, Inches(x), Inches(y), Inches(3.319), Inches(1.735), palette, fill=palette["white"], line=palette["border"])
        txt = _textbox(slide, Inches(x + 0.18), Inches(y + 0.16), Inches(2.95), Inches(1.25))
        tf = txt.text_frame; tf.clear(); tf.word_wrap = True
        p = tf.paragraphs[0]
        r = p.add_run(); r.text = heading
        _set_run_font(r, _truckstop_font(template, "heading"), 10, True, palette["dark"])
        p2 = tf.add_paragraph(); p2.space_before = Pt(3)
        r2 = p2.add_run(); r2.text = tagline
        _set_run_font(r2, _truckstop_font(template), 8, False, palette["grey"])
        for b in bullets:
            pb = tf.add_paragraph(); pb.space_before = Pt(2)
            rb = pb.add_run(); rb.text = "• " + b
            _set_run_font(rb, _truckstop_font(template), 6.6, False, palette["onyx"])

        circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(ix), Inches(iy), Inches(0.701), Inches(0.701))
        circle.fill.solid(); circle.fill.fore_color.rgb = palette["white"]
        circle.line.color.rgb = palette["red"]
        circle.line.width = Pt(1.25)
        label = _textbox(slide, Inches(ix), Inches(iy + 0.18), Inches(0.701), Inches(0.25), icon_label)
        label.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
        _set_run_font(label.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "heading"), 10, True, palette["red"])

    footer = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.583), Inches(6.779), Inches(12.358), Inches(0.358))
    footer.fill.solid(); footer.fill.fore_color.rgb = palette["dark"]
    footer.line.fill.background()
    ftxt = _textbox(slide, Inches(0.80), Inches(6.85), Inches(11.8), Inches(0.20), "Source faster.  Cover smarter.  Build a network that works for you.")
    ftxt.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
    _set_run_font(ftxt.text_frame.paragraphs[0].runs[0], _truckstop_font(template), 9, True, palette["white"])

    num = _textbox(slide, Inches(12.814), Inches(7.052), Inches(0.399), Inches(0.25), "2")
    num.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
    _set_run_font(num.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "data"), 8, False, palette["grey"])


def _truckstop_palette(template: dict) -> dict[str, RGBColor]:
    c = template.get("colors", {})
    return {
        "red": _rgb(c.get("primary_red", "#D70119")),
        "dark": _rgb(c.get("deck_dark", "#373A36")),
        "onyx": _rgb(c.get("deep_onyx", "#1A1A1B")),
        "grey": _rgb(c.get("neutral_grey", "#5B5D5A")),
        "bg": _rgb(c.get("background_grey", "#F4F4F4")),
        "light": _rgb(c.get("light_grey", "#F2F3F3")),
        "border": _rgb(c.get("border_grey", "#DADDDD")),
        "white": _rgb(c.get("white", "#FFFFFF")),
        "black": _rgb(c.get("black", "#000000")),
    }


def _truckstop_font(template: dict, role: str = "body") -> str:
    typo = template.get("typography", {})
    if role == "display":
        return typo.get("display", {}).get("font", "Industry Bold")
    if role == "heading":
        return typo.get("heading", {}).get("font", "Inter")
    if role == "data":
        return typo.get("data", {}).get("font", "Inter")
    return typo.get("body", {}).get("font", "Inter")


def _add_ts_footer(slide, slide_number: int, template: dict, palette: dict[str, RGBColor]) -> None:
    logo = _ensure_png_logo(template)
    if logo:
        slide.shapes.add_picture(str(logo), Inches(0.55), Inches(6.85), width=Inches(1.35))
    else:
        mark = _textbox(slide, Inches(0.55), Inches(6.82), Inches(1.5), Inches(0.3), "truckstop")
        _set_run_font(mark.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "heading"), 10, True, palette["black"])
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(2.15), Inches(7.02), Inches(9.55), Inches(0.025))
    line.fill.solid(); line.fill.fore_color.rgb = palette["border"]
    line.line.fill.background()
    num = _textbox(slide, Inches(12.1), Inches(6.88), Inches(0.55), Inches(0.25), str(slide_number))
    p = num.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    _set_run_font(p.runs[0], _truckstop_font(template, "data"), 9, False, palette["grey"])


def _add_ts_kicker(slide, text: str, palette: dict[str, RGBColor], template: dict, x=0.72, y=0.52) -> None:
    box = _textbox(slide, Inches(x), Inches(y), Inches(2.6), Inches(0.28), text.upper())
    p = box.text_frame.paragraphs[0]
    _set_run_font(p.runs[0], _truckstop_font(template, "data"), 8, True, palette["red"])


def _add_ts_title(slide, title: str, subtitle: str, palette: dict[str, RGBColor], template: dict, y=0.78) -> None:
    box = _textbox(slide, Inches(0.7), Inches(y), Inches(11.6), Inches(1.05))
    p = box.text_frame.paragraphs[0]
    p.text = _clean_text(title)
    _set_run_font(p.runs[0], _truckstop_font(template, "heading"), 31, True, palette["dark"])
    if subtitle:
        p2 = box.text_frame.add_paragraph()
        p2.text = _clean_text(subtitle)
        p2.space_before = Pt(6)
        _set_run_font(p2.runs[0], _truckstop_font(template), 13, False, palette["grey"])


def _add_ts_bullets(slide, bullets: list[str], x, y, w, h, palette: dict[str, RGBColor], template: dict, font_size=15) -> None:
    box = _textbox(slide, x, y, w, h)
    tf = box.text_frame
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.08)
    tf.margin_top = Inches(0.06)
    for idx, bullet in enumerate(bullets[:6]):
        p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        p.text = "■ " + _clean_text(bullet)
        p.space_after = Pt(8)
        _set_run_font(p.runs[0], _truckstop_font(template), font_size, False, palette["onyx"])


def _add_ts_card(slide, x, y, w, h, palette: dict[str, RGBColor], fill: RGBColor | None = None, line: RGBColor | None = None):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shape.fill.solid(); shape.fill.fore_color.rgb = fill or palette["white"]
    shape.line.color.rgb = line or palette["border"]
    shape.line.width = Pt(1)
    return shape


def _add_ts_visual_placeholder(slide, text: str, x, y, w, h, palette: dict[str, RGBColor], template: dict) -> None:
    card = _add_ts_card(slide, x, y, w, h, palette, fill=palette["light"])
    accent = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, Inches(0.08), h)
    accent.fill.solid(); accent.fill.fore_color.rgb = palette["red"]
    accent.line.fill.background()
    box = _textbox(slide, x + Inches(0.28), y + Inches(0.35), w - Inches(0.55), h - Inches(0.7), _clean_text(text) or "Visual / chart / product screenshot area")
    _set_run_font(box.text_frame.paragraphs[0].runs[0], _truckstop_font(template), 13, False, palette["grey"])


def _render_truckstop_deck(deck: DeckPlan, out_path: Path, template: dict) -> Path:
    palette = _truckstop_palette(template)
    title_reference_pptx = _asset_path(template, "title_reference_pptx")
    use_reference_title = bool(
        title_reference_pptx
        and title_reference_pptx.exists()
        and deck.slides
        and deck.slides[0].layout == "title"
    )
    if use_reference_title:
        prs = Presentation(str(title_reference_pptx))
        prs.slide_width = SLIDE_W
        prs.slide_height = SLIDE_H
    else:
        prs = Presentation()
        prs.slide_width = SLIDE_W
        prs.slide_height = SLIDE_H
    blank = prs.slide_layouts[6]

    logo = _ensure_png_logo(template)
    slide_2_reference_pptx = _asset_path(template, "slide_2_reference_pptx")
    use_reference_slide_2 = bool(
        slide_2_reference_pptx
        and slide_2_reference_pptx.exists()
        and len(deck.slides) >= 2
    )
    if use_reference_slide_2:
        if not use_reference_title:
            raise ValueError("slide_2_reference_pptx currently requires title_reference_pptx so slide order stays stable")
        _render_truckstop_direction_slide(prs, template, palette)

    skip_count = (1 if use_reference_title else 0) + (1 if use_reference_slide_2 else 0)
    slides_to_render = deck.slides[skip_count:]
    for s in slides_to_render:
        slide = prs.slides.add_slide(blank)
        _remove_empty_placeholders(slide)
        bg = slide.background.fill
        bg.solid(); bg.fore_color.rgb = palette["bg"]
        layout = s.layout

        if layout == "title":
            title_ref = _asset_path(template, "title_reference_image")
            if title_ref and title_ref.exists():
                slide.shapes.add_picture(str(title_ref), 0, 0, width=SLIDE_W, height=SLIDE_H)
                # Keep searchable/editable text metadata without changing the visual reference image.
                hidden = _textbox(slide, SLIDE_W, 0, Inches(0.1), Inches(0.1), _clean_text(s.title))
                _set_run_font(hidden.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "heading"), 1, False, palette["white"])
                if s.speaker_notes:
                    slide.notes_slide.notes_text_frame.text = s.speaker_notes
                continue
            _add_ts_card(slide, Inches(0.42), Inches(0.42), Inches(12.5), Inches(6.45), palette, fill=palette["white"])
            if logo:
                slide.shapes.add_picture(str(logo), Inches(0.82), Inches(0.75), width=Inches(2.0))
            _add_ts_kicker(slide, "Introduction", palette, template, x=0.86, y=1.78)
            title = _textbox(slide, Inches(0.82), Inches(2.15), Inches(8.8), Inches(1.65), _clean_text(s.title))
            _set_run_font(title.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "display"), 38, True, palette["black"])
            sub = _textbox(slide, Inches(0.88), Inches(3.86), Inches(7.7), Inches(0.65), _clean_text(s.subtitle or deck.deck_subtitle))
            _set_run_font(sub.text_frame.paragraphs[0].runs[0], _truckstop_font(template), 17, False, palette["grey"])
            red = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9.65), Inches(0.42), Inches(3.27), Inches(6.45))
            red.fill.solid(); red.fill.fore_color.rgb = palette["red"]
            red.line.fill.background()
            call = _textbox(slide, Inches(10.0), Inches(4.75), Inches(2.45), Inches(0.85), "EDITABLE\nPPTX TEMPLATE")
            for p in call.text_frame.paragraphs:
                for r in p.runs:
                    _set_run_font(r, _truckstop_font(template, "heading"), 18, True, palette["white"])

        elif layout == "section":
            slide.background.fill.fore_color.rgb = palette["dark"]
            if logo:
                slide.shapes.add_picture(str(logo), Inches(0.72), Inches(0.62), width=Inches(1.75))
            _add_ts_kicker(slide, "Section", palette, template, x=0.82, y=2.0)
            title = _textbox(slide, Inches(0.8), Inches(2.38), Inches(9.5), Inches(1.35), _clean_text(s.title))
            _set_run_font(title.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "display"), 40, True, palette["white"])
            if s.subtitle:
                sub = _textbox(slide, Inches(0.84), Inches(3.78), Inches(8.7), Inches(0.55), _clean_text(s.subtitle))
                _set_run_font(sub.text_frame.paragraphs[0].runs[0], _truckstop_font(template), 16, False, palette["border"])
            block = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(10.7), Inches(0), Inches(2.65), Inches(7.5))
            block.fill.solid(); block.fill.fore_color.rgb = palette["red"]
            block.line.fill.background()

        elif layout == "two_column":
            _add_ts_kicker(slide, "Platform Overview", palette, template)
            _add_ts_title(slide, s.title, s.subtitle, palette, template)
            _add_ts_card(slide, Inches(0.72), Inches(2.02), Inches(5.85), Inches(4.55), palette)
            _add_ts_card(slide, Inches(6.82), Inches(2.02), Inches(5.85), Inches(4.55), palette)
            left = s.bullets[:3]
            right = s.bullets[3:6] or ([s.body] if s.body else [s.visual_direction])
            _add_ts_bullets(slide, left, Inches(1.02), Inches(2.42), Inches(5.25), Inches(3.6), palette, template)
            _add_ts_bullets(slide, right, Inches(7.12), Inches(2.42), Inches(5.25), Inches(3.6), palette, template)

        elif layout in {"data", "quote"}:
            _add_ts_kicker(slide, "Market Intelligence", palette, template)
            _add_ts_title(slide, s.title, s.subtitle, palette, template)
            bullets = (s.bullets or [_clean_text(s.body)])[:4]
            x = 0.72
            for i, bullet in enumerate(bullets):
                card_x = Inches(x + (i % 2) * 6.08)
                card_y = Inches(2.12 + (i // 2) * 2.05)
                _add_ts_card(slide, card_x, card_y, Inches(5.72), Inches(1.65), palette)
                num = _textbox(slide, card_x + Inches(0.25), card_y + Inches(0.18), Inches(1.0), Inches(0.48), f"{i+1:02}")
                _set_run_font(num.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "display"), 20, True, palette["red"])
                txt = _textbox(slide, card_x + Inches(1.25), card_y + Inches(0.25), Inches(4.1), Inches(0.95), _clean_text(bullet))
                _set_run_font(txt.text_frame.paragraphs[0].runs[0], _truckstop_font(template), 14, False, palette["onyx"])

        elif layout == "cta":
            slide.background.fill.fore_color.rgb = palette["dark"]
            if logo:
                slide.shapes.add_picture(str(logo), Inches(0.78), Inches(0.65), width=Inches(1.9))
            _add_ts_kicker(slide, "Next Step", palette, template, x=0.82, y=1.75)
            title = _textbox(slide, Inches(0.8), Inches(2.15), Inches(9.6), Inches(1.0), _clean_text(s.title))
            _set_run_font(title.text_frame.paragraphs[0].runs[0], _truckstop_font(template, "display"), 36, True, palette["white"])
            _add_ts_bullets(slide, s.bullets or ([s.body] if s.body else []), Inches(0.9), Inches(3.45), Inches(8.9), Inches(2.25), palette, template, 15)
            for shape in slide.shapes:
                if shape.has_text_frame and shape != title:
                    for p in shape.text_frame.paragraphs:
                        for r in p.runs:
                            if r.text.startswith("■"):
                                r.font.color.rgb = palette["white"]
            red = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(10.45), Inches(0), Inches(2.88), Inches(7.5))
            red.fill.solid(); red.fill.fore_color.rgb = palette["red"]
            red.line.fill.background()

        else:
            _add_ts_kicker(slide, "Company Overview", palette, template)
            _add_ts_title(slide, s.title, s.subtitle, palette, template)
            _add_ts_card(slide, Inches(0.72), Inches(2.05), Inches(7.55), Inches(4.42), palette)
            _add_ts_bullets(slide, s.bullets or ([s.body] if s.body else []), Inches(1.0), Inches(2.42), Inches(6.95), Inches(3.55), palette, template, 15)
            _add_ts_visual_placeholder(slide, s.visual_direction, Inches(8.55), Inches(2.05), Inches(4.12), Inches(4.42), palette, template)

        if layout != "section":
            _add_ts_footer(slide, s.slide_number, template, palette)
        if s.speaker_notes:
            slide.notes_slide.notes_text_frame.text = s.speaker_notes

    prs.save(out_path)
    return out_path


def generate_pptx(deck_plan_path: str | Path, out_path: str | Path, template_config_path: str | Path | None = None) -> Path:
    deck = DeckPlan.model_validate_json(Path(deck_plan_path).read_text(encoding="utf-8"))
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    template = _load_template(template_config_path)
    if template and template.get("client", "").lower() == "truckstop":
        return _render_truckstop_deck(deck, out_path, template)

    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank = prs.slide_layouts[6]

    for s in deck.slides:
        slide = prs.slides.add_slide(blank)
        bg = slide.background.fill
        bg.solid()
        bg.fore_color.rgb = LIGHT

        if s.layout == "title":
            _add_card(slide, Inches(0.55), Inches(0.55), Inches(12.2), Inches(6.35), WHITE)
            _add_title(slide, s.title, s.subtitle or deck.deck_subtitle)
            box = _textbox(slide, Inches(0.9), Inches(4.9), Inches(8.5), Inches(0.6), "Generated from PDF content • Editable PPTX")
            _set_run(box.text_frame.paragraphs[0].runs[0], 14, False, GREY)
        elif s.layout == "two_column":
            _add_title(slide, s.title, s.subtitle)
            left = s.bullets[:3]
            right = s.bullets[3:6] or [s.visual_direction or "Suggested visual area"]
            _add_card(slide, Inches(0.8), Inches(2.0), Inches(5.65), Inches(4.3), WHITE)
            _add_card(slide, Inches(6.85), Inches(2.0), Inches(5.65), Inches(4.3), WHITE)
            _add_bullets(slide, left, Inches(1.1), Inches(2.35), Inches(5.0), Inches(3.5), 17)
            _add_bullets(slide, right, Inches(7.15), Inches(2.35), Inches(5.0), Inches(3.5), 17)
        elif s.layout == "cta":
            _add_card(slide, Inches(0.65), Inches(0.65), Inches(12.05), Inches(6.2), NAVY)
            title = _textbox(slide, Inches(1.05), Inches(1.0), Inches(10.8), Inches(0.9), s.title)
            _set_run(title.text_frame.paragraphs[0].runs[0], 32, True, WHITE)
            _add_bullets(slide, s.bullets, Inches(1.1), Inches(2.25), Inches(10.7), Inches(3.2), 20)
            for shape in slide.shapes:
                if shape.has_text_frame and shape != title:
                    for p in shape.text_frame.paragraphs:
                        for r in p.runs:
                            r.font.color.rgb = WHITE
        else:
            _add_title(slide, s.title, s.subtitle)
            _add_card(slide, Inches(0.8), Inches(2.0), Inches(8.0), Inches(4.4), WHITE)
            _add_bullets(slide, s.bullets or ([s.body] if s.body else []), Inches(1.15), Inches(2.35), Inches(7.3), Inches(3.6), 18)
            _add_card(slide, Inches(9.15), Inches(2.0), Inches(3.35), Inches(4.4), RGBColor(235, 240, 255))
            visual = _textbox(slide, Inches(9.45), Inches(2.35), Inches(2.75), Inches(3.6), s.visual_direction or "Visual / chart / image area")
            _set_run(visual.text_frame.paragraphs[0].runs[0], 15, False, BLUE)

        if s.speaker_notes:
            notes = slide.notes_slide.notes_text_frame
            notes.text = s.speaker_notes
        _add_footer(slide, s.slide_number)

    prs.save(out_path)
    return out_path
