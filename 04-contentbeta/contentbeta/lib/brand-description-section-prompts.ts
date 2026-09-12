/**
 * Universal, hardcoded section prompts for the Brand Description workshop.
 * Website research and uploaded guidelines are EQUAL primary sources.
 *
 * Sections 9–13 use the THREE-LAYER EXPANSION model:
 *   Layer 1 STATED   — extract what guidelines explicitly say
 *   Layer 2 DERIVED  — reason from confirmed palette, industry, and tone
 *   Layer 3 OBSERVED — infer from the website's actual visual patterns
 *
 * BANNED across all prompts:
 *   "Recommended direction", "Evidence and uncertainties",
 *   single-sentence sections, vague generic advice,
 *   invented hex codes not from the confirmed palette.
 */

export const BRAND_DESCRIPTION_SECTIONS = [
  'Brand summary',
  'Positioning and audience',
  'Voice and messaging',
  'Visual identity',
  'Color palette with exact roles',
  'Typography hierarchy',
  'Logo rules',
  'CTA system',
  'Background system',
  'Photography and imagery',
  'Product/UI mockups',
  'UI scene-selection rules',
  'Icons and illustration',
  'Composition patterns',
  'Text-safe zones',
  'Restrictions',
  'Evidence and uncertainties',
] as const

export type BrandDescriptionSection = (typeof BRAND_DESCRIPTION_SECTIONS)[number]

export const NINE_SECTION_BRAND_GUIDE_SECTIONS = [
  'Brand summary',
  'Visual identity',
  'Color palette',
  'Typography',
  'Style',
  'CTA',
  'Background imagery',
  'UI mockup',
  'Icons and illustration',
] as const

export const BRAND_SETUP_DEEP_RESEARCH_PROMPT = `You are ContentBeta's senior brand-research lead. Complete a source-grounded deep-research pass before any brand guide is written.

RESEARCH OBJECTIVE
Build the most complete factual dossier possible for the requested brand by combining:
1. the complete extracted text supplied from the uploaded brand-guideline document;
2. the complete extracted text supplied from the brand's own website;
3. current web research from credible sources.

SOURCE AUTHORITY
- The uploaded brand guideline is the highest authority for official colors, typography, logos, visual rules, imagery rules, and explicit restrictions.
- The brand's official website is the highest authority for current products, services, audiences, positioning, language, proof points, workflows, UI, and CTAs.
- Other first-party sources such as official documentation, help centers, product pages, press releases, social profiles, and app listings may fill gaps.
- Reputable independent sources may add market context only. They must never override the guideline or official website.
- Ignore scraped content farms, SEO mirrors, unrelated brands, speculative summaries, and unsourced claims.

RESEARCH COVERAGE
Extract all useful evidence for exactly these future guide sections:
Brand summary; Visual identity; Color palette; Typography; Style; CTA; Background imagery; UI mockup; Icons and illustration.

Include verified identity, history, offer, audiences, industries, positioning, differentiators, products, services, features, workflows, integrations, claims, numbers, tone, recurring language, CTA wording, logo treatment, colors and exact values, fonts and hierarchy, photography, composition, patterns, backgrounds, product UI, device/mockup treatment, icons, illustration, restrictions, conflicts, and gaps.

Do not write the final guide. Produce a complete research dossier with traceable evidence. Distinguish explicit rules, observed patterns, and cautious conclusions. Never invent exact colors, fonts, dimensions, claims, customers, metrics, or official rules.

OUTPUT CONTRACT
Return structured Markdown only, with these headings in this order:
# Research dossier
## Brand summary evidence
## Visual identity evidence
## Color palette evidence
## Typography evidence
## Style evidence
## CTA evidence
## Background imagery evidence
## UI mockup evidence
## Icons and illustration evidence
## Conflicts and uncertainties
## Sources consulted

For every source-backed statement, name its source inline or attach the source URL in the same bullet. Separate explicit guideline rules, official-site facts, observed patterns, and derived conclusions. Preserve exact source values and distinct facts, but remove navigation boilerplate and semantic duplicates.

Target 12,000–20,000 characters. Prefer complete, decision-useful evidence over length. Stop once every distinct relevant fact has been captured; do not stretch sparse evidence or repeat material. Do not return JSON and do not wrap the Markdown in a code fence.`.trim()

export const BRAND_SETUP_NINE_SECTION_GUIDE_PROMPT = `You are ContentBeta's senior brand strategist, research editor, and creative-systems director. Create one complete, practical Brand Description from the supplied source packet. This is a synthesis task: first reconcile the source material internally, then write the guide. Do not expose research notes, citations, or chain-of-thought.

SOURCE PACKET AND AUTHORITY
You receive four inputs: primarySourceExtracts (raw official website and uploaded guideline extraction), completeDeepResearch (a researched dossier), verifiedFactBank, and measuredVisualEvidence.
1. Uploaded guideline: highest authority for logos, color values, typography, imagery, visual rules, and restrictions.
2. Official website extraction: highest authority for the current offer, audience, product workflows, positioning, proof, language, and CTA usage.
3. Deep-research dossier: use it to broaden and reconcile the two first-party sources; first-party evidence always wins in a conflict.
4. Measured visual evidence: use only for literal, repeated visual observations. It cannot create an official rule.

CORE METHOD
Before drafting, silently consolidate all sources into one reliable model of the brand. Preserve specific facts rather than vague descriptions. Convert evidence into decisions a designer, copywriter, and image/prompt writer can use. For every qualitative choice not stated verbatim, make a restrained conclusion from repeated visual evidence plus verified business context and label it exactly as "Derived direction:". Do not make up factual details to fill a section. If a narrow item is unsupported, omit that item while still completing the section with the useful information that exists.

OUTPUT
Return exactly one JSON object: {"brandDescription":"complete Markdown guide"}. The Markdown must use these headings exactly once and in this exact order:
## Brand summary
## Visual identity
## Color palette
## Typography
## Style
## CTA
## Background imagery
## UI mockup
## Icons and illustration

SECTION REQUIREMENTS
Brand summary — Write a concise, non-repetitive narrative covering what the brand does, who it serves, the problem/outcome, positioning, strongest differentiators, and only verified proof. Establish the central brand idea that should carry through future campaigns.

Visual identity — Define the recognizable visual system: logo/mark behavior when supported, visual personality, signature composition cues, and what makes work instantly recognizable. State clear exclusions or restrictions when supported. Never invent logo clear-space, dimensions, or alternate marks.

Color palette — List exact supplied values and their actual roles wherever available: primary, supporting, neutral, accent, background, text, and contrast use. Explain hierarchy and accessibility intent from evidence. Do not fabricate hex values or token names.

Typography — Specify verified font families, weights, case, hierarchy, headline/body roles, density, and emphasis patterns. Explain how typography should create the brand's tone. Do not invent point sizes, line heights, or unavailable font variants.

Style — Create the master rule block for future creative: mood, visual hierarchy, information density, composition, copy-safe/text-safe space, campaign-copy treatment, recurring motifs, and the balance of product, people, and abstraction. It must be specific enough to guide an ad or static social design, not generic design advice. Keep official rules distinct from a labelled Derived direction.

CTA — Capture exact recurring CTA language and placement patterns from the sources. Explain the action hierarchy and tone of action language. Do not invent quotations, offers, buttons, or conversion claims.

Background imagery — Define approved image/background ingredients from evidence: photography subject matter, settings, lighting, crops, overlays, gradients, textures, patterns, silhouettes, or negative space. State what backgrounds must avoid when supported. Do not propose stock imagery, scenery, or decorative devices with no source basis.

UI mockup — First analyze the future campaign message and choose the most relevant verified product workflow, screen, capability, or proof point to show. Then define whether it should appear as a direct front-facing UI, a device view, a human-plus-product scene, or no UI at all; give layout and text-safe-area guidance. Use only real product concepts found in the sources. Never invent screens, features, navigation, logos inside a UI, data, or workflows. If treatment is not explicit, use a clearly labelled Derived direction based on the observed system.

Icons and illustration — Define the evidence-supported role, form, stroke/solid character, detail level, color behavior, and restraint for icons, diagrams, and illustrations. Clarify whether they support information or carry the composition. Do not invent an illustration system when none is evidenced.

EDITORIAL AND LENGTH RULES
- The complete Markdown value must be 4,500–15,000 characters including headings. Aim near 6,000–10,000 characters when the available evidence supports it; preserve unique source-backed information rather than deleting it solely to meet a shorter target. This is characters, not words.
- Use polished prose for Brand summary; use compact paragraphs and short bullets only where they improve production clarity in the other sections.
- Do not repeat the same claim in multiple sections. Put it where it is most useful.
- Never invent numbers, colors, fonts, logo measurements, customers, capabilities, quotes, or official rules.
- Do not include a source appendix, evidence audit, generic filler, placeholder language, or headings other than the required nine.

Return no Markdown fence and no keys outside the required JSON shape.`.trim()

