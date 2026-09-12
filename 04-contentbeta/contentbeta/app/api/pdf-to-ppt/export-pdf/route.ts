import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import type { RenderPlan } from '@/lib/ppt/types'

export const maxDuration = 120

// Serializes chromium binary extraction to prevent concurrent spawn ETXTBSY errors.
// Promise is assigned synchronously before any await so concurrent callers all
// wait on the same promise instead of each triggering a parallel extraction.
let chromiumExecPathPromise: Promise<string> | null = null
function getChromiumExecPath(): Promise<string> {
  if (!chromiumExecPathPromise) {
    chromiumExecPathPromise = (async () => {
      const chromium = await import('@sparticuz/chromium-min')
      return chromium.default.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
      )
    })()
  }
  return chromiumExecPathPromise
}

interface FontSpec { name: string; url: string }

function isStylesheetFont(f: FontSpec): boolean {
  return f.url.endsWith('.css') || f.url.includes('fonts.googleapis.com')
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  let browser: import('puppeteer-core').Browser | import('puppeteer').Browser | null = null

  try {
    const { plans, title, fonts } = await req.json() as {
      plans: RenderPlan[]
      title?: string
      fonts?: { heading?: FontSpec; body?: FontSpec }
    }

    if (!Array.isArray(plans) || plans.length === 0) {
      return NextResponse.json({ error: 'plans required' }, { status: 400 })
    }

    const fontSpecs = [fonts?.heading, fonts?.body].filter((f): f is FontSpec => !!f?.url)

    // Real @font-face for direct font files; a <link> for Google-Fonts-style CSS URLs.
    const fontFaces = fontSpecs
      .filter(f => !isStylesheetFont(f))
      .map(f => `@font-face { font-family: '${f.name}'; src: url('${f.url}'); font-display: block; }`)
      .join('\n')
    const fontLinks = fontSpecs
      .filter(isStylesheetFont)
      .map(f => `<link rel="stylesheet" href="${f.url}" />`)
      .join('\n')

    // Reuses PptSlideMarkup from lib/ppt/render-html.tsx — the exact same rendering
    // logic (ElementRenderer/ChartSvg) that components/PptTemplateRenderer.tsx's native
    // branch uses for the live editor — so Puppeteer's real Chromium prints via page.pdf()
    // the same markup the app shows, with no separate rendering path to drift out of sync.
    // render-html.tsx deliberately has no 'use client' directive: importing a component
    // from a 'use client' file (like PptTemplateRenderer.tsx) into a plain Route Handler
    // throws "Element type is invalid ... got: object" — Next wraps client-boundary
    // exports in a reference object that only resolves through the RSC pipeline, which
    // this Route Handler never runs.
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { PptSlideMarkup } = await import('@/lib/ppt/render-html')

    const slidesHtml = plans
      .map(plan => `<div class="slide">${renderToStaticMarkup(createElement(PptSlideMarkup, { plan }))}</div>`)
      .join('\n')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
${fontLinks}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1920px; background: #fff; }
  ${fontFaces}
  .slide { width: 1920px; height: 1080px; position: relative; overflow: hidden; page-break-after: always; }
  .slide:last-child { page-break-after: auto; }
  @page { margin: 0; size: 1920px 1080px; }
</style>
</head>
<body>
${slidesHtml}
</body>
</html>`

    if (process.env.NODE_ENV === 'production') {
      const chromium = await import('@sparticuz/chromium-min')
      const puppeteer = await import('puppeteer-core')
      browser = await puppeteer.default.launch({
        args: chromium.default.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await getChromiumExecPath(),
        headless: true,
      })
    } else {
      const puppeteer = await import('puppeteer')
      browser = await puppeteer.default.launch({ defaultViewport: { width: 1920, height: 1080 }, headless: true })
    }

    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })
    await page.evaluate(() => document.fonts.ready)

    const pdfBuffer = await page.pdf({
      width: '1920px',
      height: '1080px',
      printBackground: true,
      preferCSSPageSize: true,
    })

    const safeTitle = (title || 'presentation').replace(/[^a-z0-9\s\-_]/gi, '').trim() || 'presentation'

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      },
    })
  } catch (err) {
    console.error('export-pdf error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}
