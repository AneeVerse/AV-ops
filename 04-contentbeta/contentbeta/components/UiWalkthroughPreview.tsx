'use client'
import { useEffect, useRef } from 'react'

interface UiWalkthroughPreviewProps {
  code: string
}

/**
 * Standalone player for the UI Walkthrough feature — deliberately not shared with
 * components/RemotionPreview.tsx or the motion-infographic player, so nothing about
 * that existing feature is touched.
 *
 * `code` is a self-contained JS unit (see lib/ui-walkthrough/stitch-engine.ts) that
 * exposes `mount(container)`: it builds the walkthrough as real DOM/CSS inside the
 * container and animates it with native CSS transitions + setTimeout — the same
 * technique the reference "UI motion code.html" file uses, not a canvas redraw loop.
 * Rendered in a sandboxed iframe purely for DOM isolation from the host page.
 *
 * mount() itself renders a fixed 1920x1080 stage internally and scales it to fit
 * whatever size its target element is (see stitch-engine.ts), so this iframe just
 * needs to match that same 1920x1080 aspect ratio — no dynamic height measurement
 * needed.
 */
export default function UiWalkthroughPreview({ code }: UiWalkthroughPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!code || !iframeRef.current) return

    const safeCode = JSON.stringify(code).replace(/<\/script/gi, '<\\/script')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#e2e8f0; overflow:hidden; }
    #stage { width:100%; }
    .render-error { color:#f87171; font-family:sans-serif; padding:20px; text-align:center; font-size:14px; }
  </style>
</head>
<body>
  <div id="stage"></div>
  <script>
    let mod = null;
    try {
      mod = new Function(${safeCode} + '\\n;return typeof mount === "function" ? { mount: mount } : null;')();
    } catch (e) {
      console.error('UI walkthrough render error:', e);
    }
    const stage = document.getElementById('stage');
    if (!mod || typeof mod.mount !== 'function') {
      stage.outerHTML = '<div class="render-error">Preview unavailable for this walkthrough.</div>';
    } else {
      try { mod.mount(stage); } catch (e) { console.error('mount error:', e); }
    }
  </script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [code])

  return (
    <iframe
      ref={iframeRef}
      loading="lazy"
      style={{
        width: '100%',
        aspectRatio: '1920 / 1080',
        border: 'none',
        borderRadius: 8,
        background: '#e2e8f0',
        display: 'block',
      }}
      sandbox="allow-scripts"
    />
  )
}
