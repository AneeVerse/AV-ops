// Shared rendering helpers for the infographic generator + history playback/export paths.
// Consolidated here because the two pages previously carried near-duplicate copies that had
// drifted out of sync (different logo geometry, different escape-handling bugs), which is what
// caused inconsistent/overlapping logos and "Invalid escape in identifier" render errors.

/**
 * Reverses JSON-style backslash escaping in a single left-to-right pass.
 *
 * The previous implementation chained `.replace(/\\n/g,'\n').replace(/\\t/g,'\t')...
 * .replace(/\\\\/g,'\\')` with `\\\\` handled LAST. That ordering is unsound: a genuine escaped
 * backslash followed by a literal "n" (four raw chars: \, \, \\, n -> meant to decode to `\` + `n`,
 * e.g. from a Windows path or a regex like /\d/ that got double-escaped) has its trailing `\n`
 * consumed by the newline rule first, turning it into `\` + <real newline> and leaving a
 * dangling, unescaped backslash sitting in the output. That stray backslash then lands directly
 * in code passed to `new Function(...)`, which throws "Invalid escape in identifier" (Safari) /
 * "Invalid or unexpected token" (Chrome) at parse time — this is the recurring
 * "Infographic render error: Global Code" spam.
 *
 * A single regex.replace with alternation is order-safe: the engine consumes matched characters
 * left-to-right without re-scanning replaced output, so `\\n` (escaped backslash + literal n) and
 * `\n` (newline escape) are never confused.
 */
export function unescapeJsonLikeString(input: string): string {
  return input.replace(/\\(u[0-9a-fA-F]{4}|n|t|r|"|'|\\)/g, (_match, token: string) => {
    switch (token[0]) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case '"': return '"'
      case "'": return "'"
      case '\\': return '\\'
      default: return String.fromCharCode(parseInt(token.slice(1), 16))
    }
  })
}

export function stripCodeFences(code: string): string {
  const trimmed = code.trim()
  const wrapped = trimmed.match(/^```[\w-]*\n?([\s\S]*?)\n?```$/)
  if (wrapped) return wrapped[1]
  return trimmed
    .replace(/^```[\w-]*\n?/, '')
    .replace(/\n?```\s*$/, '')
}

/**
 * Canonical sanitizer for AI-generated infographic canvas code (both the static
 * `drawGraphic` payload and the animated `drawFrame` payload share this shape).
 * Used identically by the generator page, the history player, and history's re-export flow —
 * previously each had its own near-copy, which is how they drifted apart.
 */
export function sanitizeInfographicCode(code: string): string {
  code = stripCodeFences(code)
  // Only unescape if the code looks like it's still JSON-encoded (single line, literal \n's) —
  // real multi-line code (the normal case, already decoded by JSON.parse upstream) is left alone
  // so we never risk mangling an intentional literal "\n" inside a string/regex.
  if (!code.includes('\n') && code.includes('\\n')) {
    code = unescapeJsonLikeString(code)
  }
  return code
    .replace(/\u2028|\u2029/g, '\n')              // JS line/paragraph separators break parsing
    .replace(/\u00a0/g, ' ')                          // non-breaking space -> regular space
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')    // zero-width / BOM chars
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
}

/**
 * Checks that `code` is at least syntactically valid JS before we trust it enough to record a
 * video from it / persist it / play it in a loop. Cheap (no execution — `new Function` only
 * parses the body, it doesn't run it until called) and catches the exact class of bug that
 * otherwise only surfaces later as a console "Global Code" parse error.
 */
export function isSyntacticallyValidCode(code: string, functionName: 'drawGraphic' | 'drawFrame'): boolean {
  try {
    // `new Function(body)` only parses `body` — a thrown statement inside it never runs until
    // the function is called. So this both constructs AND immediately calls it (mirroring
    // exactly how every real call site consumes this code, e.g.
    // `new Function(clean + 'return typeof drawFrame==="function"?drawFrame:null;')()`),
    // which is what actually surfaces both syntax errors and a missing target function.
    // eslint-disable-next-line no-new-func
    const result = new Function(code + `\nreturn typeof ${functionName}==='function';`)()
    return result === true
  } catch {
    return false
  }
}

/**
 * Deterministic brand-logo compositing, applied by the app AFTER the AI's drawGraphic/drawFrame
 * call — the AI is never trusted to draw the logo itself (same principle as blog-images'
 * drawBlogLogoOverlay: exact position/size shouldn't depend on the model's arithmetic, and
 * trusting it to also `if (logoImg)`-guard correctly is how brands with unusual logo aspect
 * ratios ended up with the logo overlapping headline content, or the generation code throwing
 * on a null logoImg and aborting the rest of the frame).
 *
 * Every runtime call site must pass `logoImg: null` into drawGraphic/drawFrame and call this
 * afterward instead — geometry here is the single source of truth. Keep IFRAME_LOGO_OVERLAY_JS
 * (below) in sync if this changes.
 */
export function drawBrandLogoOverlay(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  width: number,
  height: number,
) {
  if (!logoImg || !logoImg.complete || !logoImg.naturalWidth || !logoImg.naturalHeight) return

  const maxWidth = width * 0.19
  const maxHeight = height * 0.065
  const scale = Math.min(maxWidth / logoImg.naturalWidth, maxHeight / logoImg.naturalHeight, 1)
  const drawWidth = logoImg.naturalWidth * scale
  const drawHeight = logoImg.naturalHeight * scale
  const inset = width * 0.06

  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(logoImg, inset, inset, drawWidth, drawHeight)
  ctx.restore()
}

/**
 * Plain-JS source for the same geometry as drawBrandLogoOverlay, for injection into the
 * sandboxed history-player iframe (which runs its own isolated `<script>`, not compiled TS).
 * Keep this byte-for-byte equivalent to drawBrandLogoOverlay above.
 */
export const IFRAME_LOGO_OVERLAY_JS = `
function __drawBrandLogoOverlay(ctx, logoImg, width, height) {
  if (!logoImg || !logoImg.complete || !logoImg.naturalWidth || !logoImg.naturalHeight) return;
  var maxWidth = width * 0.19;
  var maxHeight = height * 0.065;
  var scale = Math.min(maxWidth / logoImg.naturalWidth, maxHeight / logoImg.naturalHeight, 1);
  var drawWidth = logoImg.naturalWidth * scale;
  var drawHeight = logoImg.naturalHeight * scale;
  var inset = width * 0.06;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(logoImg, inset, inset, drawWidth, drawHeight);
  ctx.restore();
}`