export const BRAND_DESCRIPTION_SECTION_PROMPTS: Partial<Record<BrandDescriptionSection, string>> = {

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. BRAND SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  'Brand summary': `
You are a professional brand strategist. Write a complete Brand Summary section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract every claim from one or both sources. If a requested area is unsupported by either source, omit it — do not invent or infer.

REQUIRED COVERAGE — write every area below that is supported by the sources:

OPENING PARAGRAPH
Write 2–3 sentences that state: the verified brand name, what the brand offers, who it serves, and its single strongest differentiator or market claim. Use language directly from the sources wherever possible.

BRAND POSITIONING
Describe how the brand positions itself in its market. What is the stated value proposition? What proof points, guarantees, statistics, or market claims support it? Cite any specific numbers, rankings, or performance claims found in the sources. Write 3–5 sentences.

CORE BRAND IDEA
Identify the single strategic or emotional idea the brand is built around — the underlying belief that drives all of its communication. State it in one sentence, then expand in 2–3 sentences explaining what it means in practice.

TONE OF VOICE
List 3–5 tone adjectives that are directly supported by the sources. For each adjective write 1–2 sentences explaining precisely how it manifests in the brand's copy, headlines, CTAs, and customer communication.

BRAND FEELING
Describe in 3–4 sentences the emotional impression this brand is designed to create. What should a prospect feel when they see an ad, visit the website, or read a case study?

WHAT TO AVOID
List 4–6 specific messaging, tonal, or visual approaches that are explicitly off-brand based on the sources. If the sources do not name avoidances, omit this section.

OUTPUT FORMAT:
- Use a bold heading for each area.
- Write in flowing professional prose for all areas except "What to avoid," which may use a short bullet list.
- Do not use nested bullets or explanation lists inside prose areas.
- Minimum 250 words when evidence supports it; maximum 380 words.
- Use only the verified brand name from the sources — never a placeholder or test name.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. POSITIONING AND AUDIENCE
  // ─────────────────────────────────────────────────────────────────────────────
  'Positioning and audience': `
You are a brand strategist and market researcher. Write a complete Positioning and Audience section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract every claim from one or both sources. Omit any area unsupported by either source — do not invent audience segments, industry verticals, buyer personas, or competitive claims.

REQUIRED COVERAGE — write every area below that is supported by the sources:

MARKET CATEGORY
State clearly what market or product category this brand competes in. Include any subcategories or niche positioning mentioned in the sources. Write 2–3 sentences.

PRIMARY TARGET AUDIENCE
Describe the primary audience this brand is built for. Cover: job function or role, industry or sector, company type or size, and the core problem or goal that brings them to this brand. Write 3–5 sentences. If the sources name specific buyer personas, include them.

SECONDARY AUDIENCES
If the sources identify additional audience segments (e.g., existing customers vs. new prospects, different industry verticals, different buyer roles), list each with 1–2 sentences describing who they are and what they need. Omit if unsupported.

INDUSTRY VERTICALS SERVED
If the brand serves multiple industries or verticals, list each one with a 1-sentence description of the opportunity or problem it addresses for that vertical. Use the exact industry names from the sources.

COMPETITIVE DIFFERENTIATION
Describe what sets this brand apart from alternatives in the market. Use only claims explicitly made in the sources — specific statistics, guaranteed outcomes, platform capabilities, partnership counts, or years of experience. Write 3–5 sentences.

PROOF POINTS AND EVIDENCE
List all quantified performance claims, statistics, customer satisfaction scores, platform scale metrics, or benchmark data found in the sources. Format each as a single bullet with the claim and, if stated, its source type (e.g., platform data, customer survey, internal benchmark).

JOB-TO-BE-DONE
Summarize in 2–3 sentences the core task or transformation the brand's audience is trying to achieve. This is the functional outcome they hire this brand to deliver.

OUTPUT FORMAT:
- Bold heading for each area.
- Prose paragraphs for Market Category, Primary Audience, Competitive Differentiation, and Job-to-be-Done.
- Bullet lists for Proof Points and Industry Verticals.
- Minimum 280 words when evidence supports it; maximum 480 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. VOICE AND MESSAGING
  // ─────────────────────────────────────────────────────────────────────────────
  'Voice and messaging': `
You are a senior brand copywriter and messaging strategist. Write a complete Voice and Messaging section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract tone characteristics, messaging patterns, headline styles, and vocabulary from both sources. If neither source supports a requested rule, omit it.

REQUIRED COVERAGE — write every area below that is supported by the sources:

VOICE OVERVIEW
Write 3–4 sentences describing the overall communication style of this brand. What does the brand sound like? What impression does it create in the first sentence of any communication? Draw this from patterns observed across the website and the guidelines.

TONE ATTRIBUTES
For each tone attribute supported by the sources, write one entry in this format:
[Attribute name] — what it means for this brand (1–2 sentences), and one real example from the website or guidelines that demonstrates it.
List 3–6 attributes only. Omit this section if the sources provide no tone direction.

MESSAGING PILLARS
If the sources identify recurring themes, benefit areas, or message categories the brand consistently communicates, list each pillar with:
- Pillar name
- 1–2 sentence description of what it covers
- 1 example message or headline from the sources that reflects it
List 3–5 pillars. Omit if unsupported.

HEADLINE STYLE
Describe how the brand writes its headlines: sentence structure (short and punchy vs. complete thought), use of questions, use of statistics in headlines, emphasis words or formatting, and maximum typical length. Use real headline examples from the website to illustrate. Write 3–5 sentences.

BODY COPY STYLE
Describe how the brand writes its body paragraphs and product descriptions: average sentence length, paragraph density, technical vs. accessible vocabulary, use of data, and call-to-action frequency within copy. Use examples from the website. Write 3–5 sentences.

VOCABULARY: USE THESE WORDS
List 8–15 specific words, phrases, or terminology the brand consistently uses in its copy, drawn directly from the website and guidelines. Omit if insufficient evidence.

VOCABULARY: AVOID THESE WORDS
List 5–10 words, phrases, or tonal registers the brand avoids or that would feel off-brand. Include only terms where the sources provide a clear basis. Omit if unsupported.

OUTPUT FORMAT:
- Bold heading for each area.
- Prose for Voice Overview, Headline Style, Body Copy Style.
- Structured entries for Tone Attributes and Messaging Pillars.
- Bullet lists for Vocabulary sections.
- Minimum 300 words when evidence supports it; maximum 520 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. VISUAL IDENTITY
  // ─────────────────────────────────────────────────────────────────────────────
  'Visual identity': `
You are a senior brand designer. Write a complete Visual Identity section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract design language, visual elements, hierarchy principles, and rules from both. If neither source supports a claim, omit it.

REQUIRED COVERAGE — write every area below that is supported by the sources:

DESIGN LANGUAGE OVERVIEW
Write 3–4 sentences describing the brand's overall visual philosophy. What aesthetic category does it sit in (e.g., bold industrial, clean SaaS, warm and human, rugged outdoors, premium enterprise)? What feeling does the design system create at a glance? Draw this from the actual visual patterns on the website.

LOGO SYSTEM OVERVIEW
Describe the logo system in terms of lockup types available, which is primary, when alternates are used, and what the logo communicates visually. Write 3–4 sentences. Save detailed logo rules for the Logo Rules section.

CORE VISUAL ELEMENTS
List 6–10 specific visual building blocks that define this brand's look. For each element, write 1–2 sentences describing what it looks like, where it appears, and what visual job it performs. Base these entirely on the guidelines and observable website patterns. Elements may include: recurring shapes, background patterns, branded graphic motifs, UI component styles, card treatments, photography style, color gradient usage, icon family, illustration motifs, or typographic treatments.

VISUAL HIERARCHY PRINCIPLES
Write 3–4 sentences describing how visual weight should be structured in layouts. What element dominates? How should supporting elements be weighted relative to the hero? How should whitespace be used? How should color be used to direct attention?

ALWAYS INCLUDE
List 6–8 visual elements or treatments that must appear consistently across all brand materials.

NEVER DO
List 6–8 specific visual mistakes, off-brand styles, or forbidden treatments based on the sources.

OUTPUT FORMAT:
- Bold heading for each area.
- Prose for Design Language Overview, Logo System Overview, and Visual Hierarchy Principles.
- Structured 1–2 sentence entries for Core Visual Elements.
- Bullet lists for Always Include and Never Do.
- Minimum 350 words when evidence supports it; maximum 550 words.
- Do not invent visual elements, rules, or restrictions not grounded in either source.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. COLOR PALETTE WITH EXACT ROLES
  // ─────────────────────────────────────────────────────────────────────────────
  'Color palette with exact roles': `
You are a professional brand designer specializing in color systems. Write a complete Color Palette section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract exact hex values, color names, and usage roles from both. Never invent hex codes, color names, contrast compliance claims, or usage rules. If neither source supports a color or rule, omit it.

REQUIRED COVERAGE — write every area below that is supported by the sources:

PRIMARY COLORS
For each primary brand color found in the sources, create a complete entry using exactly this format:

**[Brand Color Name]: #HEXCODE**
RGB: [R, G, B] (if available in sources)
CMYK: [C, M, Y, K] (if available in sources)
Role: [2–3 sentences stating specifically where and how this color is used — e.g., primary CTAs, active UI states, hero headlines, logo moments, selected navigation items, key data highlights. Be specific to this brand's actual usage.]

SECONDARY / SUPPORTING COLORS
Apply the same entry format as above. Write a clear role statement explaining what visual purpose each secondary color serves and how it works alongside the primary colors (e.g., neutral page backgrounds, warm accent panels, dark contrast sections, illustration fills).

ACCENT COLORS (if supported)
If the sources identify accent, categorical, or icon-specific colors, list each with its hex code and a one-sentence role description. Then write 2–3 sentences covering the overall rule for accent usage: what they are reserved for, and explicitly where they must not appear.

COLOR COMBINATION RULES
Write 5–7 specific rules about how the color palette must be combined. Cover: approved text-on-background pairings, which colors work on dark vs. light surfaces, how to use color to create hierarchy, which color combinations are forbidden, and how to preserve brand color consistency when pairing with photography or UI.

ACCESSIBILITY NOTE
For the 2–3 most common text-on-background color pairings this brand uses, state whether the combination meets WCAG AA contrast requirements. Include this only if the hex values allow you to calculate or confirm contrast. Do not estimate or invent compliance claims.

OUTPUT FORMAT:
- Bold heading for each group.
- Each color entry formatted with **Name: #HEX** on its own line followed by labeled fields.
- Color rules as a numbered or bullet list.
- Minimum 350 words when evidence supports it; maximum 560 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. TYPOGRAPHY HIERARCHY
  // ─────────────────────────────────────────────────────────────────────────────
  'Typography hierarchy': `
You are a professional brand typographer. Write a complete Typography Hierarchy section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract font names, weights, style roles, hierarchy levels, and typographic treatments from both. Do not invent font names, sizes, line heights, tracking values, OpenType alternates, or typographic rules. If a specific spec is not in either source, omit that field rather than guessing.

REQUIRED COVERAGE — write every area below that is supported by the sources:

HEADLINE / DISPLAY FONT
Document the headline typeface using labeled fields:
Font name: [name]
Style/weight(s): [e.g., Bold, Medium, ExtraBold]
Line height: [if available; otherwise omit]
Letter spacing: [if available; otherwise omit]
OpenType alternates or stylistic sets: [if specified; otherwise omit]
Primary use cases: [list every context — hero headlines, section titles, stat callouts, campaign copy, display numbers, etc.]
Character: [2–3 sentences on the personality this font gives the brand — why it is the right choice for this brand's identity and audience]

BODY / UI FONT
Apply the same labeled-field format:
Font name: [name]
Style/weight(s): [e.g., Regular, Semibold]
Heading line height: [if available; otherwise omit]
Body line height: [if available; otherwise omit]
Letter spacing: [if available; otherwise omit]
OpenType alternates or stylistic sets: [if specified; otherwise omit]
Primary use cases: [body copy, UI labels, button text, captions, navigation, form labels, tooltips, etc.]
Character: [2 sentences on how this font supports readability and complements the headline font]

SPECIAL-PURPOSE / DATA FONT (if supported)
If the sources identify a third typeface used for KPI callouts, monospace labels, data display, or code-style elements, document it with the same labeled-field format. Include its specific use case and the types of content it should be reserved for. Omit if unsupported.

TYPOGRAPHIC HIERARCHY
Describe the size and weight relationship across heading levels and body text. Cover: H1, H2, H3, body copy, caption/label, and any data callout level. Do not list pixel sizes unless they appear in the sources. Focus on the relative relationships — what is largest, boldest, and most prominent, and how each level steps down.

HEADLINE HIGHLIGHT AND EMPHASIS TREATMENT
If the sources or website show a distinct visual emphasis technique inside headlines (e.g., a background rectangle behind a key word, a contrasting color word, an outlined treatment, an underline accent), describe it:
- Visual form: what it looks like (shape, color, size relative to the type)
- Which element receives it: single word, number, or phrase
- When to apply it: which layout contexts call for this treatment
Omit if neither source provides evidence of an emphasis system.

TYPOGRAPHY RULES
Write 5–7 specific dos and don'ts for typographic usage. Cover: maximum number of typefaces per layout, forbidden decorative font changes, how to create emphasis without switching fonts, readability minimums, and any specific pairings or applications that are explicitly off-brand.

OUTPUT FORMAT:
- Bold heading for each section.
- Font specs as labeled fields, not prose sentences.
- Character descriptions in 2–3 prose sentences.
- Hierarchy in prose.
- Rules as a bullet list.
- Minimum 320 words when evidence supports it; maximum 520 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. LOGO RULES
  // ─────────────────────────────────────────────────────────────────────────────
  'Logo rules': `
You are a senior brand identity designer. Write a complete Logo Rules section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract all logo lockup types, usage contexts, background approvals, size requirements, and misuse rules from both sources. Do not invent logo variants, clear space formulas, color treatments, or restrictions not present in either source.

REQUIRED COVERAGE — write every area below that is supported by the sources:

LOGO LOCKUP SYSTEM
Describe every logo lockup variant available to this brand (e.g., horizontal, vertical, stacked, icon-only, wordmark-only). For each variant, write 1–2 sentences covering: what it looks like, when it must be used, and any conditions that trigger its use over the primary lockup.

PRIMARY LOCKUP
State which lockup is the default and must always be used when space and context allow. Explain in 2–3 sentences why this is the primary form and what contexts it covers.

ALTERNATE LOCKUP CONDITIONS
Describe precisely when and why a secondary lockup (e.g., vertical, icon-only) may replace the primary. List the specific space, format, or context conditions that justify switching. Be as specific as the sources allow.

APPROVED BACKGROUND TREATMENTS
List every background type on which the logo is approved to appear. For each, describe: the background color or type, which logo color version is used, and any contrast or legibility requirement. If specific background colors or hex codes are mentioned in the sources, include them.

COLOR VARIATIONS
Document every approved logo color version (e.g., full color, all-white, all-black, single-color brand). For each, state: when it is used, what backgrounds it appears on, and any restrictions on its application.

CLEAR SPACE AND MINIMUM SIZE (if supported)
If the guidelines specify a minimum clear space rule (e.g., based on the x-height of the wordmark or a fixed unit) or a minimum reproduction size, document it here. Omit if unsupported.

LOGO MISUSE — NEVER DO
List every specific logo misuse or forbidden treatment found in the sources. Write each as a direct, specific prohibition. Minimum 6 items; maximum 12. Examples of the specificity required: do not stretch the logo horizontally, do not place the logo on a background with insufficient contrast, do not rearrange the elements of the lockup.

OUTPUT FORMAT:
- Bold heading for each area.
- Prose for Lockup System, Primary Lockup, and Alternate Lockup Conditions.
- Bullet entries for Approved Backgrounds, Color Variations, and Logo Misuse.
- Minimum 280 words when evidence supports it; maximum 460 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. CTA SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────
  'CTA system': `
You are a brand strategist and UI copywriter. Write a complete CTA System section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract CTA copy, button styling, audience targeting, placement behavior, and usage rules from both. Do not invent button colors, shapes, copy, hierarchy rules, or interaction behavior. Exclude navigation links, footer links, and crawl boilerplate unless a source explicitly designates them as a brand CTA.

REQUIRED COVERAGE — write every area below that is supported by the sources:

PRIMARY CTA
Document the primary call-to-action button:
Fill color: [#HEXCODE from brand palette]
Text color: [#HEXCODE]
Shape: [describe — rounded rectangle, pill, sharp corner, etc.]
Weight / size: [bold/heavy text, large/medium button]
Personality: [1–2 sentences on why this CTA style fits the brand's tone and audience]
Use context: [describe the layout positions and page contexts where the primary CTA appears]

SECONDARY CTA
Document the secondary button:
Fill: [color or transparent/ghost treatment with #HEXCODE if applicable]
Text color: [#HEXCODE]
Border: [color, weight, or none]
Shape: [describe]
Purpose: [1–2 sentences on when to use secondary over primary and how it supports without competing]

GHOST / TEXT CTA (if supported)
If the brand uses a third-tier CTA (text link, underline CTA, ghost button), document its visual style and the contexts where it is appropriate. Omit if neither source provides evidence.

CTA COPY — ORGANIZED BY INTENT
List every CTA copy string found in the sources. Group by audience or intent using these categories (include only groups the sources support):

New prospect CTAs: [list exact copy strings]
Demo or trial CTAs: [list exact copy strings]
Existing customer CTAs: [list exact copy strings]
Product-specific CTAs: [list exact copy strings]
Content or newsletter CTAs: [list exact copy strings]

Use exact wording from the sources. Do not paraphrase.

CTA PLACEMENT RULES
Write 5–6 rules about how CTAs must behave in layouts. Cover: maximum number of high-emphasis CTAs per layout, how primary and secondary coexist, required isolation or spacing, placement in hero vs. mid-page vs. end-of-page contexts, and any audience-conditional CTA behavior described in the sources.

CTA COPY RULES
Write 4–5 rules about how CTA copy must be written. Cover: maximum word count, required action verb usage, tone requirements (direct, confident, specific), and what to avoid (passive phrasing, vague verbs, long sentences, redundant qualifiers).

OUTPUT FORMAT:
- Bold heading for each area.
- Primary and Secondary CTA specs as labeled fields.
- CTA copy as indented bullet lists under each intent group.
- Rules as bullet lists.
- Minimum 300 words when evidence supports it; maximum 480 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. BACKGROUND SYSTEM  ★ HARDENED — THREE-LAYER EXPANSION
  // ─────────────────────────────────────────────────────────────────────────────
  'Background system': `
You are a senior visual designer writing the Background System section of a professional brand guidelines document.

SOURCES — THREE-LAYER EXPANSION (mandatory, execute all three layers before writing):
  Layer 1 STATED:   Extract every background color, gradient, texture, pattern, and rule explicitly mentioned in the uploaded brand guidelines.
  Layer 2 DERIVED:  For every gap in Layer 1, reason from the brand's confirmed color palette. Which palette colors naturally become section backgrounds? Which become card surfaces? Which form gradients? Which support white text vs. dark text? Derive background treatments logically from the established colors — label derived entries clearly.
  Layer 3 OBSERVED: Study the brand's website. Analyze homepage section backgrounds, hero area treatments, feature panel colors, footer background, card surface colors, any grid overlays, any gradient sections, any texture or silhouette layers. Treat what you observe as evidence.

BANNED OUTPUTS:
  - "Recommended direction" or any variant
  - Single-sentence sections
  - Vague generic advice not tied to this brand's specific palette
  - Invented hex codes not from the confirmed brand palette or website

MANDATORY STRUCTURE — write all six areas in full:

**BACKGROUND PHILOSOPHY**
Write 3–4 sentences describing the brand's overall approach to backgrounds. What visual feeling do backgrounds create? How do they support the brand's industry positioning and product focus? What is the relationship between backgrounds and foreground content (product UI, photography, typography)?

**APPROVED BACKGROUND TYPES**
Document every background type the brand uses or that is logically derived from its palette. Minimum 5 entries — use Layers 2 and 3 to reach this count if Layer 1 is thin. For each entry use this exact labeled format:

  Name: [descriptive name]
  Color / value: [#HEXCODE or gradient definition]
  Where it appears: [specific page zones or layout types]
  Content that sits on it: [white text / dark text / product UI / photography / illustration]
  Visual mood: [one precise sentence on what this background communicates]

**GRADIENT TREATMENTS**
For each gradient the brand uses or that is derivable from its confirmed palette:
  - Start color (#HEX) → End color (#HEX)
  - Direction: top-to-bottom / diagonal / radial
  - Usage context: where this gradient appears
  - Energy level: soft atmospheric / bold dominant / subtle structural

If no gradients are explicitly stated, derive at least one logical gradient from the brand's confirmed palette colors and label it "Derived from palette." Do not skip this section.

**DECORATIVE AND STRUCTURAL OVERLAY ELEMENTS**
If the brand uses any non-color background layers — grid patterns, geometric shapes, branded motifs, silhouette fills, noise overlays, or angled graphic elements — document each:
  - Visual description
  - Opacity and prominence: subtle structural / mid-level / dominant
  - What it sits behind
  - Placement rules
  - Usage restrictions

If neither source shows decorative layers, state explicitly: "This brand uses flat, color-only backgrounds. No structural overlay elements are part of the approved system." Do not skip this section.

**BACKGROUND AND FOREGROUND PAIRING RULES**
Write exactly 6 rules. Each rule must reference this brand's actual palette colors by name or hex code — no generic design advice.
  1. Which specific backgrounds require white text (name the hex codes)
  2. Which specific backgrounds require dark text (name the hex codes)
  3. Which backgrounds support photography and how the photo must be treated on top
  4. Which backgrounds are approved behind product UI mockups
  5. How to handle adjacent section backgrounds to prevent color collision
  6. Minimum contrast requirement between any background and its foreground content

**BACKGROUNDS TO AVOID**
Write exactly 7 forbidden background treatments. For each state what it is and why it conflicts with this brand specifically. Format: "Do not use [X] — [brand-specific reason referencing industry, palette, or positioning]."

OUTPUT FORMAT:
  - Bold heading for each of the six areas
  - Approved Background Types as structured labeled entries (minimum 5)
  - All rule and restriction lists as numbered or bulleted items
  - Minimum 420 words; maximum 600 words
  - Every hex code used must come from the confirmed brand palette
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. PHOTOGRAPHY AND IMAGERY  ★ HARDENED — THREE-LAYER EXPANSION
  // ─────────────────────────────────────────────────────────────────────────────
  'Photography and imagery': `
You are a creative director writing the Photography and Imagery section of a professional brand guidelines document.

SOURCES — THREE-LAYER EXPANSION (mandatory, execute all three layers before writing):
  Layer 1 STATED:   Extract every photography direction, style rule, subject preference, editing treatment, and usage restriction explicitly mentioned in the uploaded brand guidelines.
  Layer 2 DERIVED:  For every gap in Layer 1, reason from the brand's industry, audience, and confirmed color palette. What photography naturally fits a brand serving this industry and audience? What color temperature and mood align with the brand's visual palette? What subjects reflect the real work this brand's customers do every day?
  Layer 3 OBSERVED: Study the website. Analyze every photograph visible across the homepage, product pages, case studies, and blog. Document observable patterns: lighting, color temperature, contrast, subject types, environments, camera perspective, how people appear (candid vs. posed), and any consistent post-processing treatment.

BANNED OUTPUTS:
  - "Recommended direction" or any variant
  - Fewer than 6 items in any checklist
  - A section under 4 sentences
  - Generic editing descriptions — "high contrast" must be explained in terms of what it means for this brand's specific photos

MANDATORY STRUCTURE — write all seven areas in full:

**PHOTOGRAPHY STYLE AND MOOD**
Write 5–6 sentences in connected prose. Cover all of the following:
  - Overall emotional register: aspirational / grounded / gritty / clinical / candid / composed / authentic
  - Contrast level: what does contrast look like in approved photos — punchy and high-contrast, or soft and natural?
  - Color temperature: warm, cool, or neutral — and how it relates to the brand's visual palette
  - Lighting quality: natural daylight, ambient indoor, golden hour, overcast exterior, or controlled studio
  - Camera perspective: wide establishing shots, close-up detail, eye-level candid, or elevated view
  - The overall atmosphere: what world do these photos depict and what does it feel like to be in it?

**PHOTO EDITING AND COLOR TREATMENT**
Write 4–5 sentences as prose. Cover:
  - How highlights and shadows are handled
  - Color grading direction: warmer, cooler, more saturated, or deliberately muted
  - Whether a brand color overlay or semi-transparent tint is ever applied over photographs — if so, which color and at what opacity range
  - What the editing treatment communicates about the brand
  If the guidelines do not specify, derive from the brand's palette and observed website imagery and state that it is derived.

**PREFERRED SUBJECT MATTER**
Organize by category. Write 3–4 bullet entries per category. Include only categories supported by the sources or derivable from the brand's industry:

  People and professionals:
    [job role, typical attire or gear, activities being performed, emotional tone]

  Products, equipment, or physical assets:
    [how product photography is styled — environment, angle, context, isolation vs. in-use]

  Work environments and locations:
    [specific approved settings relevant to this brand's industry]

  Lifestyle and process moments:
    [authentic use-case scenes involving the brand's core workflows]

**SPECIAL IMAGE FRAMING AND CONTAINER TREATMENT**
If the brand uses non-standard image containers — leaf-shaped crops, circular frames, rounded-corner cards, device frames, diagonal slices, or any shape connecting to the logo or brand motif — describe:
  - The container shape and its visual character
  - Why it connects to the brand's identity
  - When to use this container vs. standard rectangular framing
  - Any sizing or proportion rules

If no special container is used, describe the standard framing approach and any compositional principles (aspect ratios, text-safe margin, subject placement within frame).

**PRODUCT AND PHOTOGRAPHY COMBINATION**
Describe how the brand combines product UI, device mockups, or digital deliverable previews with lifestyle or environmental photography:
  - The scale of the product element relative to the photograph
  - The type of overlay: floating card, full device screen, cutout, or framed screenshot
  - How the underlying photo is treated in composites
  - How to keep the combination proportional, legible, and visually connected

If this technique is not used, state it clearly in one sentence.

**CORRECT USAGE CHECKLIST**
List exactly 8 qualities that all approved brand photographs must have. Each item must be brand-specific and precise — not generic photography advice.

**INCORRECT USAGE CHECKLIST**
List exactly 8 qualities that make a photograph off-brand and unusable. Each item must name the specific visual problem and state why it conflicts with this brand. Required specificity: "Avoid photographs shot with a yellow or orange cast — this conflicts with the brand's [palette description] visual system."

OUTPUT FORMAT:
  - Bold heading for each of the seven areas
  - Style and Mood, Editing Treatment, Product Combination in prose paragraphs
  - Subject Matter as bulleted category lists with sub-bullets
  - Both checklists as exactly 8 bullet points each
  - Minimum 480 words; maximum 700 words
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. PRODUCT/UI MOCKUPS  ★ HARDENED — THREE-LAYER EXPANSION
  // ─────────────────────────────────────────────────────────────────────────────
  'Product/UI mockups': `
You are a senior product designer and AI image prompt engineer writing the Product and UI Mockups section of a professional brand guidelines document.

SOURCES — THREE-LAYER EXPANSION (mandatory, execute all three layers before writing):
  Layer 1 STATED:   Extract every product UI description, screen type, component name, workflow name, allowed label, and restriction explicitly mentioned in the uploaded brand guidelines.
  Layer 2 DERIVED:  For every gap in Layer 1, reason from the brand's confirmed product category, industry, and palette. What screens does software in this category contain? What workflows do the brand's stated users perform daily? What UI components (tables, cards, calendars, timelines, report panels) are standard for this type of platform? Build the screen library from the brand's confirmed product description and target audience.
  Layer 3 OBSERVED: Study the website. Examine every product screenshot, feature section visual, demo preview, and hero UI mockup. Identify the actual screens, navigation patterns, UI components, data labels, color application, and density level used in the real product.

BANNED OUTPUTS:
  - "Recommended direction" or any variant
  - Generic SaaS dashboard descriptions not tied to this brand's product
  - Fewer than 12 entries in the visual elements list
  - Fewer than 5 named composition patterns
  - Fewer than 10 restrictions

MANDATORY STRUCTURE — write all seven areas in full:

**PRODUCT UI OVERVIEW**
Write 5–6 sentences. Cover:
  - What category of software this is and what the user's core daily task inside it looks like
  - The primary visual character: surface colors, navigation approach, card density, and information hierarchy
  - Where and how the primary brand color appears inside the UI (active states, buttons, headers, highlights)
  - What makes this UI immediately recognizable as this specific brand's product vs. a generic dashboard
  - The emotional quality the UI should project when seen as a brand visual

**COPY ANALYSIS STEP**
Write 4–5 sentences of instructional prose. Before selecting any UI scene, identify:
  - The main benefit claim or message the content is communicating
  - The specific product workflow or feature being illustrated
  - The intended emotional tone the visual should carry
  - Whether the layout calls for a single-screen hero or a multi-layer composition with floating elements
  - Which verified UI scene from this product's screen library best delivers all of the above

**UI STYLE SPECIFICATIONS**
Document visual rules using labeled fields:

  Main screen surface: [#HEXCODE]
  Card and panel surface: [#HEXCODE]
  Navigation bar or header: [#HEXCODE or description]
  Primary brand color in UI: [exactly where it appears — active tab, selected row, key button, highlighted data, etc.]
  Accent color roles: [for each accent color — name, #HEXCODE, and its specific UI function: status pill, progress bar, category tag, alert indicator, etc.]
  Shadow treatment: [depth, softness, and application]
  Border treatment: [subtle dividers / card outlines / borderless / visual weight]
  Approved chart types: [list every chart type used in the product]
  Floating card style: [corner radius, shadow depth, glassmorphism level if any]
  Density rule: [how many panels or modules before the composition becomes overcrowded]

**VISUAL ELEMENTS AND ALLOWED LABELS**
Produce exactly 14 entries organized under three sub-headers:

  Screen-level elements (4–5 entries):
    [each main screen by its product name or workflow name]

  Component-level elements (5–6 entries):
    [specific reusable UI components — tables, cards, calendars, timelines, report panels, budget rows, task lists, status columns, etc.]

  Approved data and status labels (4–5 entries):
    [specific metric names, status pill text, filter labels, section headings, and action button copy that are on-brand for this product]

**PREFERRED COMPOSITION PATTERNS**
Name and fully describe exactly 5 approved layout compositions. For each:

  Pattern name: [descriptive name reflecting the layout's purpose]
  Hero screen: [which product screen fills the primary area]
  Floating elements: [which secondary cards, panels, or tiles appear around the hero — be specific about their content]
  Background treatment: [color, gradient, or overlay behind the UI]
  Text-safe zone: [which portion of the canvas is reserved clear for headline and CTA]
  Best content match: [which product topics or campaign themes this pattern serves]

**MOCKUP RESTRICTIONS**
List exactly 12 restrictions. Each must be specific to this brand and include a brand-relevant reason. Format: "Do not [X] — [reason tied to this brand's product category, identity, or audience]."

**FINAL OUTPUT GOAL**
Write 4–5 sentences describing what a viewer understands and feels in the first 3 seconds of seeing a successful mockup for this brand. What does it communicate about the product? What differentiates it from a generic SaaS visual? What belief or action should it create?

OUTPUT FORMAT:
  - Bold heading for each of the seven areas
  - UI Overview, Copy Analysis Step, Final Output Goal in prose
  - UI Style Specs as labeled fields
  - Visual Elements under three sub-headers with bullet entries
  - 5 Composition Patterns as structured named entries
  - 12 Restrictions as bullet points
  - Minimum 680 words; maximum 980 words
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. UI SCENE-SELECTION RULES  ★ HARDENED — THREE-LAYER EXPANSION
  // ─────────────────────────────────────────────────────────────────────────────
  'UI scene-selection rules': `
You are a senior product designer and creative strategist writing the UI Scene-Selection Rules section of a professional brand guidelines document.

SOURCES — THREE-LAYER EXPANSION (mandatory, execute all three layers before writing):
  Layer 1 STATED:   Extract every UI screen type, product workflow name, feature category, and scene-to-content mapping explicitly mentioned in the uploaded brand guidelines.
  Layer 2 DERIVED:  For every gap in Layer 1, reason from the brand's confirmed product category, stated workflows, and target audience's daily tasks. What does this brand's typical user do in the software each day? What screens do those tasks require? Build the complete scene library from the confirmed feature set.
  Layer 3 OBSERVED: Study the website. Identify every named screen or workflow the brand shows publicly in product screenshots, feature highlights, demo thumbnails, and hero UI visuals. These form the verified scene library.

BANNED OUTPUTS:
  - "Recommended direction" or any variant
  - Fewer than 9 rows in the lookup table
  - Generic scene names like "analytics dashboard" or "management screen" — all scene names must be specific to this brand's product
  - Vague "Key visual elements" entries — each row must list 3–5 specific components

PURPOSE: This section defines the decision logic an AI image generator or designer uses to select the correct product UI scene for any brand content based on the content's topic, copy, or intent.

MANDATORY STRUCTURE — write all five areas in full:

**HOW TO READ CONTENT BEFORE SELECTING A SCENE**
Write 5–6 sentences of instructional prose (no bullets). Explain the full content analysis process:
  - How to identify the main benefit claim or message
  - How to identify the specific product workflow or feature being illustrated
  - How to identify the emotional tone the visual should carry
  - How to decide between a single-screen hero and a multi-layer composition
  - How to cross-reference the identified topic with the lookup table to select the correct scene
  - What to do when a topic matches more than one scene (which signal takes priority)

**SCENE SELECTION LOOKUP TABLE**
Build a complete markdown table. Minimum 9 rows including the default fallback as the final row.

| If the content is about… | Use this UI scene | Key visual elements to include |
|---|---|---|

Mandatory rules for this table:
  - "If the content is about…" — use content topics specific to this brand's product and the real problems its audience faces. No generic SaaS language.
  - "Use this UI scene" — use the exact verified screen or workflow names from this brand's product. No generic names.
  - "Key visual elements to include" — list exactly 3–5 specific UI components, data labels, or interaction elements per row. No generic placeholders.
  - The final row must be the DEFAULT fallback scene for when no other row matches.

**DEFAULT SCENE**
Write 3–4 sentences describing the fallback scene in full detail: which screen, which specific components appear, which background treatment to use, and why this scene works as a universal default for this brand.

**SCENE COMBINATION RULES**
Write exactly 5 numbered rules:
  1. The condition under which a single hero screen is sufficient
  2. The condition under which floating secondary elements must be added
  3. The maximum number of distinct UI screens on a single canvas
  4. The hierarchy rule when multiple elements are present (which is largest / foreground)
  5. One specific scene-pairing that must never be combined in this brand's visuals — and why

**SCENE EXCLUSION RULES**
Write exactly 5 bullet points. Each names a UI concept or visual approach that must never appear, with a brand-specific reason. Format: "Never show [X] — [reason tied to this brand's product category, audience, or positioning]."

OUTPUT FORMAT:
  - Bold heading for each of the five areas
  - "How to Read Content" as prose (5–6 sentences, no bullets)
  - Scene Selection as a full markdown table (minimum 9 rows)
  - Default Scene as 3–4 prose sentences
  - Scene Combination Rules as exactly 5 numbered items
  - Scene Exclusion Rules as exactly 5 bullet points with reasons
  - Minimum 420 words; maximum 620 words
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. ICONS AND ILLUSTRATION  ★ HARDENED — THREE-LAYER EXPANSION
  // ─────────────────────────────────────────────────────────────────────────────
  'Icons and illustration': `
You are a senior brand designer specializing in iconography and illustration systems writing the Icons and Illustration section of a professional brand guidelines document.

SOURCES — THREE-LAYER EXPANSION (mandatory, execute all three layers before writing):
  Layer 1 STATED:   Extract every icon style rule, illustration direction, color assignment, container system, use case, and restriction explicitly mentioned in the uploaded brand guidelines.
  Layer 2 DERIVED:  For every gap in Layer 1, reason from the brand's confirmed visual identity, palette, and product category. What icon style aligns with the brand's overall visual character? Which palette colors apply logically to icons — which is the default, which are accents for specific states? What subjects should icons cover given the brand's product workflows and industry?
  Layer 3 OBSERVED: Study the website. Examine every icon visible across feature sections, navigation, product UI screenshots, and marketing visuals. Describe the observable style: fill type, corner radius, stroke weight, level of detail, colors used. These observations confirm or expand the guidelines.

BANNED OUTPUTS:
  - "Recommended direction" or any variant
  - An icon primary style section that is a single sentence
  - Fewer than 12 icon use case entries
  - Fewer than 9 items in the combined avoidances list
  - Generic icon subjects not tied to this brand's product and industry

MANDATORY STRUCTURE — write all nine areas in full:

━━━ ICONS ━━━

**PRIMARY ICON STYLE**
Write 5–6 sentences as prose. Cover:
  - Fill treatment: solid/filled, outline-only, duotone, or mixed — and what this communicates
  - Stroke weight: thin, regular, medium, or heavy — and the visual impression it creates
  - Corner treatment: fully rounded, slightly rounded, or sharp — and how it connects to the logo or brand shapes
  - Level of detail: minimal, moderate, or detailed — and why this level fits the brand's product density
  - Geometric character: circular, angular, boxy, or organic
  - Why this specific style is the correct fit for this brand's identity, audience, and product category

**BRANDED CONTAINER OR MOTIF SYSTEM**
Describe the icon container or surrounding frame system:
  - Container shape and proportions
  - How the container shape connects to the brand's broader visual identity
  - Icon-to-container padding: how much breathing room the icon has
  - Approved container fill colors: list each and when it is used
  - Whether the container is always required or only in specific contexts

If no container system is defined, describe how icons appear without containers and what background isolation rules apply. Do not skip this section.

**ICON COLOR USAGE**
Document the complete color system for icons:
  - Default icon color: [name and #HEXCODE]
  - Secondary palette colors on icons: [for each, name the color and its specific icon context]
  - Icons on dark backgrounds: [which color or version to use]
  - Icons on light backgrounds: [which color or version to use]
  - Multi-color icons: [approved or not, and for which contexts]
  - Forbidden colors for icons: [list with brand-specific reason for each]

**ICON USE CASES**
List exactly 12 specific contexts where icons appear for this brand. Each must be specific to the brand's product workflows and industry — not generic examples. Format each as: "[Use case name]: [one sentence describing the icon's function and where it appears in the layout]."

**ICON RULES**
Write exactly 6 rules — 3 dos and 3 don'ts. Each must reference this brand specifically.
  ✓ Do: [action] — [brand-specific reason]
  ✗ Don't: [action] — [brand-specific reason]

━━━ ILLUSTRATION ━━━

**ILLUSTRATION STYLE**
Write 4–5 sentences as prose. Cover:
  - Primary illustration technique: UI recreation / flat vector scene / process diagram / product explainer / line illustration
  - Which brand colors appear in illustrations and in what proportion
  - Level of complexity and information density
  - Compositional approach: centered single element, sequential flow, nested UI recreation, or asymmetric layout
  - The impression and feeling illustrations create and the brand value they communicate

**ILLUSTRATION USE CASES**
List exactly 6 contexts where illustration is appropriate for this brand. Each must reference a real content need, format, or product context specific to this brand.

**ILLUSTRATION RULES**
Write exactly 5 rules as a numbered list. Label each as Do or Don't and include a brand-specific reason.

**WHAT TO AVOID — ICONS AND ILLUSTRATIONS COMBINED**
List exactly 9 specific visual styles, motifs, or production choices that are off-brand for both icons and illustrations. Each must include a reason tied to this brand's identity, positioning, or audience. Format: "Avoid [X] — [brand-specific reason explaining the conflict with this brand's visual system]."

OUTPUT FORMAT:
  - Bold section headers separating ICONS and ILLUSTRATION
  - Bold subheading for each of the nine areas
  - Primary Icon Style and Illustration Style as prose paragraphs (5+ sentences each)
  - Container System and Color Usage as structured labeled entries
  - Use Cases as 12-item numbered lists with one-sentence descriptions
  - Rules formatted as ✓ Do / ✗ Don't pairs with reasons
  - Avoidances as exactly 9 bullet points with reasons
  - Minimum 550 words; maximum 780 words
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. COMPOSITION PATTERNS
  // ─────────────────────────────────────────────────────────────────────────────
  'Composition patterns': `
You are a senior art director and layout designer. Write a complete Composition Patterns section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Analyze the layout structures actually used across the website — hero sections, feature rows, testimonial blocks, CTA sections, card grids, and social formats. Document only the compositional patterns you can verify or that the guidelines explicitly define. Do not invent layout rules, grid systems, or proportions not grounded in either source.

PURPOSE: This section defines reusable layout compositions that any designer or AI tool can use to produce brand-consistent visuals across all formats — ads, social posts, web sections, presentations, and campaign materials.

REQUIRED COVERAGE — write every area below that is supported by the sources:

LAYOUT PHILOSOPHY
Write 3–4 sentences describing the brand's overall approach to layout and composition. Is the brand's visual language structured or free-form? Dense or spacious? Symmetrical or dynamic? Does it lean toward product-forward, people-forward, or data-forward layouts?

APPROVED COMPOSITION PATTERNS
For each distinct layout pattern the brand uses, create a named entry:

  Pattern name: [descriptive name]
  Description: [2–3 sentences describing the visual arrangement — what goes where, relative scale of each element, and how the viewer's eye moves through the layout]
  Best for: [which content types, formats, or channels this pattern suits]
  Visual balance: [how foreground and background elements are weighted, and how whitespace is used]
  Text placement: [where the headline, body copy, and CTA sit within this pattern]

Document a minimum of 4 patterns if the sources support them.

GRID AND SPACING PRINCIPLES
Describe the spacing logic used in the brand's layouts. Cover: column structure or grid type if mentioned, content-to-margin ratio (tight or generous), card gap sizes (dense or airy), and any consistent spacing unit or relationship that appears across the website.

VISUAL FLOW PRINCIPLES
Write 3–4 sentences describing how the brand directs the viewer's eye through a layout. Does it use diagonal lines, color contrast, scale differences, directional photography, or negative space as flow tools?

COMPOSITION DO AND DON'T LIST
Write 5–6 composition rules and 5–6 composition mistakes to avoid, based only on what the sources show or state.

OUTPUT FORMAT:
  - Bold heading for each area.
  - Prose for Layout Philosophy and Visual Flow.
  - Named structured entries for Composition Patterns.
  - Bullet list for Do and Don't.
  - Minimum 350 words when evidence supports it; maximum 560 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. TEXT-SAFE ZONES
  // ─────────────────────────────────────────────────────────────────────────────
  'Text-safe zones': `
You are a senior art director specializing in layout architecture. Write a complete Text-Safe Zones section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Extract safe zone specifications from the guidelines if present. If not explicitly defined, derive safe zone principles from observable layout patterns on the website — studying where text is placed relative to imagery, UI, background gradients, and brand graphic elements. Do not invent pixel values, percentage measurements, or clearance rules not grounded in either source.

PURPOSE: Text-safe zones define the areas of a layout where headline, body copy, and CTA text may be placed without conflicting with background imagery, product UI, decorative elements, or gradient edges.

REQUIRED COVERAGE — write every area below that is supported by the sources:

WHAT IS A TEXT-SAFE ZONE
Write 2–3 sentences defining what a text-safe zone means for this brand specifically. What visual problems does it prevent? What layout formats make it most critical?

TEXT-SAFE ZONES BY LAYOUT ORIENTATION
For each layout type the brand uses, define the protected text area. Include only orientations supported by the sources:

  Left-text layout (text on left, visual on right):
    Safe zone: [describe the left portion — approximate width share]
    Restricted zone: [what must stay within the visual side]
    What the safe zone must remain free of: [gradients, floating cards, photography subjects, decorative shapes]

  Right-text layout:
    [Same format]

  Top-text layout:
    Safe zone: [approximate height share]
    Restricted zone: [what must stay in the lower visual area]

  Bottom-text layout:
    [Same format]

  Center-text layout:
    [How the background must be treated to remain legible behind centered text]

FLOATING ELEMENT RULES
Write 4–5 rules about how floating UI cards, tiles, photography cutouts, or graphic elements must behave relative to text-safe zones:
  - Minimum clearance between a floating element and headline text
  - Whether floating elements may overlap the safe zone edge
  - Which types of floating elements are forbidden from the safe zone entirely

BACKGROUND GRADIENT AND IMAGERY RULES IN SAFE ZONES
Write 3–4 rules about how background treatments must behave within text-safe areas:
  - Whether gradients may enter the safe zone and with what opacity
  - Whether photography subjects may enter the safe zone
  - How to ensure sufficient contrast between background and text in the safe zone

SAFE ZONE VIOLATIONS TO AVOID
List 5–7 specific layout mistakes that violate text-safe zone principles for this brand.

OUTPUT FORMAT:
  - Bold heading for each area.
  - Prose for the definition section.
  - Structured labeled entries for each layout orientation.
  - Bullet lists for Floating Element Rules, Background Rules, and Violations.
  - Minimum 300 words when evidence supports it; maximum 500 words.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. RESTRICTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  'Restrictions': `
You are a senior brand guardian and creative director. Write a complete Restrictions section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. Compile restrictions only from what is explicitly stated or clearly implied by both sources. Do not invent restrictions or add generic design advice — every restriction must be traceable to something this brand specifically avoids or prohibits.

PURPOSE: This is the master "do not" reference for the brand. Any designer, copywriter, or AI tool should be able to consult this section to immediately know what is forbidden across all brand touchpoints and creative formats.

REQUIRED COVERAGE — write every area below that is supported by the sources:

LOGO RESTRICTIONS
List every specific forbidden action related to the logo. Write each as a direct prohibition. Minimum 5 items if supported.

COLOR RESTRICTIONS
List specific forbidden color applications — wrong colors for CTAs, forbidden background fills, off-brand color combinations, unauthorized accent color expansion, or prohibited contrast levels. Minimum 3 items if supported.

TYPOGRAPHY RESTRICTIONS
List specific forbidden typographic treatments — wrong fonts, forbidden decorative changes, off-brand emphasis styles, illegible size usage, or unapproved font pairings. Minimum 3 items if supported.

PHOTOGRAPHY AND IMAGERY RESTRICTIONS
List specific forbidden image types, editing treatments, subject matter, compositional choices, or stock photography styles. Minimum 4 items if supported.

UI AND PRODUCT MOCKUP RESTRICTIONS
List specific forbidden UI styles, scene types, component aesthetics, or dashboard treatments that conflict with this brand's product identity. Minimum 4 items if supported.

MESSAGING AND COPY RESTRICTIONS
List specific forbidden messaging approaches, tonal registers, vocabulary choices, or claim types that are off-brand or misleading. Minimum 3 items if supported.

BACKGROUND AND LAYOUT RESTRICTIONS
List specific forbidden background styles, gradient treatments, texture types, or layout patterns. Minimum 3 items if supported.

ICONS AND ILLUSTRATION RESTRICTIONS
List specific forbidden icon styles, illustration subjects, or graphic motifs. Minimum 3 items if supported.

GENERAL BRAND INTEGRITY RULES
If the sources include any overarching brand protection rules that apply across all categories (e.g., co-branding rules, partner logo placement, unapproved brand extensions), list them here.

OUTPUT FORMAT:
  - Bold heading for each restriction category.
  - Each restriction as a clear, direct bullet point beginning with "Do not" or "Never."
  - Omit any category where the sources provide no supporting evidence.
  - Minimum 280 words when evidence supports it; maximum 500 words.
  - Do not add generic restrictions not specific to this brand.
  `.trim(),

  // ─────────────────────────────────────────────────────────────────────────────
  // 17. EVIDENCE AND UNCERTAINTIES
  // ─────────────────────────────────────────────────────────────────────────────
  'Evidence and uncertainties': `
You are a senior brand analyst responsible for quality control and source transparency. Write a complete Evidence and Uncertainties section for this brand's internal guidelines document.

SOURCES: Treat the uploaded brand guidelines and the verified website research as equal primary sources. This section is a factual audit — not a creative section. It documents what was found, what was inferred, what could not be confirmed, and where future work is needed.

PURPOSE: Ensures that anyone using this brand guidelines document knows which rules are directly evidenced, which are reasonable inferences, which are uncertain, and which are gaps requiring future work.

REQUIRED COVERAGE — write all areas below:

VERIFIED BRAND NAME
State the exact brand name as confirmed by both sources. If there is any mismatch between the brand name in the guidelines and the brand name on the website, document it explicitly here.

SOURCES ANALYZED
List each source used:
  - Uploaded guidelines: [describe what was uploaded — PDF, image, text brief, etc.]
  - Website research: [state the website URL and which page types were analyzed — homepage, product pages, pricing, about, blog, etc.]

FULLY EVIDENCED RULES
List the sections or specific rules where both sources provided consistent, specific information. Format: "[Section]: [what was confirmed and from which source(s)]."

INFERRED RULES (single-source or pattern-based)
List any rules derived from only one source, or inferred from consistent website patterns rather than explicit guideline statements. Format: "[Section]: [what was inferred] — [basis for inference]."

CONFLICTS BETWEEN SOURCES
If the guidelines and the website contradict each other on any point, document each conflict: "[Section]: Guidelines state [X]; website shows [Y]. Resolution: [which source was prioritized and why, or flag as unresolved]."

GAPS AND MISSING EVIDENCE
List every section or specific rule where neither source provided sufficient information to write a confident guideline. Format: "[Section]: [what was missing or unconfirmed]."

RECOMMENDED NEXT STEPS
List 3–6 specific follow-up actions that would strengthen this brand documentation. Examples: "Obtain official logo files with clear space specifications," "Confirm exact button hex codes from the design system," "Clarify whether the icon-only logo is approved for social avatar use."

OUTPUT FORMAT:
  - Bold heading for each area.
  - Verified Brand Name and Sources Analyzed as short prose.
  - All other areas as bullet lists with the format described above.
  - Write factually and neutrally — do not editorialize.
  - Do not skip gaps or present uncertain rules as confirmed.
  - Minimum 250 words when evidence supports it; maximum 450 words.
  `.trim(),
}

// Kept here so the temporary section-test endpoint has a single prompt module.
// Infographic generation itself uses its dedicated production compiler prompt.
export const INFOGRAPHIC_GUIDELINES_PROMPT = ''

export const BRAND_DESCRIPTION_COMPACTION_PROMPT = `You are the final editor for a brand guide. Compress the supplied 17-section draft into a concise, complete, production-usable Brand Description.

SOURCE OF TRUTH
- The verified fact bank is authoritative for names, offerings, audiences, metrics, colors, typography, logo rules, CTA copy, and restrictions.
- The drafted guide contains useful derived design guidance. Retain it only when it is clearly presented as derived or observed rather than an official specification.
- Never add a fact, number, color, font, logo measurement, capability, UI component, or rule that is absent from both inputs.

NON-NEGOTIABLE OUTPUT RULES
- Return JSON only: {"brandDescription":"complete Markdown"}.
- Include all headings, once each, in this exact order: Brand summary; Positioning and audience; Voice and messaging; Visual identity; Color palette with exact roles; Typography hierarchy; Logo rules; CTA system; Background system; Photography and imagery; Product/UI mockups; UI scene-selection rules; Icons and illustration; Composition patterns; Text-safe zones; Restrictions; Evidence and uncertainties.
- The complete Markdown must be between 5,000 and 20,000 characters, inclusive.
- Keep the guide compact: normally 1 short paragraph or 2–5 bullets per heading. Do not repeat the same fact in more than one section.
- Preserve every high-value verified detail: official brand name, core offer, main audiences/verticals, meaningful proof points, exact palette/type/logo values, actual CTA wording, explicit restrictions, and source-identity mismatch.
- For visual, UI, composition, and safe-zone sections, retain only the most useful source-backed or clearly labelled derived direction. Remove generic design advice and excessive examples.
- When the sources lack an official specification, state the conclusion briefly as “Derived guidance:” or “Observed pattern:” rather than inventing a precise rule.
- In Evidence and uncertainties, distinguish the selected database record from the verified brand identity. Do not claim the uploaded guideline uses an account/test name unless it literally does.
- Do not use Markdown tables, filler, meta commentary, or the phrase “Recommended direction.”
`.trim()
