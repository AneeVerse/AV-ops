<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import trackerRes from '../../plugin'
  import InvoicesBrowser from './InvoicesBrowser.svelte'
  export let model: { id: string } | undefined = undefined
</script>

<InvoicesBrowser navigationOnly={model?.id === 'invoices-navigation'} title={trackerRes.string.AllInvoices} />
