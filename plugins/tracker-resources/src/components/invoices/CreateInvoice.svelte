<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { type Organization } from '@hcengineering/contact'
  import contact from '@hcengineering/contact'
  import { getCurrentAccount, type Ref } from '@hcengineering/core'
  import { Card, getClient } from '@hcengineering/presentation'
  import tracker, {
    type Invoice,
    type InvoiceLine,
    type InvoiceParty,
    type InvoiceProfile,
    type Project
  } from '@hcengineering/tracker'
  import { Button, DropdownLabels, EditBox, IconClose, Label, type DropdownTextItem } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import {
    ANEEVERSE_BILLED_BY,
    DEFAULT_COUNTRY_OF_SUPPLY,
    DEFAULT_DUE_DAYS,
    DEFAULT_PLACE_OF_SUPPLY,
    cloneParty,
    loadWorkspaceBilledBy,
    persistWorkspaceBilledBy
  } from '../../aneeverseBilling'
  import {
    computeTotals,
    emptyLine,
    emptyParty,
    fromDateInput,
    nextInvoiceNumber,
    partyFromOrganization,
    toDateInput
  } from '../../invoiceMath'
  import { type InvoiceView } from '../../invoiceHtml'
  import trackerRes from '../../plugin'
  import InvoiceDocument from './InvoiceDocument.svelte'

  export let currentSpace: Ref<Project> | undefined = undefined
  export let value: Invoice | undefined = undefined

  const dispatch = createEventDispatcher()
  const client = getClient()

  let projects: Project[] = []
  let organizations: Map<Ref<Organization>, Organization> = new Map()
  let selectedSpace: Ref<Project> | undefined = currentSpace ?? value?.space
  let billedBy: InvoiceParty = value?.billedBy != null ? cloneParty(value.billedBy) : cloneParty(ANEEVERSE_BILLED_BY)
  let billedByProfile: InvoiceProfile | undefined
  let billedTo: InvoiceParty = value?.billedTo ?? emptyParty()
  let invoiceDate = value?.invoiceDate ?? Date.now()
  let dueDate = value?.dueDate ?? Date.now() + DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000
  let placeOfSupply = value?.placeOfSupply ?? DEFAULT_PLACE_OF_SUPPLY
  let countryOfSupply = value?.countryOfSupply ?? DEFAULT_COUNTRY_OF_SUPPLY
  let items: InvoiceLine[] = value?.items?.length ? value.items.map((item) => ({ ...item })) : [emptyLine()]
  let invoiceNumber = value?.number ?? ''
  let saving = false
  let error = ''

  $: selectedProject = projects.find((p) => p._id === selectedSpace)
  $: company = selectedProject?.company !== undefined ? organizations.get(selectedProject.company) : undefined
  $: selectableProjects = projects.filter(
    (p) => p.company != null && p.members.includes(getCurrentAccount().uuid)
  )
  $: projectItems = selectableProjects.map((project) => ({
    id: project._id,
    label: `${(project.company !== undefined ? organizations.get(project.company)?.name : undefined) ?? 'Company'} — ${project.name}`
  })) as DropdownTextItem[]
  $: selectedProjectId = selectedSpace as string | undefined
  $: totals = computeTotals(items, placeOfSupply)
  $: canSave =
    !saving &&
    selectedSpace !== undefined &&
    selectedProject?.company !== undefined &&
    billedBy.name.trim() !== '' &&
    billedTo.name.trim() !== '' &&
    items.some((line) => line.title.trim() !== '' && line.quantity > 0)

  $: previewView = {
    number: invoiceNumber === '' ? 'AV------' : invoiceNumber,
    invoiceDate,
    dueDate,
    billedBy,
    billedTo,
    countryOfSupply,
    placeOfSupply,
    items: items.filter((line) => line.title.trim() !== ''),
    totals
  } as InvoiceView

  void loadRefs()

  async function loadRefs (): Promise<void> {
    projects = await client.findAll(tracker.class.Project, {})
    const orgs = await client.findAll(contact.class.Organization, {})
    organizations = new Map(orgs.map((org) => [org._id, org]))
    if (selectedSpace !== undefined && billedTo.name === '') {
      const proj = projects.find((p) => p._id === selectedSpace)
      const org = proj?.company !== undefined ? organizations.get(proj.company) : undefined
      if (org !== undefined) {
        billedTo = partyFromOrganization(org)
        if (org.placeOfSupply != null && org.placeOfSupply !== '') {
          placeOfSupply = org.placeOfSupply
        }
      }
    }
    const loaded = await loadWorkspaceBilledBy(client)
    billedByProfile = loaded.profile
    if (value?.billedBy == null) {
      billedBy = loaded.billedBy
    }
    if (invoiceNumber === '') {
      invoiceNumber = await nextInvoiceNumber(client)
    }
  }

  function applyCompanyPrefill (): void {
    const proj = projects.find((p) => p._id === selectedSpace)
    const org = proj?.company !== undefined ? organizations.get(proj.company) : undefined
    if (org === undefined) return
    billedTo = partyFromOrganization(org)
    if (org.placeOfSupply != null && org.placeOfSupply !== '') {
      placeOfSupply = org.placeOfSupply
    }
  }

  function onProjectChange (): void {
    billedTo = emptyParty()
    applyCompanyPrefill()
  }

  function onProjectSelected (e: CustomEvent<string | undefined>): void {
    selectedSpace = e.detail as Ref<Project> | undefined
    onProjectChange()
  }

  function addLine (): void {
    items = [...items, emptyLine()]
  }

  function removeLine (index: number): void {
    if (items.length === 1) {
      items = [emptyLine()]
      return
    }
    items = items.filter((_, i) => i !== index)
  }

  async function save (): Promise<void> {
    if (selectedSpace === undefined || selectedProject?.company === undefined) {
      error = 'Pick a project that has a company.'
      return
    }
    const filled = items.filter((line) => line.title.trim() !== '')
    if (filled.length === 0) {
      error = 'Add at least one line item.'
      return
    }
    saving = true
    error = ''
    try {
      const computed = computeTotals(filled, placeOfSupply)
      const billedByParty = cloneParty(billedBy)
      const billedToParty = cloneParty(billedTo)
      await persistWorkspaceBilledBy(client, billedByProfile, billedByParty)
      const payload = {
        number: invoiceNumber,
        invoiceDate,
        dueDate,
        company: selectedProject.company,
        billedBy: billedByParty,
        billedTo: billedToParty,
        countryOfSupply: countryOfSupply.trim() || DEFAULT_COUNTRY_OF_SUPPLY,
        placeOfSupply: placeOfSupply.trim() || DEFAULT_PLACE_OF_SUPPLY,
        items: filled.map((line) => ({
          title: line.title.trim(),
          hsn: line.hsn.trim() || '998314',
          gstRate: Number(line.gstRate) || 0,
          quantity: Number(line.quantity) || 0,
          rate: Number(line.rate) || 0
        })),
        amount: computed.amount,
        cgst: computed.cgst,
        sgst: computed.sgst,
        igst: computed.igst,
        total: computed.total
      }
      if (value === undefined) {
        await client.createDoc(tracker.class.Invoice, selectedSpace, payload)
      } else {
        await client.update(value, payload)
      }
      if (company !== undefined) {
        await client.update(company, {
          billingAddress: billedToParty.address,
          gstin: billedToParty.gstin,
          pan: billedToParty.pan,
          billingPhone: billedToParty.phone,
          placeOfSupply: placeOfSupply.trim() || DEFAULT_PLACE_OF_SUPPLY
        })
      }
      dispatch('close')
    } catch (err: any) {
      error = err?.message ?? String(err)
      saving = false
      throw err
    }
  }
