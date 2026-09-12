import type { StitchResult, WalkthroughScene } from './types'

const MAX_ELEMENTS_PER_SCENE = 3
const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080

/**
 * Produces a fully self-contained JS source string — same shape as motion infographic's
 * remotion_code (one standalone unit a player can new Function(...) and run). Evaluating
 * it exposes `mount(container)`, which builds and animates the walkthrough directly as
 * real DOM/CSS inside `container` — deliberately the same technique the reference
 * "UI motion code.html" file uses (absolutely-positioned overlay elements, native CSS
 * transitions, async/await + setTimeout timing) rather than a hand-rolled Canvas2D
 * redraw loop.
 *
 * Output is a fixed 1920x1080 "stage": everything (recreated content, cursor, typed
 * text) is laid out in that fixed coordinate space, then the whole stage is scaled via
 * a single CSS transform to fit however large `container` actually is (a ResizeObserver
 * keeps the scale in sync).
 *
 * Each scene's visual content is AI-recreated HTML/CSS/JS structure (scene.recreatedHtml,
 * from lib/ui-walkthrough/recreate-screen.ts) injected via innerHTML — not the raw
 * screenshot image. There's nothing to preload (no external image URLs embedded), which
 * also means embedded <script> tags in the recreated HTML are inert (innerHTML doesn't
 * execute them) — intentional, our own engine below drives all animation, the recreated
 * markup is purely structural/visual.
 *
 * There is no separate element-locator AI call and no coordinates travel between calls.
 * The SAME recreation call marks up to a few interactive elements inline with a
 * data-uiw="click" or data-uiw="type:SHORT TEXT" attribute (see recreate-screen.ts).
 * After injecting a scene's HTML, this engine queries [data-uiw] directly in the real
 * rendered DOM and measures each match's actual getBoundingClientRect() (relative to the
 * stage, so it's scale-independent) to know where to move the cursor — always exactly
 * where the recreation actually put that element, not a guess against a different image.
 *
 * Contract for callers (see components/UiWalkthroughPreview.tsx and
 * lib/ui-walkthrough/record-export.ts):
 *   const mod = new Function(code + '\n;return { mount };')();
 *   mod.mount(containerEl);                        // builds DOM, loops forever
 *   await mod.mount(containerEl, { once: true });   // runs exactly one pass, then resolves
 *                                                    // (used by record-export.ts to know
 *                                                    // when to stop sampling for export)
 */
