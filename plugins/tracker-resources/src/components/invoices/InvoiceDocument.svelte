<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { resizeObserver } from '@hcengineering/ui'
  import { INVOICE_CSS, invoicePageHtml, invoicesDocumentHtml, type InvoiceView } from '../../invoiceHtml'

  export let view: InvoiceView
  export let scale: 'preview' | 'fit' = 'preview'
  export let showZoomControls = true

  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 2.5
  const ZOOM_STEP = 0.15

  let availableWidth = 0
  let availableHeight = 0
  let paperWidth = 794
  let paperHeight = 1123
  let userZoom = 1

  function measurePaper (element: Element): void {
    const el = element as HTMLElement
    paperWidth = el.offsetWidth
    paperHeight = el.offsetHeight
  }
  function measurePane (element: Element): void {
    const el = element as HTMLElement
    availableWidth = el.clientWidth
    availableHeight = el.clientHeight
  }

  $: fitRatio =
    scale === 'fit' && availableWidth > 0 && availableHeight > 0 && paperWidth > 0 && paperHeight > 0
      ? Math.min(1, availableWidth / paperWidth, availableHeight / paperHeight)
      : 1
  $: ratio = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fitRatio * userZoom))
  $: zoomLabel = `${Math.round(ratio * 100)}%`
  $: frameWidth = paperWidth * ratio
  $: frameHeight = paperHeight * ratio
  $: canZoomOut = userZoom > ZOOM_MIN + 0.001
  $: canZoomIn = userZoom < ZOOM_MAX - 0.001
  $: isScrolled = scale === 'fit' && userZoom > 1.001

  function zoomIn (): void {
    userZoom = Math.min(ZOOM_MAX, Math.round((userZoom + ZOOM_STEP) * 100) / 100)
  }
  function zoomOut (): void {
    userZoom = Math.max(ZOOM_MIN, Math.round((userZoom - ZOOM_STEP) * 100) / 100)
  }
  function zoomFit (): void {
    userZoom = 1
  }
  function openInNewTab (): void {
    const html = invoicesDocumentHtml([view], view.number || 'Invoice')
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => { URL.revokeObjectURL(url) }, 60_000)
  }

  onMount(() => {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-av-invoice', 'true')
    styleEl.textContent = INVOICE_CSS
    document.head.appendChild(styleEl)
    return () => {
      styleEl.remove()
    }
  })
</script>

{#if scale === 'fit' && showZoomControls}
  <div class="av-zoom-bar">
    <button class="av-zoom-btn" type="button" disabled={!canZoomOut} title="Zoom out" on:click={zoomOut}>−</button>
    <span class="av-zoom-label">{zoomLabel}</span>
    <button class="av-zoom-btn" type="button" disabled={!canZoomIn} title="Zoom in" on:click={zoomIn}>+</button>
    <button class="av-zoom-btn av-zoom-fit" type="button" title="Fit to preview" on:click={zoomFit}>Fit</button>
    <button class="av-zoom-btn av-zoom-tab" type="button" title="Open in new tab" on:click={openInNewTab}>New tab</button>
  </div>
{/if}

<div
  class="av-wrap"
  class:fit={scale === 'fit'}
  class:scrolled={isScrolled}
  use:resizeObserver={measurePane}
>
  <div
    class="av-preview-frame"
    style:width={`${frameWidth}px`}
    style:height={`${frameHeight}px`}
  >
    <div
      class="av-preview-paper"
      style:transform={`scale(${ratio})`}
      use:resizeObserver={measurePaper}
    >
      {@html invoicePageHtml(view)}
    </div>
  </div>
</div>

<style lang="scss">
  .av-zoom-bar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
    margin-bottom: 0.4rem;
  }
  .av-zoom-btn {
    appearance: none;
    border: 1px solid var(--theme-divider-color);
    background: var(--theme-button-default);
    color: var(--theme-caption-color);
    border-radius: 0.3rem;
    min-width: 1.75rem;
    height: 1.75rem;
    padding: 0 0.4rem;
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
    &:not(:disabled):hover {
      background: var(--theme-button-hovered);
    }
  }
  .av-zoom-fit,
  .av-zoom-tab {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    min-width: auto;
  }
  .av-zoom-tab { margin-left: 0.25rem; }
  .av-zoom-label {
    min-width: 3rem;
    text-align: center;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-dark-color);
  }
  .av-wrap {
    background: #d0d0d0;
    padding: 1rem;
    overflow: auto;
    max-height: 70vh;
  }
  .av-wrap.fit {
    background: #c8c8c8;
    padding: 0.5rem;
    max-height: none;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    flex: 1 1 auto;
    overflow: hidden;
    position: relative;
    border-radius: 0.35rem;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .av-wrap.fit.scrolled {
    overflow: auto;
    align-items: flex-start;
    justify-content: flex-start;
  }
  .av-wrap :global(.av-page) {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }
  .av-preview-frame {
    position: relative;
    flex: 0 0 auto;
  }
  .av-preview-paper {
    width: 210mm;
    transform-origin: top left;
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
