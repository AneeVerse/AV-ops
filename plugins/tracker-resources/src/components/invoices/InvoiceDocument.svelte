<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { INVOICE_CSS, invoicePageHtml, type InvoiceView } from '../../invoiceHtml'

  export let view: InvoiceView
  export let scale: 'preview' | 'fit' = 'preview'

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

<div class="av-wrap" class:fit={scale === 'fit'}>
  {@html invoicePageHtml(view)}
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
    overflow: visible;
  }
  .av-wrap :global(.av-page) {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }
  .av-wrap.fit :global(.av-page) {
    box-shadow: none;
    width: 100%;
    min-height: 0;
    padding: 0;
  }
</style>
