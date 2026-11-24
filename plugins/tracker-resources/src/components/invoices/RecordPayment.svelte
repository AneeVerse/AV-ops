<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import presentation, { getClient } from '@hcengineering/presentation'
  import { type Invoice, type InvoicePayment } from '@hcengineering/tracker'
  import { Button, IconClose, Label } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import {
    formatINR,
    fromDateInput,
    invoiceBalance,
    invoicePaidAmount,
    sumPayments,
    toDateInput
  } from '../../invoiceMath'
  import trackerRes from '../../plugin'

  export let invoice: Invoice

  const dispatch = createEventDispatcher()
  const client = getClient()

  let amount = ''
  let note = ''
  let paymentDate = Date.now()
  let saving = false
  let error = ''

  $: balance = invoiceBalance(invoice)
  $: paid = invoicePaidAmount(invoice)

  async function save (): Promise<void> {
    const value = Math.round((Number(amount) || 0) * 100) / 100
    if (value <= 0) {
      error = 'Enter a payment amount greater than zero.'
      return
    }
    if (value > balance + 0.001) {
      error = `Amount cannot exceed balance due (${formatINR(balance)}).`
      return
    }
    saving = true
    error = ''
    try {
      const payments: InvoicePayment[] = [...(invoice.payments ?? []), {
        date: paymentDate,
        amount: value,
        note: note.trim() === '' ? undefined : note.trim()
      }]
      const paidAmount = sumPayments(payments)
      await client.update(invoice, { payments, paidAmount })
      dispatch('close')
    } catch (err: any) {
      error = err?.message ?? String(err)
      saving = false
    }
  }
</script>

<div class="pay-popup">
  <div class="pay-head">
    <div>
      <div class="pay-title"><Label label={trackerRes.string.RecordPayment} /></div>
      <div class="pay-sub">{invoice.number} · Balance {formatINR(balance)}</div>
    </div>
    <Button icon={IconClose} kind={'ghost'} size={'small'} on:click={() => dispatch('close')} />
  </div>
  <div class="pay-stats">
    <div><span>Total</span><strong>{formatINR(invoice.total)}</strong></div>
    <div><span>Paid</span><strong>{formatINR(paid)}</strong></div>
    <div><span>Due</span><strong>{formatINR(balance)}</strong></div>
  </div>
  <label class="pay-field">
    <span>Amount</span>
    <input class="av-input" type="number" min="0" step="0.01" bind:value={amount} placeholder="0.00" />
  </label>
  <label class="pay-field">
    <span>Date</span>
    <input
      class="av-input"
      type="date"
      value={toDateInput(paymentDate)}
      on:change={(e) => { paymentDate = fromDateInput(e.currentTarget.value) }}
    />
  </label>
  <label class="pay-field">
    <span>Note (optional)</span>
    <input class="av-input" bind:value={note} placeholder="UPI / NEFT / cheque ref" />
  </label>
  {#if error !== ''}
    <div class="pay-error">{error}</div>
  {/if}
  <div class="pay-actions">
    <Button
      label={presentation.string.Save}
      kind={'primary'}
      size={'medium'}
      loading={saving}
      disabled={saving || balance <= 0}
      on:click={() => { void save() }}
    />
  </div>
</div>

<style lang="scss">
  .pay-popup {
    width: min(22rem, 92vw);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--theme-popup-color);
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.5rem;
  }
  .pay-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .pay-title { font-weight: 600; font-size: 1rem; }
  .pay-sub { font-size: 0.8rem; color: var(--theme-dark-color); margin-top: 0.15rem; }
  .pay-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    background: var(--theme-bg-accent-color);
    border-radius: 0.35rem;
    div { display: flex; flex-direction: column; gap: 0.15rem; }
    span { font-size: 0.7rem; color: var(--theme-dark-color); text-transform: uppercase; }
    strong { font-variant-numeric: tabular-nums; }
  }
  .pay-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    span { font-size: 0.75rem; color: var(--theme-dark-color); }
  }
  .av-input {
    width: 100%;
    border: 1px solid var(--theme-divider-color);
    background: var(--theme-button-default);
    color: var(--theme-caption-color);
    border-radius: 0.25rem;
    padding: 0.4rem 0.5rem;
    font: inherit;
  }
  .pay-error { color: var(--theme-warning-color); font-size: 0.8rem; }
  .pay-actions { display: flex; justify-content: flex-end; }
</style>
