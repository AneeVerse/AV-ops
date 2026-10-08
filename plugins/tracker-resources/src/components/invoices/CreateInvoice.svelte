<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { type Organization } from '@hcengineering/contact'
  import contact from '@hcengineering/contact'
  import { getCurrentAccount, type Ref } from '@hcengineering/core'
  import presentation, { Card, getClient } from '@hcengineering/presentation'
  import tracker, {
    type Invoice,
    type InvoiceItemTemplate,
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
    DEFAULT_ITEM_TEMPLATES,
    DEFAULT_PLACE_OF_SUPPLY,
    cloneParty,
    loadWorkspaceBilledBy,
    persistWorkspaceBilledBy
  } from '../../aneeverseBilling'
  import {
    DEFAULT_SIGNATORY,
    SIGNATORIES
  } from '../../aneeverseSignatures'
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
  let selectedCompanyId: Ref<Organization> | undefined = value?.company
  let billedBy: InvoiceParty = value?.billedBy != null ? cloneParty(value.billedBy) : cloneParty(ANEEVERSE_BILLED_BY)
  let billedByProfile: InvoiceProfile | undefined
  let billedTo: InvoiceParty = value?.billedTo ?? emptyParty()
  let invoiceDate = value?.invoiceDate ?? Date.now()
  let dueDate = value?.dueDate ?? Date.now() + DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000
  let placeOfSupply = value?.placeOfSupply ?? DEFAULT_PLACE_OF_SUPPLY
  let countryOfSupply = value?.countryOfSupply ?? DEFAULT_COUNTRY_OF_SUPPLY
  let items: InvoiceLine[] = value?.items?.length ? value.items.map((item) => ({ ...item })) : [emptyLine()]
  let invoiceNumber = value?.number ?? ''
  let signatory: string = value?.signatory ?? DEFAULT_SIGNATORY
  let availableTemplates: InvoiceItemTemplate[] = DEFAULT_ITEM_TEMPLATES ?? []
  let saving = false
  let error = ''

  const signatoryItems = [
    { id: 'Abhijeet', label: 'Abhijeet (Abhijeet K)' },
    { id: 'Ahmad', label: 'Ahmad' }
  ] as DropdownTextItem[]
  $: templateItems = [
    { id: '__other__', label: 'Other (custom item)' },
    ...availableTemplates.map((template) => ({ id: template.title, label: template.title }))
  ] as DropdownTextItem[]

  $: selectedProject = (projects ?? []).find((p) => p._id === selectedSpace)
  $: selectedProjectId = selectedSpace as string | undefined

  $: projectItems = (projects ?? []).map((project) => {
    const org = project.company !== undefined ? organizations.get(project.company) : undefined
    const orgPrefix = org?.name ? `${org.name} — ` : ''
    return {
      id: project._id,
      label: `${orgPrefix}${project.name}`
    }
  }) as DropdownTextItem[]

  $: orgDropdownItems = [
    { id: '__custom__', label: '— Manual / Custom Client —' },
    ...Array.from(organizations.values())
      .map((org) => ({ id: org._id, label: org.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ] as DropdownTextItem[]

  $: selectedOrgDropdownId = (selectedCompanyId as string | undefined) ?? '__custom__'

  $: hasValidItems = items.some((line) => (line.title ?? '').trim() !== '' && (Number(line.quantity) || 0) > 0)
  $: canSave =
    !saving &&
    selectedSpace !== undefined &&
    (billedBy?.name ?? '').trim() !== '' &&
    (billedTo?.name ?? '').trim() !== '' &&
    hasValidItems

  $: totals = computeTotals(items, placeOfSupply)

  $: previewView = {
    number: invoiceNumber === '' ? 'AV------' : invoiceNumber,
    invoiceDate,
    dueDate,
    billedBy,
    billedTo,
    countryOfSupply,
    placeOfSupply,
    items: items.filter((line) => line.title.trim() !== ''),
    totals,
    signatory
  } as InvoiceView

  void loadRefs()

  async function loadRefs (): Promise<void> {
    try {
      const [loadedProjects, loadedOrgs, loadedBilling] = await Promise.all([
        client.findAll(tracker.class.Project, {}),
        client.findAll(contact.class.Organization, {}),
        loadWorkspaceBilledBy(client)
      ])
      projects = loadedProjects
      organizations = new Map(loadedOrgs.map((org) => [org._id, org]))
      billedByProfile = loadedBilling.profile
      if (loadedBilling.itemTemplates && loadedBilling.itemTemplates.length > 0) {
        availableTemplates = loadedBilling.itemTemplates
      }
      if (value?.signatory != null) {
        signatory = value.signatory
      } else if (loadedBilling.defaultSignatory != null) {
        signatory = loadedBilling.defaultSignatory
      }
      if (value?.billedBy == null) {
        billedBy = loadedBilling.billedBy
      }
      if (invoiceNumber === '') {
        invoiceNumber = await nextInvoiceNumber(client)
      }

      if (value === undefined && items.length === 1 && (items[0].title ?? '') === '' && availableTemplates.length > 0) {
        const first = availableTemplates[0]
        items[0].title = first.title
        items[0].hsn = first.hsn
        items[0].gstRate = first.gstRate
        items[0].quantity = 1
        items = items
      }

      if (selectedSpace === undefined && projects.length > 0) {
        selectedSpace = projects[0]._id
      }

      if (value?.company !== undefined) {
        selectedCompanyId = value.company
      } else if (selectedCompanyId === undefined && selectedSpace !== undefined) {
        const proj = projects.find((p) => p._id === selectedSpace)
        if (proj?.company !== undefined) {
          selectedCompanyId = proj.company
        }
      }

      if (selectedCompanyId !== undefined && (billedTo?.name ?? '') === '') {
        const org = organizations.get(selectedCompanyId)
        if (org !== undefined) {
          billedTo = partyFromOrganization(org)
          if (org.placeOfSupply != null && org.placeOfSupply !== '') {
            placeOfSupply = org.placeOfSupply
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load invoice references:', err)
      error = 'Failed to load data: ' + (err?.message ?? String(err))
    }
  }

  function onProjectSelected (e: CustomEvent<string | undefined>): void {
    selectedSpace = e.detail as Ref<Project> | undefined
    if (selectedSpace !== undefined) {
      const proj = projects.find((p) => p._id === selectedSpace)
      if (proj?.company !== undefined) {
        selectedCompanyId = proj.company
        const org = organizations.get(proj.company)
        if (org !== undefined) {
          billedTo = partyFromOrganization(org)
          if (org.placeOfSupply != null && org.placeOfSupply !== '') {
            placeOfSupply = org.placeOfSupply
          }
        }
      }
    }
  }

  function onOrgSelected (e: CustomEvent<string | undefined>): void {
    const orgId = e.detail as Ref<Organization> | undefined
    if (!orgId || orgId === '__custom__') {
      selectedCompanyId = undefined
      return
    }
    selectedCompanyId = orgId
    const org = organizations.get(orgId)
    if (org !== undefined) {
      billedTo = partyFromOrganization(org)
      if (org.placeOfSupply != null && org.placeOfSupply !== '') {
        placeOfSupply = org.placeOfSupply
      }
    }
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

  function getLineTemplate (line: InvoiceLine): string {
    const list = availableTemplates ?? []
    const match = list.find(
      (t) => (t.title ?? '').toLowerCase().trim() === (line?.title ?? '').toLowerCase().trim()
    )
    return match ? match.title : '__other__'
  }

  function onLineTemplateChange (index: number, templateTitle: string): void {
    if (templateTitle === '__other__') {
      items[index].title = ''
      items[index].hsn = ''
      items[index].gstRate = 18
      items = items
      return
    }
    const list = availableTemplates ?? []
    const t = list.find((tmpl) => tmpl.title === templateTitle)
    if (t) {
      items[index].title = t.title
      items[index].hsn = t.hsn
      items[index].gstRate = t.gstRate
      if (!items[index].quantity || items[index].quantity <= 0) items[index].quantity = 1
      items = items
    }
  }

  async function save (): Promise<void> {
    if (selectedSpace === undefined) {
      error = 'Please select a project.'
      return
    }
    const billedToName = (billedTo?.name ?? '').trim()
    if (billedToName === '') {
      error = 'Please enter client name in Billed to.'
      return
    }
    const filled = items.filter((line) => line.title.trim() !== '')
    if (filled.length === 0) {
      error = 'Add at least one line item with a title.'
      return
    }
    saving = true
    error = ''
    try {
      const computed = computeTotals(filled, placeOfSupply)
      const billedByParty = cloneParty(billedBy)
      const billedToParty = cloneParty(billedTo)

      const updatedTemplates = [...availableTemplates]
      for (const line of filled) {
        const title = line.title.trim()
        if (title && !updatedTemplates.some((t) => t.title.toLowerCase() === title.toLowerCase())) {
          updatedTemplates.push({
            title,
            hsn: line.hsn.trim() || '998314',
            gstRate: Number(line.gstRate) || 0
          })
        }
      }

      await persistWorkspaceBilledBy(client, billedByProfile, billedByParty, updatedTemplates, signatory)

      const targetCompany = selectedCompanyId ?? selectedProject?.company ?? undefined
      const payload = {
        number: invoiceNumber,
        invoiceDate,
        dueDate,
        company: targetCompany,
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
        signatory,
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
      if (targetCompany !== undefined) {
        const orgToUpdate = organizations.get(targetCompany)
        if (orgToUpdate !== undefined) {
          await client.update(orgToUpdate, {
            billingAddress: billedToParty.address,
            gstin: billedToParty.gstin,
            pan: billedToParty.pan,
            billingPhone: billedToParty.phone,
            placeOfSupply: placeOfSupply.trim() || DEFAULT_PLACE_OF_SUPPLY
          })
        }
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
  okLabel={value === undefined ? presentation.string.Create : presentation.string.Save}
  {canSave}
  width={'large'}
  fullSize
  hideFooter
  hideClose
  on:close={() => dispatch('close')}
>
  <svelte:fragment slot="title">
    <div class="invoice-card-title">
      <span class="invoice-card-title__label">
        <Label label={value === undefined ? trackerRes.string.NewInvoice : trackerRes.string.Invoice} />
      </span>
      <div class="invoice-card-actions">
        <Button
          loading={saving}
          minWidth={'5rem'}
          disabled={!canSave}
          label={value === undefined ? presentation.string.Create : presentation.string.Save}
          kind={'primary'}
          size={'medium'}
          on:click={() => { void save().catch(() => {}) }}
        />
        <Button
          id="card-close"
          icon={IconClose}
          iconProps={{ size: 'medium', fill: 'var(--theme-dark-color)' }}
          kind={'ghost'}
          size={'small'}
          on:click={() => dispatch('close')}
        />
      </div>
    </div>
  </svelte:fragment>
  <div class="invoice-split-container">
    <div class="invoice-form-column">
      <div class="row">
        {#if currentSpace === undefined}
          <div class="field grow">
            <span class="lbl"><Label label={trackerRes.string.Project} /></span>
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
              on:selected={onProjectSelected}
            />
          </div>
        {/if}
        <div class="field grow">
          <span class="lbl"><Label label={trackerRes.string.Company} /></span>
          <DropdownLabels
            items={orgDropdownItems}
            selected={selectedOrgDropdownId}
            autoSelect={false}
            enableSearch
            showDropdownIcon
            kind={'regular'}
            size={'medium'}
            width={'100%'}
            justify={'left'}
            on:selected={onOrgSelected}
          />
        </div>
      </div>

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
        <textarea class="av-area" bind:value={billedBy.address} rows="2" on:input={() => { billedBy = billedBy }}></textarea>
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
        <textarea class="av-area" bind:value={billedTo.address} rows="2" on:input={() => { billedTo = billedTo }}></textarea>
      </div>
      <div class="row">
        <div class="field">
          <span class="lbl">GSTIN</span>
          <input class="av-input" bind:value={billedTo.gstin} on:input={() => { billedTo = billedTo }} />
        </div>
        <div class="field">
          <span class="lbl">PAN</span>
          <input class="av-input" bind:value={billedTo.pan} on:input={() => { billedTo = billedTo }} />
        </div>
        <div class="field">
          <span class="lbl">Phone</span>
          <input class="av-input" bind:value={billedTo.phone} on:input={() => { billedTo = billedTo }} />
        </div>
      </div>

      <div class="row">
        <div class="field grow">
          <span class="lbl">Authorised Signatory</span>
          <DropdownLabels items={signatoryItems} bind:selected={signatory} autoSelect={false} showDropdownIcon kind={'regular'} size={'medium'} width={'100%'} justify={'left'} dataId="invoice-signatory" />
        </div>
      </div>

      <div class="lines-head">
        <Label label={trackerRes.string.InvoiceItems} />
        <Button label={trackerRes.string.AddLine} kind={'link'} size={'small'} on:click={addLine} />
      </div>
      <div class="lines">
        <div class="line line-head">
          <span class="item-col"><Label label={trackerRes.string.LineItem} /></span>
          <span class="hsn"><Label label={trackerRes.string.HsnSac} /></span>
          <span class="num"><Label label={trackerRes.string.GstRate} /></span>
          <span class="num"><Label label={trackerRes.string.Quantity} /></span>
          <span class="num"><Label label={trackerRes.string.Rate} /></span>
          <span class="act"></span>
        </div>
        {#each items as line, index}
          <div class="line">
            <div class="item-col">
              <DropdownLabels
                items={templateItems}
                selected={getLineTemplate(line)}
                autoSelect={false}
                enableSearch
                showDropdownIcon
                kind={'regular'}
                size={'medium'}
                width={'100%'}
                justify={'left'}
                dataId={`invoice-item-${index}`}
                on:selected={(e) => onLineTemplateChange(index, String(e.detail))}
              />
              {#if getLineTemplate(line) === '__other__'}
                <input
                  class="av-input mt-1"
                  placeholder="Custom item name"
                  bind:value={line.title}
                  on:input={() => { items = items }}
                />
              {/if}
            </div>
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

      {#if !canSave && !saving}
        <div class="warn-hint">
          {#if selectedSpace === undefined}
            <span>Select a project</span>
          {:else if (billedBy?.name ?? '').trim() === ''}
            <span>Enter your details in "Billed by"</span>
          {:else if (billedTo?.name ?? '').trim() === ''}
            <span>Enter client name in "Billed to"</span>
          {:else if !hasValidItems}
            <span>Add at least one line item with a title and quantity &gt; 0</span>
          {/if}
        </div>
      {/if}

      {#if error !== ''}
        <div class="warn">{error}</div>
      {/if}
    </div>

    <div class="invoice-preview-column">
      <div class="preview-header">
        <Label label={trackerRes.string.Preview} />
        <span class="preview-sub">Live output preview</span>
      </div>
      <div class="preview-scroll">
        <InvoiceDocument view={previewView} scale="fit" />
      </div>
    </div>
  </div>
</Card>

<style lang="scss">
  :global(.antiCard:has(.invoice-split-container)) {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    max-width: none !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    margin: 0 !important;
    border-radius: 0 !important;
    display: flex;
    flex-direction: column;
  }
  :global(.antiCard:has(.invoice-split-container) .antiCard-header__title-wrap),
  :global(.antiCard:has(.invoice-split-container) .antiCard-header__title) {
    flex: 1 1 auto;
    width: 100%;
    max-width: 100%;
    overflow: visible;
    white-space: normal;
  }
  :global(.antiCard:has(.invoice-split-container) .antiCard-content) {
    flex: 1;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 0;
    overflow: hidden;
  }
  :global(.antiCard:has(.invoice-split-container) .antiCard-content > .scroller-container) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }
  :global(.antiCard:has(.invoice-split-container) .antiCard-header) {
    flex-shrink: 0;
  }
  :global(.antiCard:has(.invoice-split-container) .antiCard-content .scroll),
  :global(.antiCard:has(.invoice-split-container) .antiCard-content .scroll > .box) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .invoice-card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-width: 0;
  }
  .invoice-card-title__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .invoice-card-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .invoice-split-container {
    display: flex;
    flex-direction: row;
    gap: 1.5rem;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }
  .invoice-form-column {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    overflow-y: auto;
    padding-right: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .invoice-preview-column {
    flex: 0 0 38%;
    width: 38%;
    max-width: 42%;
    min-width: 24rem;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--theme-bg-accent-color);
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.5rem;
    padding: 0.75rem;
    overflow: hidden;
  }
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--theme-divider-color);
    font-weight: 600;
  }
  .preview-sub {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
  .preview-scroll {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    width: 100%;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
  .av-input, .av-area, .av-select {
    width: 100%;
    border: 1px solid var(--theme-divider-color);
    background: var(--theme-button-default);
    color: var(--theme-caption-color);
    border-radius: 0.25rem;
    padding: 0.35rem 0.5rem;
    font: inherit;
  }
  .av-select {
    cursor: pointer;
  }
  :global(html.theme-dark) .av-input,
  :global(html.theme-dark) .av-select {
    color-scheme: dark;
  }
  :global(html.theme-light) .av-input,
  :global(html.theme-light) .av-select {
    color-scheme: light;
  }
  .av-area { resize: vertical; }
  .mt-1 { margin-top: 0.35rem; }
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
    align-items: flex-start;
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
  .item-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .hsn { width: 5.5rem; flex: 0 0 5.5rem; }
  .num { width: 4.5rem; flex: 0 0 4.5rem; }
  .act { width: 2rem; flex: 0 0 2rem; display: flex; justify-content: center; padding-top: 0.2rem; }
  .warn { color: var(--theme-warning-color); font-size: 0.85rem; }
  .warn-hint {
    color: var(--theme-warning-color, #f59e0b);
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 4px;
    margin-top: 0.25rem;
  }
  @media (max-width: 900px) {
    .invoice-split-container {
      flex-direction: column;
      gap: 0.75rem;
    }
    .invoice-form-column, .invoice-preview-column {
      flex: 1 1 50%;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      min-height: 0;
    }
    .preview-scroll {
      width: 100%;
      height: auto;
    }
    .row { flex-wrap: wrap; }
    .lines { overflow-x: auto; flex-shrink: 0; }
    .line { min-width: 36rem; }
  }
</style>
