// Standalone video/GIF export for the UI Walkthrough feature. Deliberately not shared
// with the reRecordVideo/reRecordGif functions in app/(protected)/history/page.tsx (the
// motion-infographic feature) so that existing code stays untouched.
//
// The walkthrough is now real DOM/CSS (see lib/ui-walkthrough/stitch-engine.ts), not a
// canvas drawFrame loop, so it can't use canvas.captureStream() directly. Instead this
// mounts the same generated code into a hidden container, runs it once (mount(container,
// {once:true})), and samples it periodically with html2canvas (already a dependency in
// this repo) — each sample is composited onto a fixed 1920x1080 output canvas whose
// stream MediaRecorder captures continuously. mount() itself renders a fixed 1920x1080
// stage (see stitch-engine.ts), and the wrapper below is sized to exactly 1920px so the
// capture happens at native resolution — drawContain is kept as a defensive fallback
// only, not the normal path.

const OUTPUT_WIDTH = 1920
const OUTPUT_HEIGHT = 1080
const SAMPLE_INTERVAL_MS = 120

interface WalkthroughModule {
  mount: (container: HTMLElement, opts?: { once?: boolean }) => Promise<void>
}

function loadModule(code: string): WalkthroughModule {
  const mod = new Function(code + '\n;return typeof mount==="function"?{mount:mount}:null;')() as WalkthroughModule | null
  if (!mod) throw new Error('mount not found in generated code')
  return mod
}

function drawContain(outCtx: CanvasRenderingContext2D, frame: HTMLCanvasElement) {
  outCtx.fillStyle = '#e2e8f0'
  outCtx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
  const scale = Math.min(OUTPUT_WIDTH / frame.width, OUTPUT_HEIGHT / frame.height)
  const dw = frame.width * scale, dh = frame.height * scale
  outCtx.drawImage(frame, (OUTPUT_WIDTH - dw) / 2, (OUTPUT_HEIGHT - dh) / 2, dw, dh)
}

async function runCapture(code: string, onFrame: (canvas: HTMLCanvasElement) => void): Promise<void> {
  const html2canvas = (await import('html2canvas')).default

  // mount() forces its target element's width to 100% of ITS OWN parent, so the actual
  // pixel width is controlled here via this outer wrapper, not the mount target itself.
  const outer = document.createElement('div')
  outer.style.cssText = `position:fixed; left:-9999px; top:0; width:${OUTPUT_WIDTH}px; background:#e2e8f0;`
  document.body.appendChild(outer)
  const container = document.createElement('div')
  outer.appendChild(container)

  try {
    const mod = loadModule(code)
    let capturing = true

    const captureLoop = (async () => {
      while (capturing) {
        try {
          const frame = await html2canvas(container, { backgroundColor: '#e2e8f0', useCORS: true, scale: 1 })
          onFrame(frame)
        } catch { /* skip a bad sample, keep going */ }
        await new Promise(r => setTimeout(r, SAMPLE_INTERVAL_MS))
      }
    })()

    await mod.mount(container, { once: true })
    capturing = false
    await captureLoop
  } finally {
    document.body.removeChild(outer)
  }
}

export interface WalkthroughExportParams {
  code: string
}

export async function recordWalkthroughVideo(
  params: WalkthroughExportParams,
  format: 'mp4' | 'mov'
): Promise<void> {
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = OUTPUT_WIDTH
  outputCanvas.height = OUTPUT_HEIGHT
  const outCtx = outputCanvas.getContext('2d')!
  outCtx.fillStyle = '#e2e8f0'
  outCtx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)

  const fps = Math.round(1000 / SAMPLE_INTERVAL_MS)
  const mp4Mime = 'video/mp4;codecs=avc1'
  const mimeType = MediaRecorder.isTypeSupported(mp4Mime)
    ? mp4Mime
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
  const isActuallyMp4 = mimeType.startsWith('video/mp4')
  const ext = format === 'mov' ? 'mov' : isActuallyMp4 ? 'mp4' : 'webm'
  const blobType = isActuallyMp4 ? 'video/mp4' : 'video/webm'

  const stream = outputCanvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.start()

  await runCapture(params.code, frame => drawContain(outCtx, frame))

  await new Promise<void>(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: blobType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `ui-walkthrough.${ext}`; a.click()
      URL.revokeObjectURL(url)
      resolve()
    }
    recorder.stop()
  })
}

export async function recordWalkthroughGif(params: WalkthroughExportParams): Promise<void> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')

  const gifWidth = 480
  const gifHeight = Math.round(480 * (OUTPUT_HEIGHT / OUTPUT_WIDTH))
  const canvas = document.createElement('canvas')
  canvas.width = gifWidth
  canvas.height = gifHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const gif = GIFEncoder()
  const delay = Math.round(SAMPLE_INTERVAL_MS / 10)

  await runCapture(params.code, frame => {
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, gifWidth, gifHeight)
    const scale = Math.min(gifWidth / frame.width, gifHeight / frame.height)
    const dw = frame.width * scale, dh = frame.height * scale
    ctx.drawImage(frame, (gifWidth - dw) / 2, (gifHeight - dh) / 2, dw, dh)
    const imageData = ctx.getImageData(0, 0, gifWidth, gifHeight)
    const palette = quantize(imageData.data, 256)
    const index = applyPalette(imageData.data, palette)
    gif.writeFrame(index, gifWidth, gifHeight, { palette, delay })
  })

  gif.finish()
  const blob = new Blob([gif.bytes() as BlobPart], { type: 'image/gif' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'ui-walkthrough.gif'; a.click()
  URL.revokeObjectURL(url)
}
