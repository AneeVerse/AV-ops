<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { resizeObserver } from '@hcengineering/ui'
  import { INVOICE_CSS, invoicePageHtml, type InvoiceView } from '../../invoiceHtml'

  export let view: InvoiceView
  export let scale: 'preview' | 'fit' = 'preview'
  let availableWidth = 0
  let availableHeight = 0
  let paperWidth = 794
  let paperHeight = 1123
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
  $: ratio =
    scale === 'fit' && availableWidth > 0 && availableHeight > 0 && paperWidth > 0 && paperHeight > 0
      ? Math.min(1, availableWidth / paperWidth, availableHeight / paperHeight)
      : 1

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

<div class="av-wrap" class:fit={scale === 'fit'} use:resizeObserver={measurePane}>
  <div
    class="av-preview-frame"
    style:width={scale === 'fit' ? `${paperWidth * ratio}px` : undefined}
    style:height={scale === 'fit' ? `${paperHeight * ratio}px` : undefined}
  >
    <div class="av-preview-paper" style:transform={scale === 'fit' ? `scale(${ratio})` : undefined} use:resizeObserver={measurePaper}>
      {@html invoicePageHtml(view)}
    </div>
  </div>
</div>

<style lang="scss">
  .av-wrap {
    background: #d0d0d0;
    padding: 1rem;
    overflow: auto;
    max-height: 70vh;
  }
  .av-wrap.fit {
    background: transparent;
    padding: 0;
    max-height: none;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    flex: 1 1 auto;
    overflow: hidden;
    position: relative;
  }
  .av-wrap :global(.av-page) {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }
  .av-preview-paper {
    width: 210mm;
    transform-origin: top left;
  }
  .av-wrap.fit .av-preview-frame { position: relative; max-width: 100%; max-height: 100%; }
  .av-wrap.fit .av-preview-paper { position: absolute; top: 0; left: 0; }
</style>
