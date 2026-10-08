<!--
// Copyright © 2026 AneeVerse
-->
<script context="module" lang="ts">
  import { writable } from 'svelte/store'
  const invoiceCompany = writable('all')
</script>
<script lang="ts">
  import { type Organization } from '@hcengineering/contact'
  import contact from '@hcengineering/contact'
  import { type DocumentQuery, type Ref } from '@hcengineering/core'
  import { createQuery, getClient, MessageBox } from '@hcengineering/presentation'
  import tracker, { type Invoice, type Project } from '@hcengineering/tracker'
  import {
    Breadcrumb,
    Button,
    DropdownLabels,
    Header,
    IconAdd,
    IconDelete,
    IconFile,
    NavItem,
    Scroller,
    showPopup,
    type DropdownTextItem
  } from '@hcengineering/ui'
  import { formatINR, formatInvoiceDate, monthKey, monthLabel } from '../../invoiceMath'
  import { invoiceToView } from '../../invoiceHtml'
  import { printInvoices } from '../../invoicePrint'
  import trackerRes from '../../plugin'
  import CreateInvoice from './CreateInvoice.svelte'

  export let query: DocumentQuery<Invoice> = {}
  export let currentSpace: Ref<Project> | undefined = undefined
  export let title = trackerRes.string.Invoices

  const client = getClient()
  const liveQuery = createQuery()
  const projectQuery = createQuery()
  const orgQuery = createQuery()

  let invoices: Invoice[] = []
  let projects: Map<Ref<Project>, Project> = new Map()
  let organizations: Map<Ref<Organization>, Organization> = new Map()
  let month: string = 'all'
  let projectFilter: string = 'all'
  let companyFilter: string = 'all'
  export let navigationOnly = false

  $: liveQuery.query(tracker.class.Invoice, query, (result) => {
    invoices = result.slice().sort((a, b) => b.invoiceDate - a.invoiceDate)
  })
  projectQuery.query(tracker.class.Project, {}, (result) => {
    projects = new Map(result.map((p) => [p._id, p]))
  })
  orgQuery.query(contact.class.Organization, {}, (result) => {
    organizations = new Map(result.map((o) => [o._id, o]))
  })

  function getCompanyColor (str: string): string {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#10b981',
      '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  $: companiesWithInvoices = Array.from(
    invoices.reduce((map, inv) => {
      const name = companyName(inv)
      if (name && name !== '—') {
        const existing = map.get(name) ?? 0
        map.set(name, existing + 1)
      }
      return map
    }, new Map<string, number>())
  ).map(([name, count]) => ({
    name,
    count,
    color: getCompanyColor(name)
  })).sort((a, b) => a.name.localeCompare(b.name))

  $: months = Array.from(new Set(invoices.map((inv) => monthKey(inv.invoiceDate)))).sort().reverse()
  $: monthItems = [
    { id: 'all', label: 'All months' },
    ...months.map((key) => ({ id: key, label: monthLabel(key) }))
  ] as DropdownTextItem[]
  $: projectItems = [
    { id: 'all', label: 'All projects' },
    ...Array.from(projects.entries())
      .filter(([id]) => invoices.some((inv) => inv.space === id))
      .map(([id, project]) => ({ id, label: project.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ] as DropdownTextItem[]
  $: companyItems = [
    { id: 'all', label: 'All companies' },
    ...Array.from(
      new Set(invoices.map((inv) => companyName(inv)).filter((name) => name !== '—'))
    )
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, label: name }))
  ] as DropdownTextItem[]
  $: visible = invoices.filter((inv) => {
    if (month !== 'all' && monthKey(inv.invoiceDate) !== month) return false
    if (currentSpace === undefined && projectFilter !== 'all' && inv.space !== projectFilter) return false
    if ($invoiceCompany !== 'all' && companyName(inv) !== $invoiceCompany) return false
    if (companyFilter !== 'all' && companyName(inv) !== companyFilter) return false
    return true
  })

  function openCreate (): void {
    showPopup(CreateInvoice, { currentSpace }, 'top', () => {})
  }

  function openEdit (invoice: Invoice): void {
    showPopup(CreateInvoice, { currentSpace: invoice.space, value: invoice }, 'top', () => {})
  }

  function downloadOne (invoice: Invoice): void {
    printInvoices([invoiceToView(invoice)], invoice.number)
  }

  function downloadMonth (): void {
    if (visible.length === 0) return
    const name = month === 'all' ? 'invoices' : `invoices-${month}`
    printInvoices(visible.map(invoiceToView), name)
  }

  async function remove (invoice: Invoice): Promise<void> {
    showPopup(MessageBox, {
      label: trackerRes.string.Invoice,
      message: trackerRes.string.Delete,
      dangerous: true,
      action: async () => {
        await client.remove(invoice)
      }
    })
  }

  function companyName (invoice: Invoice): string {
    if (invoice.billedTo?.name) return invoice.billedTo.name
    if (invoice.company === undefined) return '—'
    return organizations.get(invoice.company)?.name ?? '—'
  }

  function projectName (invoice: Invoice): string {
    return projects.get(invoice.space)?.name ?? '—'
  }
