'use client'
import { useEffect, useRef } from 'react'

interface RemotionPreviewProps {
  animatedCode: string
  logoUrl?: string | null
  fonts?: Array<{ name: string; url: string }>
}

function stripCodeFences(code: string): string {
  const trimmed = code.trim()
  const wrapped = trimmed.match(/^```[\w-]*\n?([\s\S]*?)\n?```$/)
  if (wrapped) return wrapped[1]
  return trimmed
    .replace(/^```[\w-]*\n?/, '')
    .replace(/\n?```\s*$/, '')
}

function sanitizeCode(code: string): string {
  code = stripCodeFences(code)
  // Un-escape if code looks like it's still JSON-encoded (no real newlines but has \n literals).
  // Only convert \n → actual newline OUTSIDE string literals to avoid breaking 'text\ntext' patterns.
  if (!code.includes('\n') && code.includes('\\n')) {
    code = code.replace(
      /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\\n/g,
      (m, strLit) => strLit !== undefined ? m : '\n'
    )
    code = code
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  return code
    .replace(/\u2028|\u2029/g, '\n')   // JS line/paragraph separators break parsing
    .replace(/\u00a0/g, ' ')            // non-breaking space -> regular space
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '') // zero-width / BOM chars
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
}

export default function RemotionPreview({ animatedCode, logoUrl, fonts }: RemotionPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!animatedCode || !iframeRef.current) return

    const cleanCode = sanitizeCode(animatedCode)
    const fontDefs = JSON.stringify(fonts ?? [])

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#111; display:flex; align-items:center; justify-content:center; width:100vw; height:100vh; overflow:hidden; }
    canvas { width:100vw; height:100vh; object-fit:contain; }
  </style>
</head>
<body>
  <canvas id="c" width="1080" height="1080"></canvas>
  <script>
    const TOTAL_FRAMES = 150;
    const FPS = 30;

    ${cleanCode}

    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');

    function drawBrandLogoOverlay(logoImg) {
      if (!logoImg || !logoImg.complete || !logoImg.naturalWidth || !logoImg.naturalHeight) return;
      const maxWidth = 1080 * 0.19;
      const maxHeight = 1080 * 0.065;
      const scale = Math.min(maxWidth / logoImg.naturalWidth, maxHeight / logoImg.naturalHeight, 1);
      const drawWidth = logoImg.naturalWidth * scale;
      const drawHeight = logoImg.naturalHeight * scale;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(logoImg, 1080 * 0.06, 1080 * 0.06, drawWidth, drawHeight);
      ctx.restore();
    }

    function start(logoImg) {
      let frame = 0;
      function tick() {
        ctx.clearRect(0, 0, 1080, 1080);
        try {
          if (typeof drawFrame === 'function') {
            drawFrame(ctx, 1080, 1080, null, frame, TOTAL_FRAMES);
            drawBrandLogoOverlay(logoImg);
          }
        } catch(e) {
          console.error('drawFrame error:', e);
        }
        frame = (frame + 1) % TOTAL_FRAMES;
        setTimeout(() => requestAnimationFrame(tick), 1000 / FPS);
      }
      requestAnimationFrame(tick);
    }

    (async function setup() {
      // Load brand fonts inside the iframe context
      const fontDefs = ${fontDefs};
      await Promise.all(fontDefs.map(async function(f) {
        if (!f.name || !f.url) return;
        try {
          if (f.url.includes('fonts.googleapis.com')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = f.url;
            document.head.appendChild(link);
            await document.fonts.ready;
          } else {
            const face = new FontFace(f.name, 'url(' + f.url + ')', { weight: '100 900', style: 'normal' });
            await face.load();
            document.fonts.add(face);
          }
        } catch(e) {}
      }));

      ${logoUrl
        ? `const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = ${JSON.stringify(logoUrl)};
      await new Promise(function(r) { logoImg.onload = r; logoImg.onerror = r; });
      start(logoImg.complete && logoImg.naturalWidth ? logoImg : null);`
        : `start(null);`}
    })();
  </script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [animatedCode, logoUrl, fonts])

  return (
    <iframe
      ref={iframeRef}
      loading="lazy"
      style={{
        width: '100%',
        aspectRatio: '1/1',
        border: 'none',
        borderRadius: 8,
        background: '#111',
      }}
      sandbox="allow-scripts"
    />
  )
}
