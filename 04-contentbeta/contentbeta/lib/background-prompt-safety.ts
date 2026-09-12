const BACKGROUND_ONLY_INSTRUCTION = `BACKGROUND ASSET ONLY.
The application renders every headline, subhead, statistic, bullet, CTA, logo, label, chart value, and navigation mark after this image is generated. Create only the nonverbal visual layer. Do not draw or imitate any letters, numbers, words, logos, watermarks, labels, badges, buttons, charts with values, or text-shaped marks.
The copy reserve must be genuine negative space made by composition, crop, lighting, blur, atmosphere, or one continuous color field. Never draw a text-holder box, blank card, empty panel, placeholder rectangle, banner, framed copy area, fake form, empty table, or callout container in that reserve. Do not outline or shade the reserve as a separate object.
A genuine product screen, dashboard, device, report, or application interface is allowed only when the supplied evidence supports it and only as the primary subject inside the visual zone; it must never be an empty container for later copy. Leave the deterministic overlay zone quiet, continuous, and low-detail.`

/**
 * Removes source-copy and reference-copy sections that image models tend to
 * reproduce literally. The retained sections describe composition, style,
 * density, and production constraints, which are safe and useful for a
 * text-free background asset.
 */
type OverlayContrastConfig = {
  bgColor?: string | null
  headlineColor?: string | null
  microcopyColor?: string | null
  accentColor?: string | null
}

type BackgroundPromptOptions = {
  /** Static creatives must never use empty UI/cards as decorative filler. */
  requireCompleteVisualModules?: boolean
}

const COMPLETE_STATIC_VISUALS_INSTRUCTION = `STATIC VISUAL-SIDE COMPLETENESS CONTRACT.
Every object in the visual/subject zone must be a finished, meaningful nonverbal visual. Never generate a blank or mostly blank card, white tile, empty rounded rectangle, empty dashboard widget, empty alert row, skeleton UI, placeholder panel, vacant list, blank progress bar, or module reserved for future copy anywhere on the canvas.
Filled visual modules are allowed only when each module contains a complete nonverbal illustration, icon, product view, or abstract unlabeled data visualization with no large unused interior. If a proposed module cannot be completed without generated text, delete the module and use one coherent focal subject or continuous background instead.
The only permitted empty area is the renderer copy reserve, and that reserve must be unframed negative space formed by one continuous background field—never a box, card, tile, row, or panel.`

export function sanitizeBackgroundAssetPrompt(
  rawPrompt: string,
  overlayConfig?: OverlayContrastConfig,
  options?: BackgroundPromptOptions
): string {
  const normalized = (rawPrompt || '').replace(/\r\n/g, '\n').trim()
  // Keep the measured visual facts that make the generated asset resemble the
  // uploaded reference, but discard all source-copy and copy-container facts.
  // Earlier we removed these sections wholesale, which left the image model
  // with a generic subject request and caused large visual drift.
  const evidenceBlocks = Array.from(normalized.matchAll(
    /(?:EVIDENCE BASIS|REFERENCE BLUEPRINT|SHARED FAMILY EVIDENCE):\s*([\s\S]*?)(?=\n\s*(?:COPY ANALYSIS|SCENE SELECTION|PURPOSE|LAYOUT|VISUAL EXECUTION|DENSITY(?: AND LEGIBILITY)?|RESTRICTIONS|FINAL OUTPUT):|$)/gi
  )).map(match => match[1])
  const allowedVisualFact = /(canvas|aspect|dominant visible colors?|palette|outer margin|illustrat|photograph|person|people|worker|truck|vehicle|device|phone|laptop|dashboard|report|screen|product|pattern|background|gradient|shadow|depth|crop|whitespace|negative space|foreground|midground|environment|lighting|shape|object|texture|composition|density|rhythm|grid|curve|city|road|building)/i
  const copyOrContainerFact = /(headline|subhead|text block|body copy|logo|cta|watermark|brand name|bullet|label|button|navigation|arrow|statistic|kpi|percentage|\bcard\b|\bpanel\b|\bband\b|\bform\b|\btable\b|\blist\b)/i
  const nonverbalEvidence = evidenceBlocks
    .flatMap(block => block.split(/[;\n]+/))
    .map(value => value.trim().replace(/^[-•]\s*/, ''))
    .filter(value => value.length >= 8 && allowedVisualFact.test(value) && !copyOrContainerFact.test(value))
    .filter((value, index, values) => values.findIndex(other => other.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 18)
    .join('; ')
  let prompt = normalized

  prompt = prompt
    .replace(/\n*EVIDENCE BASIS:[\s\S]*?(?=\n\s*(?:COPY ANALYSIS|SCENE SELECTION|PURPOSE|LAYOUT|VISUAL EXECUTION|FINAL OUTPUT):|$)/gi, '\n')
    .replace(/\n*REFERENCE BLUEPRINT:[\s\S]*?(?=\n\s*(?:COPY ANALYSIS|SCENE SELECTION|PURPOSE|LAYOUT|VISUAL EXECUTION|FINAL OUTPUT):|$)/gi, '\n')
    .replace(/\n*COPY ANALYSIS:[\s\S]*?(?=\n\s*(?:SCENE SELECTION|PURPOSE|LAYOUT|VISUAL EXECUTION|FINAL OUTPUT):|$)/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const evidence = nonverbalEvidence
    ? `\n\nSAFE NONVERBAL REFERENCE EVIDENCE (match these measured visual facts; never reproduce source copy or its containers): ${nonverbalEvidence}`
    : ''
  const contrastContract = overlayConfig?.bgColor && overlayConfig?.headlineColor
    ? `\n\nOVERLAY CONTRAST CONTRACT: Keep the continuous, unboxed copy reserve close to ${overlayConfig.bgColor} in perceived brightness and tone. The renderer will place headline text in ${overlayConfig.headlineColor}, supporting text in ${overlayConfig.microcopyColor || overlayConfig.headlineColor}, and accents in ${overlayConfig.accentColor || overlayConfig.headlineColor}. Maintain strong readable contrast behind those colors using only a continuous field, natural light, atmosphere, crop, or blur—never a patch, card, panel, banner, or text container.`
    : ''
  const completeVisualsContract = options?.requireCompleteVisualModules
    ? `\n\n${COMPLETE_STATIC_VISUALS_INSTRUCTION}`
    : ''
  return `${BACKGROUND_ONLY_INSTRUCTION}\n\n${prompt}${evidence}${contrastContract}${completeVisualsContract}\n\nNONVERBAL OUTPUT CONTRACT: Return one finished square background with no readable or pseudo-readable glyphs. Preserve generous negative space for the deterministic HTML overlay. Any data visualization must be abstract, unlabeled, and decorative.`
}
