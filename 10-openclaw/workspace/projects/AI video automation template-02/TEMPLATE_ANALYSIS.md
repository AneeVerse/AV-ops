# AI video automation template-02

Source video: `source_video.mp4`  
Duration: **18.23s**  
Format: **1080×1920 vertical, 30fps**  
Audio: AAC track exists, but speech transcription returned only noise/unclear text, so this template should be treated as **visual-first with optional music/SFX/VO**.

## 1. What this template is

A vertical B2B SaaS/product explainer ad using:

- Large bold benefit-led headlines
- Red highlight rectangles for the key phrase
- Product UI screenshots/mockups
- Real-world industry footage
- Fast modular pacing
- Clean branded end card

This is a good reusable template for software products, marketplaces, logistics tools, dashboards, SaaS features, and workflow automation demos.

---

## 2. Scene structure

| Time | Module | Visual | Copy pattern |
|---:|---|---|---|
| 0.0–4.6s | Opening product benefit | White/gray background + product UI browser mockup | `Find [benefit] without leaving [product/category].` |
| 4.6–8.5s | Real-world reach/outcome | Aerial truck/road footage | `Reach more [users].` + red bar: `[Outcome faster].` |
| 8.5–12.1s | Problem-solution UI proof | Product dashboard/table UI | `[Problem]? Get more [solution].` |
| 12.1–16.8s | Product/feature announcement | Industry footage | `Introducing [Feature/Product] by [Brand].` |
| 16.8–18.2s | End card | White background + logo | Brand/logo only, optional CTA |

Detected major visual cuts: around **4.6s** and **12.1s**. Other motion is mostly internal reframing/panning.

---

## 3. Visual style rules

### Canvas
- 9:16 vertical social format
- Recommended: 1080×1920, 30fps
- Duration target: 18–22 seconds

### Color system
- Background: white / very light gray
- Primary text: black / charcoal
- Accent: strong brand red
- Highlight text: white inside red rectangle
- UI: native product colors, shown inside rounded browser cards

### Typography
- Bold condensed or heavy sans-serif headline
- Large headline, top-left aligned
- Supporting copy smaller but still readable
- Keep each headline short: **5–8 words per line max**

### Signature design element
Use a **red rectangle highlight bar** behind one key phrase in every main scene.

Examples from source:
- `the load board.`
- `Cover loads faster.`
- `visibility.`
- `Truckstop.com.`

### Background pattern
- Subtle pale red chevron/arrow pattern on white scenes
- Keep low opacity so it supports, not distracts

---

## 4. Motion system

Use simple, repeatable motion instead of complex animation:

1. **UI slide-in / crop-pan**
   - Browser mockup enters from bottom or side
   - Slight pan/zoom across dashboard/map/table

2. **Hard cuts between modules**
   - Clean cuts work better than overdesigned transitions

3. **Footage movement supplies energy**
   - Drone/truck footage moves behind static text

4. **Text remains stable**
   - Avoid moving the headline too much
   - Motion should come from UI/footage, not excessive text animation

5. **End card minimal**
   - White background
   - Centered logo
   - 1–1.5 seconds

---

## 5. Reusable copy formula

### Module 1 — Opening benefit
```text
[Verb] [business outcome] without leaving
[red highlight: the platform/category].

[Supporting sentence: how the product helps users move faster or reduce friction.]
```

Example:
```text
Find capacity without leaving
the load board.

Post loads, search trucks, and cover freight faster with one of the largest carrier marketplaces in freight.
```

### Module 2 — Reach/outcome
```text
Reach more [target users].
[red highlight: Achieve result faster.]

[Supporting sentence: explain distribution, access, or scale advantage.]
```

### Module 3 — Problem/solution
```text
[Hard problem]?
Get more [red highlight: solution].

[Supporting sentence optional or use UI metrics as proof.]
```

### Module 4 — Product announcement
```text
Introducing [Product/Feature] by
[red highlight: Brand/Product URL].

[Supporting sentence: estimate, automate, simplify, or improve specific workflow.]
```

### Module 5 — End card
```text
[Logo]
[Optional CTA: Learn more / Book a demo / Visit URL]
```

---

## 6. Asset requirements

Minimum assets needed per new video:

1. Brand logo — transparent PNG/SVG preferred
2. Brand color, especially accent color
3. Product screenshots or screen recordings
4. 2–3 short real-world footage clips related to the industry
5. 4 short copy blocks:
   - opening benefit
   - outcome/reach claim
   - problem-solution claim
   - product/feature intro
6. Optional audio:
   - background music
   - whoosh/cut SFX
   - voiceover

---

## 7. AI generation prompt templates

### Industry footage prompt
```text
Vertical 9:16 cinematic aerial footage of [industry scene], realistic, professional commercial ad style, smooth drone movement, clean composition, space in upper left for text overlay, natural lighting, high detail, no text, no logos.
```

### Product UI mockup prompt / render instruction
```text
Create a vertical 9:16 SaaS product ad scene on a clean white background with subtle pale red chevron pattern. Place a rounded browser window mockup in the lower half with drop shadow. Show [product screen: dashboard/map/table/search results]. Keep upper-left area empty for headline text. Modern B2B software aesthetic.
```

### End card prompt
```text
Clean white vertical 9:16 brand end card with subtle low-opacity chevron pattern in the background. Center [brand logo]. Minimal, premium B2B SaaS advertisement style.
```

---

## 8. FFmpeg/render automation plan

Recommended pipeline:

1. Prepare assets
   - `logo.png`
   - `ui_scene_01.png` / `ui_scene_03.png`
   - `footage_scene_02.mp4`
   - `footage_scene_04.mp4`
   - `music.mp3` optional

2. Generate scene clips
   - Scene 1: white background + text + UI slide/pan
   - Scene 2: footage + dark overlay + text
   - Scene 3: white background + text + UI pan
   - Scene 4: footage + text
   - Scene 5: end card

3. Concatenate scenes

4. Add music/audio

5. Export final MP4
   - 1080×1920
   - 30fps
   - H.264
   - AAC audio

---

## 9. n8n automation structure

Future n8n workflow can be:

1. Trigger: form/webhook upload
2. Inputs:
   - brand name
   - logo
   - accent color
   - product screenshots
   - industry
   - copy brief
3. AI node: generate scene copy using the formulas above
4. AI video/image node: generate or select footage
5. Worker/API node: render scenes with FFmpeg
6. Google Drive node: upload final MP4 + source package
7. Response node: return final video link

---

## 10. Template variables

```json
{
  "brand_name": "Truckstop.com",
  "accent_color": "#D71920",
  "industry": "freight/logistics",
  "duration_seconds": 18,
  "headline_1": "Find capacity without leaving",
  "highlight_1": "the load board.",
  "body_1": "Post loads, search trucks, and cover freight faster with one of the largest carrier marketplaces in freight.",
  "headline_2": "Reach more drivers.",
  "highlight_2": "Cover loads faster.",
  "body_2": "Expand access to a large community of professional drivers while keeping marketplace standards.",
  "headline_3": "Hard load? Get more",
  "highlight_3": "visibility.",
  "headline_4": "Introducing [Product] by",
  "highlight_4": "[Brand].",
  "body_4": "Estimate rates, requirements, and workflow details in seconds before you post.",
  "cta": ""
}
```

---

## 11. Template-02 summary

This template is best described as:

**“B2B SaaS marketplace/product feature ad — UI proof + real-world footage + red highlight benefit system.”**

It is cleaner, more corporate, and more product-demo oriented than template-01. Use it when the client wants a polished software/product capability video rather than a cinematic AI story video.