export function stitchWalkthrough(scenes: WalkthroughScene[]): StitchResult {
  const ordered = [...scenes]
    .sort((a, b) => a.order - b.order)
    .map(s => ({ recreatedHtml: s.recreatedHtml, narration: s.narration }))

  const scenesJson = JSON.stringify(ordered)

  const code = `
const SCENES = ${scenesJson};
const STAGE_WIDTH = ${STAGE_WIDTH};
const STAGE_HEIGHT = ${STAGE_HEIGHT};
const MAX_ELEMENTS_PER_SCENE = ${MAX_ELEMENTS_PER_SCENE};

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function mount(container, opts) {
  opts = opts || {};
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.aspectRatio = STAGE_WIDTH + ' / ' + STAGE_HEIGHT;
  container.style.overflow = 'hidden';
  container.style.background = '#e2e8f0';

  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute; top:0; left:0; width:' + STAGE_WIDTH + 'px; height:' + STAGE_HEIGHT + 'px; transform-origin:top left; font-family:\\'Inter\\',-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;';
  container.appendChild(stage);

  function rescale() {
    const w = container.getBoundingClientRect().width;
    if (w > 0) stage.style.transform = 'scale(' + (w / STAGE_WIDTH) + ')';
  }
  if (typeof ResizeObserver !== 'undefined') { new ResizeObserver(rescale).observe(container); }
  rescale();

  const style = document.createElement('style');
  style.textContent =
    '@keyframes uiwRipple { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; } }' +
    '@keyframes uiwBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }' +
    '.uiw-caret { display: inline-block; margin-left: 2px; color: #1d70f5; font-weight: 300; animation: uiwBlink 0.8s infinite; }';
  stage.appendChild(style);

  const contentEl = document.createElement('div');
  contentEl.style.cssText = 'position:absolute; top:0; left:0; width:' + STAGE_WIDTH + 'px; min-height:' + STAGE_HEIGHT + 'px; max-height:' + STAGE_HEIGHT + 'px; overflow:hidden; transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1);';
  stage.appendChild(contentEl);

  const cursorEl = document.createElement('div');
  cursorEl.style.cssText = 'position:absolute; top:0; left:0; opacity:0; pointer-events:none; transition: transform 0.7s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease; z-index:100; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));';
  cursorEl.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#0f172a"><path d="M3 3l7 18 3-7 7-3L3 3z"/></svg>';
  stage.appendChild(cursorEl);

  const typedEl = document.createElement('div');
  typedEl.style.cssText = 'position:absolute; display:inline-block; background:rgba(255,255,255,0.94); border-radius:4px; padding:2px 7px; box-shadow:0 1px 3px rgba(0,0,0,0.15); color:#0f172a; white-space:pre; opacity:0; transition:opacity 0.15s ease; pointer-events:none; z-index:90;';
  stage.appendChild(typedEl);

  function findTargets(narration) {
    const nodes = Array.prototype.slice.call(contentEl.querySelectorAll('[data-uiw]')).slice(0, MAX_ELEMENTS_PER_SCENE);
    const stageRect = stage.getBoundingClientRect();
    const narrationLower = (narration || '').trim().toLowerCase();
    return nodes.map(function(node) {
      const r = node.getBoundingClientRect();
      const x = stageRect.width > 0 ? (r.left - stageRect.left) / stageRect.width : 0;
      const y = stageRect.height > 0 ? (r.top - stageRect.top) / stageRect.height : 0;
      const w = stageRect.width > 0 ? r.width / stageRect.width : 0;
      const h = stageRect.height > 0 ? r.height / stageRect.height : 0;
      const raw = node.getAttribute('data-uiw') || '';
      const isType = raw.indexOf('type:') === 0;
      let typedText = isType ? raw.slice(5) : '';
      // Drop typedText if the model echoed the narration back instead of inventing
      // realistic content — same failure mode as before, worth guarding here too.
      const typedLower = typedText.trim().toLowerCase();
      if (typedLower && narrationLower && (narrationLower.indexOf(typedLower) !== -1 || typedLower.indexOf(narrationLower) !== -1)) {
        typedText = '';
      }
      return { x: x, y: y, w: w, h: h, type: isType && typedText ? 'input' : 'button', typedText: typedText };
    });
  }

  async function moveCursorTo(xFrac, yFrac) {
    const x = xFrac * STAGE_WIDTH, y = yFrac * STAGE_HEIGHT;
    cursorEl.style.opacity = '1';
    cursorEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    await sleep(700);
    return { x: x, y: y };
  }

  function ripple(x, y) {
    const r = document.createElement('div');
    r.style.cssText = 'position:absolute; left:' + x + 'px; top:' + y + 'px; width:24px; height:24px; margin:-12px 0 0 -12px; border-radius:50%; background:rgba(29,112,245,0.4); pointer-events:none; z-index:99; animation: uiwRipple 0.4s ease-out forwards;';
    stage.appendChild(r);
    setTimeout(function() { r.remove(); }, 400);
  }

  async function typeInto(el) {
    const fontSize = Math.max(12, Math.min(19, el.h * STAGE_HEIGHT * 0.55));
    typedEl.style.left = (el.x * STAGE_WIDTH + 4) + 'px';
    typedEl.style.top = (el.y * STAGE_HEIGHT + Math.max(0, (el.h * STAGE_HEIGHT - fontSize * 1.4) / 2)) + 'px';
    typedEl.style.fontSize = fontSize + 'px';
    typedEl.textContent = '';
    typedEl.style.opacity = '1';
    const caret = document.createElement('span');
    caret.className = 'uiw-caret';
    caret.textContent = '|';
    const text = el.typedText;
    for (let i = 1; i <= text.length; i++) {
      typedEl.textContent = text.slice(0, i);
      typedEl.appendChild(caret);
      await sleep(35 + Math.random() * 20 - 10);
    }
    await sleep(500);
    caret.remove();
  }

  async function showScene(scene, isFirst) {
    cursorEl.style.opacity = '0';
    typedEl.style.opacity = '0';

    if (!isFirst) {
      contentEl.style.opacity = '0';
      contentEl.style.transform = 'translateY(12px)';
    }
    contentEl.innerHTML = scene.recreatedHtml;
    void contentEl.offsetHeight;
    contentEl.style.opacity = '1';
    contentEl.style.transform = 'translateY(0)';
    await sleep(400);

    const targets = findTargets(scene.narration);
    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      const pos = await moveCursorTo(el.x + el.w / 2, el.y + el.h / 2);
      ripple(pos.x, pos.y);
      if (el.type === 'input' && el.typedText) {
        await sleep(150);
        await typeInto(el);
      } else {
        await sleep(400);
      }
      await sleep(i === targets.length - 1 ? 200 : 500);
    }

    const holdMs = Math.max(1200, Math.min(4000, scene.narration.length * 60));
    await sleep(holdMs);
  }

  async function runOnce() {
    for (let i = 0; i < SCENES.length; i++) {
      await showScene(SCENES[i], i === 0);
    }
  }

  return (async function loop() {
    if (opts.once) { await runOnce(); return; }
    while (true) {
      await runOnce();
      await sleep(1000);
    }
  })();
}
`.trim()

  return { code }
}
