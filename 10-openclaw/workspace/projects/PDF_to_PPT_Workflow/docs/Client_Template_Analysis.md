# Client Template Analysis - Truckstop

## Source files received

Stored in:

`resources/client_template/`

Files:

- `Truckstop 141_Strategic Team Pitch Deck_v1.1.pptx`
- `Truckstop New logo.svg`
- `Industry Bold.otf`
- `truckstop-design.md`

## PPT inspection

- Existing client PPT has **32 slides**.
- Slide size: **16:9 widescreen** — approx. **13.33 x 7.5 inches**.
- It contains many embedded media assets, mostly SVGs.
- Theme/fonts detected in PPT XML:
  - Inter
  - Arial
  - Montserrat
  - Industry Bold file provided separately
- Strong color usage detected:
  - `#D90119` / `#D70119` red family
  - `#373A36` dark grey/onyx
  - `#000000`
  - `#5A5D59` / `#5B5D5A` neutral grey
  - `#FFFFFF`
  - `#DADDDD`, `#F2F3F3`, `#F4F4F4` light greys

## Brand/design system from provided markdown

### Core style

- Brand feel: **Modern-industrial**
- Tone: **authoritative, reliable, hardworking**
- Visual approach: high contrast, heavy typography, modular data layouts, clear hierarchy
- Avoid gradients; keep design flat, robust, and structured

### Brand colors

| Role | Hex |
|---|---|
| Primary Red | `#D70119` |
| Surface / White | `#FFFFFF` |
| Primary Text / Deep Onyx | `#1A1A1B` |
| Neutral Grey | `#5B5D5A` |
| Background Grey | `#F4F4F4` |

### Typography

- Display font: **Industry Bold**
- Primary font: **Inter**
- Fallback/system font: geometric sans-serif / Arial if needed

Recommended scale from client design doc:

- Display 1: Industry Bold, 48px
- Heading 1: Inter Bold, 32px
- Body: Inter Medium, 16px, 150% line height
- Data/table text: Inter Regular, 14px

## Template layouts to recreate

Initial layouts needed for generator:

1. Title / intro slide
2. Agenda / direction slide
3. Numbers / metric-heavy slide
4. Market intelligence / chart-table slide
5. Insight slide with large stat cards
6. Platform overview slide
7. Problem / solution slide
8. Workflow/process slide
9. Screenshot/product placeholder slide
10. Closing / CTA slide

## Current implementation direction

Use the received client resources to build a reusable Truckstop template config and layout renderer.

The generator should apply:

- Truckstop logo
- Truckstop red accent system
- Dark onyx headings
- Inter/Industry typography rules
- 16:9 widescreen slide size
- Modular cards/stat blocks
- High-contrast section labels
- Editable text boxes, shapes, and tables

## Next build step

Create a reusable template config, likely:

`templates/truckstop/template_config.json`

Then update the PPTX generator so each slide type maps to Truckstop-styled layouts.