</script>

{#if navigationOnly}
  <div class="sidebar-action">
    <Button icon={IconAdd} label={trackerRes.string.NewInvoice} kind={'primary'} width={'100%'} justify={'center'} on:click={openCreate} />
  </div>
  <NavItem icon={IconFile} title="All invoices" count={invoices.length} selected={$invoiceCompany === 'all'} on:click={() => { $invoiceCompany = 'all' }} />
  <div class="sidebar-group-title">COMPANIES</div>
  {#each companiesWithInvoices as comp}
    <NavItem icon={IconFile} title={comp.name} count={comp.count} selected={$invoiceCompany === comp.name} on:click={() => { $invoiceCompany = comp.name }} />
  {:else}
    <div class="sidebar-empty">No invoices yet</div>
  {/each}
{:else}
<div class="hulyComponent invoices-container">
  <div class="hulyComponent invoices-content">
    <Header adaptive="disabled">
      <Breadcrumb
        icon={tracker.icon.Invoices}
        label={$invoiceCompany === 'all' ? title : `${title} — ${$invoiceCompany}`}
        size={'large'}
        isCurrent
      />
      <svelte:fragment slot="extra">
        <div class="av-filters">
          <DropdownLabels
            items={monthItems}
            bind:selected={month}
            autoSelect={false}
            enableSearch={false}
            showDropdownIcon
            kind={'regular'}
            size={'small'}
            justify={'left'}
          />
          {#if currentSpace === undefined}
            <DropdownLabels
              items={projectItems}
              bind:selected={projectFilter}
              autoSelect={false}
              enableSearch
              showDropdownIcon
              kind={'regular'}
              size={'small'}
              justify={'left'}
            />
          {/if}
          {#if $invoiceCompany === 'all'}
            <DropdownLabels
              items={companyItems}
              bind:selected={companyFilter}
              autoSelect={false}
              enableSearch
              showDropdownIcon
              kind={'regular'}
              size={'small'}
              justify={'left'}
            />
          {/if}
        </div>
      </svelte:fragment>
      <svelte:fragment slot="actions">
        <Button
          icon={IconFile}
          label={trackerRes.string.DownloadMonth}
          kind={'regular'}
          disabled={visible.length === 0}
          on:click={downloadMonth}
        />
        <Button icon={IconAdd} label={trackerRes.string.NewInvoice} kind={'primary'} on:click={openCreate} />
      </svelte:fragment>
    </Header>
    <Scroller>
      <table class="av-list">
        <thead>
          <tr>
            <th>Number</th>
            <th>Date</th>
            <th>Company</th>
            <th>Project</th>
            <th class="num">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each visible as invoice (invoice._id)}
            <tr>
              <td>
                <button class="link" on:click={() => { openEdit(invoice) }}>{invoice.number}</button>
              </td>
              <td>{formatInvoiceDate(invoice.invoiceDate)}</td>
              <td>{companyName(invoice)}</td>
              <td>{projectName(invoice)}</td>
              <td class="num">{formatINR(invoice.total)}</td>
              <td class="acts">
                <Button
                  icon={IconFile}
                  kind={'ghost'}
                  size={'small'}
                  showTooltip={{ label: trackerRes.string.DownloadInvoice }}
                  on:click={() => { downloadOne(invoice) }}
                />
                <Button
                  icon={IconDelete}
                  kind={'ghost'}
                  size={'small'}
                  on:click={() => { void remove(invoice) }}
                />
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="6" class="empty-invoices-cell">
                <div class="empty-invoices-msg">
                  <span>No invoices found</span>
                  <Button icon={IconAdd} label={trackerRes.string.NewInvoice} kind={'primary'} size={'small'} on:click={openCreate} />
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Scroller>
  </div>
</div>
{/if}

<style lang="scss">
  .invoices-container {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .sidebar-action {
    margin-bottom: 0.75rem;
    padding: 0 0.75rem;
  }
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0 0.5rem 1rem;
  }
  .sidebar-group-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--theme-dark-color);
    margin: 1.25rem 0.5rem 0.4rem;
  }
  .sidebar-empty {
    font-size: 0.8rem;
    color: var(--theme-dark-color);
    padding: 0.5rem;
    font-style: italic;
  }
  .invoices-content {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .av-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .av-list {
    width: 100%;
    border-collapse: collapse;
    th, td {
      text-align: left;
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid var(--theme-divider-color);
    }
    th { color: var(--theme-dark-color); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .acts { white-space: nowrap; text-align: right; }
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--theme-link-color);
    cursor: pointer;
    font: inherit;
    font-weight: 600;
  }
  .empty-invoices-cell {
    padding: 3rem 1rem !important;
    text-align: center !important;
  }
  .empty-invoices-msg {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--theme-dark-color);
    font-size: 0.9rem;
  }
</style>