</script>

<Card
  label={value === undefined ? trackerRes.string.NewInvoice : trackerRes.string.Invoice}
  okAction={save}
  {canSave}
  width={'large'}
  fullSize
  on:close={() => dispatch('close')}
>
  <div class="invoice-form">
    {#if currentSpace === undefined}
      <div class="field">
        <Label label={trackerRes.string.SelectProject} />
        <DropdownLabels
          items={projectItems}
          selected={selectedProjectId}
          autoSelect={false}
          enableSearch
          showDropdownIcon
          kind={'regular'}
          size={'medium'}
          width={'100%'}
          justify={'left'}
          label={trackerRes.string.SelectProject}
          on:selected={onProjectSelected}
        />
      </div>
    {/if}

    {#if selectedProject !== undefined && selectedProject.company === undefined}
      <div class="warn">
        <Label label={trackerRes.string.NoCompanyOnProject} />
      </div>
    {/if}

    <div class="row">
      <div class="field">
        <span class="lbl">Invoice date</span>
        <input class="av-input" type="date" value={toDateInput(invoiceDate)} on:change={(e) => {
          invoiceDate = fromDateInput(e.currentTarget.value)
        }} />
      </div>
      <div class="field">
        <span class="lbl">Due date</span>
        <input class="av-input" type="date" value={toDateInput(dueDate)} on:change={(e) => {
          dueDate = fromDateInput(e.currentTarget.value)
        }} />
      </div>
      <div class="field">
        <span class="lbl">Place of supply</span>
        <EditBox bind:value={placeOfSupply} placeholder={trackerRes.string.PlaceOfSupply} />
      </div>
    </div>

    <div class="row">
      <div class="field grow">
        <span class="lbl">Billed by (your details — saved for next invoices)</span>
        <EditBox bind:value={billedBy.name} placeholder={trackerRes.string.BilledBy} on:change={() => { billedBy = billedBy }} />
      </div>
    </div>
    <div class="field">
      <span class="lbl">Your address</span>
      <textarea class="av-area" bind:value={billedBy.address} rows="3" on:input={() => { billedBy = billedBy }}></textarea>
    </div>
    <div class="row">
      <div class="field">
        <span class="lbl">GSTIN</span>
        <input class="av-input" bind:value={billedBy.gstin} on:input={() => { billedBy = billedBy }} />
      </div>
      <div class="field">
        <span class="lbl">PAN</span>
        <input class="av-input" bind:value={billedBy.pan} on:input={() => { billedBy = billedBy }} />
      </div>
      <div class="field">
        <span class="lbl">Phone</span>
        <input class="av-input" bind:value={billedBy.phone} on:input={() => { billedBy = billedBy }} />
      </div>
    </div>

    <div class="row">
      <div class="field grow">
        <span class="lbl">Billed to (client — saved on the company)</span>
        <EditBox bind:value={billedTo.name} placeholder={trackerRes.string.BilledTo} on:change={() => { billedTo = billedTo }} />
      </div>
    </div>
    <div class="field">
      <span class="lbl">Client address</span>
      <textarea class="av-area" bind:value={billedTo.address} rows="3" on:input={() => { billedTo = billedTo }}></textarea>
    </div>
    <div class="row">
      <div class="field">
        <span class="lbl">GSTIN</span>
        <input class="av-input" bind:value={billedTo.gstin} />
      </div>
      <div class="field">
        <span class="lbl">PAN</span>
        <input class="av-input" bind:value={billedTo.pan} />
      </div>
      <div class="field">
        <span class="lbl">Phone</span>
        <input class="av-input" bind:value={billedTo.phone} />
      </div>
    </div>

    <div class="lines-head">
      <Label label={trackerRes.string.InvoiceItems} />
      <Button label={trackerRes.string.AddLine} kind={'link'} size={'small'} on:click={addLine} />
    </div>
    <div class="lines">
      <div class="line line-head">
        <span class="grow"><Label label={trackerRes.string.LineItem} /></span>
        <span class="hsn"><Label label={trackerRes.string.HsnSac} /></span>
        <span class="num"><Label label={trackerRes.string.GstRate} /></span>
        <span class="num"><Label label={trackerRes.string.Quantity} /></span>
        <span class="num"><Label label={trackerRes.string.Rate} /></span>
        <span class="act"></span>
      </div>
      {#each items as line, index}
        <div class="line">
          <input class="av-input grow" placeholder="Item" bind:value={line.title} on:input={() => { items = items }} />
          <input class="av-input hsn" placeholder="HSN/SAC" bind:value={line.hsn} on:input={() => { items = items }} />
          <input class="av-input num" type="number" min="0" step="1" bind:value={line.gstRate} title="GST %" on:input={() => { items = items }} />
          <input class="av-input num" type="number" min="0" step="1" bind:value={line.quantity} title="Qty" on:input={() => { items = items }} />
          <input class="av-input num" type="number" min="0" step="0.01" bind:value={line.rate} title="Rate" on:input={() => { items = items }} />
          <span class="act">
            <Button icon={IconClose} kind={'ghost'} size={'small'} on:click={() => { removeLine(index) }} />
          </span>
        </div>
      {/each}
    </div>

    {#if error !== ''}
      <div class="warn">{error}</div>
    {/if}

    <div class="preview-label">
      <Label label={trackerRes.string.Preview} />
    </div>
    <InvoiceDocument view={previewView} />
  </div>
</Card>

<style lang="scss">
  .invoice-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 42rem;
    max-width: 56rem;
  }
  .row {
    display: flex;
    gap: 0.75rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }
  .field.grow { flex: 2; }
  .lbl {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
  .av-input, .av-area {
    width: 100%;
    border: 1px solid var(--theme-divider-color);
    background: var(--theme-button-default);
    color: var(--theme-caption-color);
    border-radius: 0.25rem;
    padding: 0.35rem 0.5rem;
    font: inherit;
  }
  :global(html.theme-dark) .av-input {
    color-scheme: dark;
  }
  :global(html.theme-light) .av-input {
    color-scheme: light;
  }
  .av-area { resize: vertical; }
  .lines-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }
  .lines { display: flex; flex-direction: column; gap: 0.4rem; }
  .line {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .line-head {
    position: sticky;
    top: 0;
    z-index: 1;
    align-items: flex-end;
    min-height: 1.1rem;
    padding: 0.2rem 0;
    background: var(--theme-popup-color);
    span {
      font-size: 0.7rem;
      color: var(--theme-dark-color);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
  }
  .hsn { width: 6.5rem; flex: 0 0 6.5rem; }
  .num { width: 5.5rem; flex: 0 0 5.5rem; }
  .act { width: 2rem; flex: 0 0 2rem; display: flex; justify-content: center; }
  .grow { flex: 1; min-width: 0; }
  .warn { color: var(--theme-warning-color); font-size: 0.85rem; }
  .preview-label { margin-top: 0.5rem; font-weight: 600; }
</style>
