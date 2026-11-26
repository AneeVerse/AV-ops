<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { AvatarType, type Organization } from '@hcengineering/contact'
  import contact from '@hcengineering/contact'
  import core, { generateId, getCurrentAccount, type Ref } from '@hcengineering/core'
  import presentation, { Card, getClient } from '@hcengineering/presentation'
  import tracker, {
    type Invoice,
    type InvoiceBank,
    type InvoiceItemTemplate,
    type InvoiceLine,
    type InvoiceParty,
    type InvoicePayment,
    type InvoiceProfile,
    type Project
  } from '@hcengineering/tracker'
  import {
    Button,
    DropdownLabels,
    EditBox,
    IconClose,
    IconEdit,
    Label,
    moveItem,
    type DropdownTextItem
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import {
    allocateInvoiceNumber,
    blankBank,
    blankParty,
    cloneParty,
    DEFAULT_COUNTRY_OF_SUPPLY,
    DEFAULT_DUE_DAYS,
    DEFAULT_ITEM_TEMPLATES,
    DEFAULT_PLACE_OF_SUPPLY,
    ensureBillingSpace,
    isGuestAccount,
    loadWorkspaceBilledBy,
    migrateInvoicesToBilling,
    persistWorkspaceBilledBy
  } from '../../aneeverseBilling'
  import { DEFAULT_SIGNATORY } from '../../aneeverseSignatures'
  import {
    computeTotals,
    emptyLine,
    emptyParty,
    formatINR,
    fromDateInput,
    invoiceStatus,
    invoiceStatusLabel,
    partyFromOrganization,
    sumPayments,
    toDateInput
  } from '../../invoiceMath'
  import { type InvoiceView } from '../../invoiceHtml'
  import trackerRes from '../../plugin'
  import InvoiceDocument from './InvoiceDocument.svelte'

  export let currentSpace: Ref<Project> | undefined = undefined
  export let value: Invoice | undefined = undefined
  export let duplicateFrom: Invoice | undefined = undefined

  const dispatch = createEventDispatcher()
  const client = getClient()
  const seed = value ?? duplicateFrom
  const dueMs = DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000
  const ADD_CLIENT_ID = '__add_client__'
  const NO_PROJECT_ID = '__no_project__'

  function asProject (space: Ref<Project> | undefined): Ref<Project> | undefined {
    if (space === undefined || space === (core.space.Workspace as Ref<Project>)) return undefined
    return space
  }

  let projects: Project[] = []
  let organizations: Map<Ref<Organization>, Organization> = new Map()
  let selectedSpace: Ref<Project> | undefined = seed?.project ?? asProject(seed?.space)
  let selectedCompanyId: Ref<Organization> | undefined = seed?.company
  let billedBy: InvoiceParty = seed?.billedBy != null ? cloneParty(seed.billedBy) : blankParty()
  let billedByProfile: InvoiceProfile | undefined
  let bank: InvoiceBank = seed?.bank != null ? { ...blankBank(), ...seed.bank } : blankBank()
  let billedTo: InvoiceParty = seed?.billedTo != null ? cloneParty(seed.billedTo) : emptyParty()
  let invoiceDate = value?.invoiceDate ?? Date.now()
  let dueDate = value?.dueDate ?? Date.now() + dueMs
  let placeOfSupply = seed?.placeOfSupply ?? DEFAULT_PLACE_OF_SUPPLY
  let countryOfSupply = seed?.countryOfSupply ?? DEFAULT_COUNTRY_OF_SUPPLY
  let items: InvoiceLine[] = seed?.items?.length ? seed.items.map((item) => ({ ...item })) : [emptyLine()]
  let invoiceNumber = value?.number ?? ''
  let signatory: string = seed?.signatory ?? DEFAULT_SIGNATORY
  let notes = value?.notes ?? duplicateFrom?.notes ?? ''
  let payments: InvoicePayment[] = (value?.payments ?? []).map((p) => ({ ...p }))
  let copiedFromNumber = value === undefined ? (duplicateFrom?.number ?? '') : ''
  let availableTemplates: InvoiceItemTemplate[] = DEFAULT_ITEM_TEMPLATES ?? []
  let saving = false
  let error = ''
  let editingBilledBy = false
  let editingClient = seed?.company === undefined && (seed?.billedTo?.name ?? '') !== ''
  let addingClient = false
  let paymentAmount = ''
  let paymentNote = ''
  let paymentDate = Date.now()

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
  // Locked only when opened from a project tab. From All invoices (create or edit) you can change it.
  $: canPickProject = currentSpace === undefined

  $: projectItems = [
    { id: NO_PROJECT_ID, label: 'No project' },
    ...(projects ?? []).map((project) => {
      const org = project.company !== undefined ? organizations.get(project.company) : undefined
      const orgPrefix = org?.name ? `${org.name} — ` : ''
      return {
        id: project._id,
        label: `${orgPrefix}${project.name}`
      }
    })
  ] as DropdownTextItem[]

  $: orgDropdownItems = [
    { id: ADD_CLIENT_ID, label: '+ Add new client' },
    ...Array.from(organizations.values())
      .map((org) => ({ id: org._id, label: org.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ] as DropdownTextItem[]

  $: selectedOrgDropdownId = addingClient
    ? ADD_CLIENT_ID
    : ((selectedCompanyId as string | undefined) ?? '')

  $: hasValidItems = items.some((line) => (line.title ?? '').trim() !== '' && (Number(line.quantity) || 0) > 0)
  $: canSave =
    !saving &&
    (billedBy?.name ?? '').trim() !== '' &&
    (billedTo?.name ?? '').trim() !== '' &&
    hasValidItems

  $: totals = computeTotals(items, placeOfSupply)
  $: paidAmount = sumPayments(payments)
  $: balanceDue = Math.max(0, Math.round((totals.total - paidAmount) * 100) / 100)
  $: headerStatus = invoiceStatus({
    total: totals.total,
    dueDate,
    payments,
    paidAmount
  })
  $: headerClient = (billedTo?.name ?? '').trim()
  $: headerProject = selectedProject?.name ?? ''
  $: headerNumber = invoiceNumber === '' ? 'AV------' : invoiceNumber

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
    signatory,
    notes: notes.trim(),
    payments,
    paidAmount,
    balanceDue,
    bank
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
      const source = value ?? duplicateFrom
      if (source?.signatory != null) {
        signatory = source.signatory
      } else if (loadedBilling.defaultSignatory != null) {
        signatory = loadedBilling.defaultSignatory
      }
      if (source?.billedBy == null) {
        billedBy = loadedBilling.billedBy
      }
      if (source?.bank == null) {
        bank = loadedBilling.bank
      }
      if (invoiceNumber === '' && value !== undefined) {
        invoiceNumber = value.number
      }

      if (value === undefined && items.length === 1 && (items[0].title ?? '') === '' && availableTemplates.length > 0) {
        const first = availableTemplates[0]
        items[0].title = first.title
        items[0].hsn = first.hsn
        items[0].gstRate = first.gstRate
        items[0].quantity = 1
        items = items
      }

      // From a project tab, keep that project. From All invoices, an empty project is allowed.
      if (selectedSpace === undefined && currentSpace !== undefined) {
        selectedSpace = currentSpace
      }

      if (source?.company !== undefined) {
        selectedCompanyId = source.company
        editingClient = false
        addingClient = false
      } else if (selectedCompanyId === undefined && selectedSpace !== undefined) {
        const proj = projects.find((p) => p._id === selectedSpace)
        if (proj?.company !== undefined) {
          selectedCompanyId = proj.company
        }
      }

      if (selectedCompanyId !== undefined && (billedTo?.name ?? '') === '') {
        applyOrganization(selectedCompanyId)
      }
    } catch (err: any) {
      console.error('Failed to load invoice references:', err)
      error = 'Failed to load data: ' + (err?.message ?? String(err))
    }
  }

  function applyOrganization (orgId: Ref<Organization>): void {
    const org = organizations.get(orgId)
    if (org === undefined) return
    billedTo = partyFromOrganization(org)
    if (org.placeOfSupply != null && org.placeOfSupply !== '') {
      placeOfSupply = org.placeOfSupply
    }
    editingClient = false
    addingClient = false
  }

  function onProjectSelected (e: CustomEvent<string | undefined>): void {
    const id = e.detail
    if (id === undefined || id === NO_PROJECT_ID) {
      selectedSpace = undefined
      return
    }
    selectedSpace = id as Ref<Project>
    const proj = projects.find((p) => p._id === selectedSpace)
    if (proj?.company !== undefined) {
      selectedCompanyId = proj.company
      applyOrganization(proj.company)
    }
  }

  function onOrgSelected (e: CustomEvent<string | undefined>): void {
    const orgId = e.detail as string | undefined
    if (!orgId || orgId === ADD_CLIENT_ID) {
      startAddClient()
      return
    }
    selectedCompanyId = orgId as Ref<Organization>
    applyOrganization(selectedCompanyId)
  }

  function startAddClient (): void {
    addingClient = true
    editingClient = true
    selectedCompanyId = undefined
    billedTo = emptyParty()
  }

  function startEditClient (): void {
    editingClient = true
  }

  function cancelClientEdit (): void {
    if (addingClient && selectedCompanyId === undefined) {
      billedTo = emptyParty()
      addingClient = false
      editingClient = false
      return
    }
    if (selectedCompanyId !== undefined) {
      applyOrganization(selectedCompanyId)
    }
    editingClient = false
    addingClient = false
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

  let lineRows: HTMLElement[] = []
  let dragging = false
  let dragFrom = -1
  let dragTo = -1
  let dragOriginY = 0
  let dragPointer = -1
  let dragOrigins: Array<{ top: number, height: number }> = []

  function visualSlot (index: number): number {
    if (index === dragFrom) return dragTo
    if (dragTo > dragFrom && index > dragFrom && index <= dragTo) return index - 1
    if (dragTo < dragFrom && index >= dragTo && index < dragFrom) return index + 1
    return index
  }

  function paintLineDrag (dy: number): void {
    for (let i = 0; i < items.length; i++) {
      const el = lineRows[i]
      if (el == null) continue
      const y = i === dragFrom
        ? dy
        : dragTo === dragFrom
          ? 0
          : dragOrigins[visualSlot(i)].top - dragOrigins[i].top
      el.style.transform = y === 0 ? '' : `translate3d(0, ${Math.round(y)}px, 0)`
      el.classList.toggle('dragging', i === dragFrom)
    }
  }

  function clearLineDrag (): void {
    for (const el of lineRows) {
      if (el == null) continue
      el.style.transform = ''
      el.classList.remove('dragging')
    }
  }

  function startLineDrag (ev: PointerEvent, index: number): void {
    if (ev.button !== 0 || dragging) return
    const rows = lineRows.slice(0, items.length)
    if (rows.some((el) => el == null)) return
    ev.preventDefault()
    dragOrigins = rows.map((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect()
      return { top: rect.top, height: rect.height }
    })
    dragFrom = index
    dragTo = index
    dragOriginY = ev.clientY
    dragPointer = ev.pointerId
    dragging = true
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    paintLineDrag(0)
  }

  function onLinePointerMove (ev: PointerEvent): void {
    if (!dragging || ev.pointerId !== dragPointer || dragFrom < 0) return
    const dy = ev.clientY - dragOriginY
    const center = dragOrigins[dragFrom].top + dragOrigins[dragFrom].height / 2 + dy
    let next = 0
    for (let i = 0; i < dragOrigins.length; i++) {
      if (center >= dragOrigins[i].top + dragOrigins[i].height / 2) next = i
    }
    dragTo = next
    paintLineDrag(dy)
  }

  function finishLineDrag (ev: PointerEvent): void {
    if (!dragging || ev.pointerId !== dragPointer) return
    const from = dragFrom
    const to = dragTo
    clearLineDrag()
    dragFrom = -1
    dragTo = -1
    dragPointer = -1
    dragOrigins = []
    dragging = false
    if (from >= 0 && to >= 0 && from !== to) items = moveItem(items, from, to)
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

  function addPayment (): void {
    const amt = Math.round((Number(paymentAmount) || 0) * 100) / 100
    if (amt <= 0) {
      error = 'Enter a payment amount greater than zero.'
      return
    }
    if (amt > balanceDue + 0.001) {
      error = `Payment cannot exceed balance due (${formatINR(balanceDue)}).`
      return
    }
    error = ''
    payments = [...payments, {
      date: paymentDate,
      amount: amt,
      note: paymentNote.trim() === '' ? undefined : paymentNote.trim()
    }]
    paymentAmount = ''
    paymentNote = ''
    paymentDate = Date.now()
  }

  function removePayment (index: number): void {
    payments = payments.filter((_, i) => i !== index)
  }

  function updatePaymentAmount (index: number, raw: string): void {
    const amt = Math.round((Number(raw) || 0) * 100) / 100
    payments[index].amount = amt < 0 ? 0 : amt
    payments = payments
    error = ''
  }

  function updatePaymentDate (index: number, raw: string): void {
    payments[index].date = fromDateInput(raw)
    payments = payments
  }

  function updatePaymentNote (index: number, raw: string): void {
    const note = raw.trim()
    payments[index].note = note === '' ? undefined : note
    payments = payments
  }

  async function startDuplicate (): Promise<void> {
    if (value === undefined) return
    copiedFromNumber = value.number
    duplicateFrom = value
    value = undefined
    invoiceDate = Date.now()
    dueDate = Date.now() + dueMs
    invoiceNumber = ''
    payments = []
    notes = duplicateFrom.notes ?? ''
  }

  async function ensureCompany (): Promise<Ref<Organization> | undefined> {
    const billedToParty = cloneParty(billedTo)
    const name = billedToParty.name.trim()
    if (name === '') return undefined

    if (selectedCompanyId !== undefined) {
      const orgToUpdate = organizations.get(selectedCompanyId)
      if (orgToUpdate !== undefined) {
        await client.update(orgToUpdate, {
          name,
          billingAddress: billedToParty.address,
          gstin: billedToParty.gstin,
          pan: billedToParty.pan,
          billingPhone: billedToParty.phone,
          placeOfSupply: placeOfSupply.trim() || DEFAULT_PLACE_OF_SUPPLY
        })
        organizations.set(selectedCompanyId, {
          ...orgToUpdate,
          name,
          billingAddress: billedToParty.address,
          gstin: billedToParty.gstin,
          pan: billedToParty.pan,
          billingPhone: billedToParty.phone,
          placeOfSupply: placeOfSupply.trim() || DEFAULT_PLACE_OF_SUPPLY
        })
        organizations = organizations
      }
      return selectedCompanyId
    }

    const id = generateId<Organization>()
    await client.createDoc(
      contact.class.Organization,
      contact.space.Contacts,
      {
        name,
        members: 0,
        description: null,
        attachments: 0,
        avatarType: AvatarType.COLOR,
        billingAddress: billedToParty.address,
        gstin: billedToParty.gstin,
        pan: billedToParty.pan,
        billingPhone: billedToParty.phone,
        placeOfSupply: placeOfSupply.trim() || DEFAULT_PLACE_OF_SUPPLY
      },
      id
    )
    selectedCompanyId = id
    organizations.set(id, {
      _id: id,
      _class: contact.class.Organization,
      space: contact.space.Contacts,
      modifiedOn: Date.now(),
      modifiedBy: '' as any,
      name,
      members: 0,
      description: null,
      attachments: 0,
      avatarType: AvatarType.COLOR,
      billingAddress: billedToParty.address,
      gstin: billedToParty.gstin,
      pan: billedToParty.pan,
      billingPhone: billedToParty.phone,
      placeOfSupply: placeOfSupply.trim() || DEFAULT_PLACE_OF_SUPPLY
    } as Organization)
    organizations = organizations
    addingClient = false
    editingClient = false
    return id
  }

  async function save (): Promise<void> {
    const billedToName = (billedTo?.name ?? '').trim()
    if (billedToName === '') {
      error = 'Select or add a client.'
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
      const targetCompany = await ensureCompany()

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

      await persistWorkspaceBilledBy(client, billedByProfile, billedByParty, updatedTemplates, signatory, bank)

      if (isGuestAccount(getCurrentAccount().role)) {
        error = 'Guests cannot create invoices.'
        saving = false
        return
      }
      const billing = await ensureBillingSpace(client)
      await migrateInvoicesToBilling(client)
      const number = value === undefined ? await allocateInvoiceNumber(client) : invoiceNumber
      const paid = sumPayments(payments)
      const payload = {
        number,
        invoiceDate,
        dueDate,
        company: targetCompany ?? selectedProject?.company ?? undefined,
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
        notes: notes.trim() === '' ? undefined : notes.trim(),
        payments,
        paidAmount: paid,
        amount: computed.amount,
        cgst: computed.cgst,
        sgst: computed.sgst,
        igst: computed.igst,
        total: computed.total,
        project: selectedSpace,
        bank
      }
      if (value === undefined) {
        await client.createDoc(tracker.class.Invoice, billing, payload)
      } else if (value.space !== billing) {
        await client.update(value, { ...payload, space: billing })
      } else {
        await client.update(value, payload)
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
      <div class="invoice-card-title__left">
        <span class="invoice-card-title__label">
          <Label label={value === undefined ? trackerRes.string.NewInvoice : trackerRes.string.Invoice} />
        </span>
        <span class="invoice-card-title__number" title={headerNumber}>{headerNumber}</span>
      </div>

      <div class="invoice-card-title__meta" title={[headerClient, headerProject].filter(Boolean).join(' · ')}>
        {#if headerClient !== ''}
          <span class="meta-client">{headerClient}</span>
        {:else}
          <span class="meta-muted">No client</span>
        {/if}
        {#if headerProject !== ''}
          <span class="meta-dot">·</span>
          <span class="meta-project">{headerProject}</span>
        {/if}
        <span class="meta-status status--{headerStatus}">{invoiceStatusLabel(headerStatus)}</span>
        <span class="meta-money">
          <span class="meta-money__total">{formatINR(totals.total)}</span>
          <span class="meta-dot">·</span>
          <span class="meta-money__paid">{formatINR(paidAmount)} paid</span>
          <span class="meta-dot">·</span>
          <span class="meta-money__due" class:due={balanceDue > 0}>{formatINR(balanceDue)} due</span>
        </span>
      </div>

      <div class="invoice-card-actions">
        {#if value !== undefined}
          <Button
            label={trackerRes.string.Duplicate}
            kind={'regular'}
            size={'medium'}
            on:click={() => { void startDuplicate() }}
          />
        {/if}
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
      {#if copiedFromNumber !== ''}
        <div class="dup-hint">Copied from {copiedFromNumber}. Saving creates a new invoice.</div>
      {/if}

      <div class="row">
        <div class="field grow">
          <span class="lbl"><Label label={trackerRes.string.Project} /></span>
          {#if canPickProject}
            <DropdownLabels
              items={projectItems}
              selected={selectedProjectId}
              placeholder={trackerRes.string.Project}
              autoSelect={false}
              enableSearch
              showDropdownIcon
              kind={'regular'}
              size={'medium'}
              width={'100%'}
              justify={'left'}
              on:selected={onProjectSelected}
            />
          {:else}
            <div class="project-locked">{selectedProject?.name ?? '—'}</div>
          {/if}
        </div>
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

      <div class="party-grid">
        <div class="party-card">
          <div class="party-card__head">
            <span class="party-card__title">Billed by</span>
            <Button
              icon={IconEdit}
              kind={'ghost'}
              size={'small'}
              showTooltip={{ label: trackerRes.string.EditClient }}
              on:click={() => { editingBilledBy = !editingBilledBy }}
            />
          </div>
          {#if editingBilledBy}
            <div class="field">
              <span class="lbl">Business name</span>
              <EditBox bind:value={billedBy.name} placeholder={trackerRes.string.BilledBy} on:change={() => { billedBy = billedBy }} />
            </div>
            <div class="field">
              <span class="lbl">Address</span>
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
              <div class="field">
                <span class="lbl">Account name</span>
                <input class="av-input" bind:value={bank.accountName} on:input={() => { bank = bank }} />
              </div>
              <div class="field">
                <span class="lbl">Account number</span>
                <input class="av-input" bind:value={bank.accountNumber} on:input={() => { bank = bank }} />
              </div>
            </div>
            <div class="row">
              <div class="field">
                <span class="lbl">IFSC</span>
                <input class="av-input" bind:value={bank.ifsc} on:input={() => { bank = bank }} />
              </div>
              <div class="field">
                <span class="lbl">Account type</span>
                <input class="av-input" bind:value={bank.accountType} on:input={() => { bank = bank }} />
              </div>
              <div class="field">
                <span class="lbl">Bank</span>
                <input class="av-input" bind:value={bank.bank} on:input={() => { bank = bank }} />
              </div>
            </div>
            <div class="party-card__actions">
              <Button label={presentation.string.Save} kind={'ghost'} size={'small'} on:click={() => { editingBilledBy = false }} />
            </div>
          {:else}
            <div class="party-card__name">{billedBy.name || '—'}</div>
            {#if billedBy.address}<div class="party-card__line">{billedBy.address}</div>{/if}
            <div class="party-card__meta">
              {#if billedBy.gstin}<span>GSTIN: {billedBy.gstin}</span>{/if}
              {#if billedBy.pan}<span>PAN: {billedBy.pan}</span>{/if}
              {#if billedBy.phone}<span>{billedBy.phone}</span>{/if}
            </div>
          {/if}
        </div>

        <div class="party-card party-card--client">
          <div class="party-card__head">
            <span class="party-card__title">Billed to</span>
          </div>
          <div class="field">
            <span class="lbl"><Label label={trackerRes.string.SelectClient} /></span>
            <DropdownLabels
              items={orgDropdownItems}
              selected={selectedOrgDropdownId === '' ? undefined : selectedOrgDropdownId}
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
          {#if editingClient || addingClient || (billedTo.name ?? '') === ''}
            <div class="field">
              <span class="lbl">Client name</span>
              <EditBox bind:value={billedTo.name} placeholder={trackerRes.string.BilledTo} on:change={() => { billedTo = billedTo }} />
            </div>
            <div class="field">
              <span class="lbl">Address</span>
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
            <div class="party-card__actions">
              {#if !addingClient && selectedCompanyId !== undefined}
                <Button label={presentation.string.Cancel} kind={'ghost'} size={'small'} on:click={cancelClientEdit} />
              {/if}
              <Button
                label={addingClient ? trackerRes.string.AddClient : presentation.string.Save}
                kind={'primary'}
                size={'small'}
                on:click={() => { editingClient = false; addingClient = false }}
              />
            </div>
          {:else}
            <div class="party-card__body">
              <div class="party-card__name">{billedTo.name}</div>
              {#if billedTo.address}<div class="party-card__line">{billedTo.address}</div>{/if}
              <div class="party-card__meta">
                {#if billedTo.gstin}<span>GSTIN: {billedTo.gstin}</span>{/if}
                {#if billedTo.pan}<span>PAN: {billedTo.pan}</span>{/if}
                {#if billedTo.phone}<span>{billedTo.phone}</span>{/if}
              </div>
              <Button
                icon={IconEdit}
                label={trackerRes.string.EditClient}
                kind={'ghost'}
                size={'small'}
                on:click={startEditClient}
              />
            </div>
          {/if}
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
      <div class="lines" class:is-dragging={dragging}>
        <div class="line line-head">
          <span class="grip"></span>
          <span class="item-col"><Label label={trackerRes.string.LineItem} /></span>
          <span class="hsn"><Label label={trackerRes.string.HsnSac} /></span>
          <span class="num"><Label label={trackerRes.string.GstRate} /></span>
          <span class="num"><Label label={trackerRes.string.Quantity} /></span>
          <span class="num"><Label label={trackerRes.string.Rate} /></span>
          <span class="act"></span>
        </div>
        {#each items as line, index (line)}
          <div class="line" bind:this={lineRows[index]}>
            <button
              type="button"
              class="grip"
              aria-label="Drag to reorder"
              title="Drag to reorder"
              on:pointerdown={(ev) => { startLineDrag(ev, index) }}
              on:pointermove={onLinePointerMove}
              on:pointerup={finishLineDrag}
              on:pointercancel={finishLineDrag}
            >
              <span class="grip-dots"></span>
            </button>
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

      <div class="money-grid">
        <div class="money-card">
          <div class="money-card__title"><Label label={trackerRes.string.InvoicePayments} /></div>
          <div class="money-stats">
            <div><span>Total</span><strong>{formatINR(totals.total)}</strong></div>
            <div><span>Paid</span><strong class="ok">{formatINR(paidAmount)}</strong></div>
            <div><span>Balance</span><strong class:due={balanceDue > 0}>{formatINR(balanceDue)}</strong></div>
          </div>
          {#if payments.length > 0}
            <div class="pay-list">
              <div class="pay-row pay-row-head">
                <span>Date</span>
                <span>Amount</span>
                <span>Note</span>
                <span></span>
              </div>
              {#each payments as payment, index}
                <div class="pay-row">
                  <input
                    class="av-input"
                    type="date"
                    value={toDateInput(payment.date)}
                    on:change={(e) => { updatePaymentDate(index, e.currentTarget.value) }}
                  />
                  <input
                    class="av-input pay-amt-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount}
                    on:input={(e) => { updatePaymentAmount(index, e.currentTarget.value) }}
                  />
                  <input
                    class="av-input grow"
                    type="text"
                    value={payment.note ?? ''}
                    placeholder="Note (optional)"
                    on:input={(e) => { updatePaymentNote(index, e.currentTarget.value) }}
                  />
                  <Button icon={IconClose} kind={'ghost'} size={'small'} on:click={() => { removePayment(index) }} />
                </div>
              {/each}
            </div>
          {/if}
          <div class="pay-form">
            <input class="av-input" type="number" min="0" step="0.01" bind:value={paymentAmount} placeholder="Amount" />
            <input
              class="av-input"
              type="date"
              value={toDateInput(paymentDate)}
              on:change={(e) => { paymentDate = fromDateInput(e.currentTarget.value) }}
            />
            <input class="av-input grow" bind:value={paymentNote} placeholder="Note (optional)" />
            <Button
              label={trackerRes.string.RecordPayment}
              kind={'regular'}
              size={'small'}
              disabled={balanceDue <= 0}
              on:click={addPayment}
            />
          </div>
        </div>
        <div class="money-card">
          <div class="money-card__title"><Label label={trackerRes.string.InvoiceNotes} /></div>
          <textarea
            class="av-area notes-area"
            bind:value={notes}
            rows="4"
            placeholder="Payment terms, delivery notes, or internal reminder…"
          ></textarea>
        </div>
      </div>

      {#if !canSave && !saving}
        <div class="warn-hint">
          {#if (billedBy?.name ?? '').trim() === ''}
            <span>Enter your details in "Billed by"</span>
          {:else if (billedTo?.name ?? '').trim() === ''}
            <span>Select or add a client</span>
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
        <span class="preview-sub">Zoom + / − · scroll · new tab</span>
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
    gap: 0.85rem;
    width: 100%;
    min-width: 0;
  }
  .invoice-card-title__left {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    flex-shrink: 0;
    min-width: 0;
  }
  .invoice-card-title__label {
    font-weight: 600;
    white-space: nowrap;
  }
  .invoice-card-title__number {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--theme-link-color);
    white-space: nowrap;
  }
  .invoice-card-title__meta {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    overflow: hidden;
    white-space: nowrap;
    font-size: 0.82rem;
  }
  .meta-client {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 12rem;
  }
  .meta-project {
    color: var(--theme-dark-color);
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 10rem;
  }
  .meta-muted { color: var(--theme-dark-color); opacity: 0.7; }
  .meta-dot { color: var(--theme-dark-color); opacity: 0.45; flex-shrink: 0; }
  .meta-status {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .meta-status.status--paid {
    color: #047857;
    background: rgba(16, 185, 129, 0.14);
  }
  .meta-status.status--partial {
    color: #1d4ed8;
    background: rgba(59, 130, 246, 0.14);
  }
  .meta-status.status--unpaid {
    color: #92400e;
    background: rgba(245, 158, 11, 0.14);
  }
  .meta-status.status--overdue {
    color: #b91c1c;
    background: rgba(239, 68, 68, 0.14);
  }
  .meta-money {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: 0.15rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-caption-color);
    flex-shrink: 0;
  }
  .meta-money__total { font-weight: 650; }
  .meta-money__paid { color: #10b981; }
  .meta-money__due.due { color: #ef4444; font-weight: 650; }
  .invoice-card-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    margin-left: auto;
  }
  @media (max-width: 1100px) {
    .invoice-card-title__meta { display: none; }
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
    gap: 0;
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
  .project-locked {
    min-height: 2rem;
    display: flex;
    align-items: center;
    padding: 0.35rem 0.55rem;
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.25rem;
    background: var(--theme-button-default);
    font-weight: 600;
  }
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
  .av-select { cursor: pointer; }
  :global(html.theme-dark) .av-input,
  :global(html.theme-dark) .av-select { color-scheme: dark; }
  :global(html.theme-light) .av-input,
  :global(html.theme-light) .av-select { color-scheme: light; }
  .av-area { resize: vertical; }
  .mt-1 { margin-top: 0.35rem; }
  .party-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .party-card {
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.5rem;
    padding: 0.75rem;
    background: var(--theme-bg-accent-color);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .party-card--client {
    border-color: color-mix(in srgb, var(--theme-link-color) 35%, var(--theme-divider-color));
  }
  .party-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .party-card__title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--theme-dark-color);
  }
  .party-card__name {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .party-card__line {
    white-space: pre-wrap;
    font-size: 0.85rem;
    color: var(--theme-caption-color);
  }
  .party-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.85rem;
    font-size: 0.78rem;
    color: var(--theme-dark-color);
  }
  .party-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
  }
  .party-card__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.35rem;
  }
  .lines-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }
  .lines { display: flex; flex-direction: column; gap: 0.4rem; }
  .lines.is-dragging { user-select: none; cursor: grabbing; }
  .lines.is-dragging .line {
    transition: transform 180ms cubic-bezier(0.22, 0.8, 0.24, 1);
  }
  .grip {
    width: 1.85rem;
    flex: 0 0 1.85rem;
    align-self: stretch;
    min-height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 0;
    padding: 0;
    border: 0;
    border-radius: 0.35rem;
    background: transparent;
    color: var(--theme-dark-color);
    cursor: grab;
    touch-action: none;
  }
  .grip:hover { background: var(--theme-button-hovered); }
  .grip-dots {
    width: 0.72rem;
    height: 1.05rem;
    background-image: radial-gradient(currentColor 1.45px, transparent 1.6px);
    background-size: 0.36rem 0.35rem;
    opacity: 0.9;
  }
  .line {
    display: flex;
    gap: 0.4rem;
    align-items: flex-start;
    position: relative;
  }
  .line.dragging {
    z-index: 4;
    border-radius: 0.4rem;
    background: var(--theme-popup-color);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    cursor: grabbing;
    transition: none !important;
  }
  .line.dragging .grip { cursor: grabbing; background: var(--theme-button-hovered); }
  .lines.is-dragging .grip { cursor: grabbing; }
  .line-head .grip { cursor: default; min-height: 0; background: transparent; }
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
  .money-grid {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 0.75rem;
    margin-top: 0.35rem;
  }
  .money-card {
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    background: var(--theme-button-default);
  }
  .money-card__title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--theme-dark-color);
  }
  .money-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    div { display: flex; flex-direction: column; gap: 0.1rem; }
    span { font-size: 0.7rem; color: var(--theme-dark-color); }
    strong { font-variant-numeric: tabular-nums; }
    .ok { color: #10b981; }
    .due { color: #ef4444; }
  }
  .pay-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .pay-row {
    display: grid;
    grid-template-columns: 7.5rem 6.5rem 1fr auto;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.8rem;
    .av-input { width: 100%; min-width: 0; }
    .pay-amt-input { font-variant-numeric: tabular-nums; font-weight: 600; }
    .grow { width: 100%; }
  }
  .pay-row-head {
    span {
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--theme-dark-color);
    }
  }
  .pay-form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    .av-input { width: auto; flex: 0 0 6.5rem; }
    .grow { flex: 1 1 8rem; min-width: 7rem; }
  }
  .notes-area { min-height: 6rem; }
  .warn { color: var(--theme-warning-color); font-size: 0.85rem; }
  .dup-hint {
    color: var(--theme-caption-color);
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
    background: var(--theme-bg-accent-color);
    border: 1px solid var(--theme-divider-color);
    border-radius: 4px;
  }
  .warn-hint {
    color: var(--theme-warning-color, #f59e0b);
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 4px;
    margin-top: 0.25rem;
  }
  @media (max-width: 1100px) {
    .party-grid, .money-grid { grid-template-columns: 1fr; }
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
