<!--
// Copyright © 2026 AneeVerse
-->
<script context="module" lang="ts">
  import { writable } from 'svelte/store'
  const invoiceCompany = writable('all')
  const invoiceNav = writable<'dashboard' | 'all'>('dashboard')
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
    IconCheck,
    IconCopy,
    IconDelete,
    IconDetails,
    IconFile,
    Label,
    NavItem,
    Scroller,
    showPopup,
    type DropdownTextItem
  } from '@hcengineering/ui'
  import {
    formatINR,
    formatInvoiceDate,
    invoiceBalance,
    invoicePaidAmount,
    invoiceStatus,
    invoiceStatusLabel,
    monthKey,
    monthLabel,
    summarizeInvoices,
    type InvoicePayStatus
  } from '../../invoiceMath'
  import { invoiceToView } from '../../invoiceHtml'
  import { printInvoices } from '../../invoicePrint'
  import trackerRes from '../../plugin'
  import CreateInvoice from './CreateInvoice.svelte'
  import RecordPayment from './RecordPayment.svelte'

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
  let dashRange: string = 'all'
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
  $: thisMonthKey = monthKey(Date.now())
  $: dashRangeItems = [
    { id: 'all', label: 'All time' },
    { id: thisMonthKey, label: 'This month' }
  ] as DropdownTextItem[]

  $: visible = invoices.filter((inv) => {
    if (month !== 'all' && monthKey(inv.invoiceDate) !== month) return false
    if (currentSpace === undefined && projectFilter !== 'all' && inv.space !== projectFilter) return false
    if ($invoiceCompany !== 'all' && companyName(inv) !== $invoiceCompany) return false
    if (companyFilter !== 'all' && companyName(inv) !== companyFilter) return false
    return true
  })

  $: dashSource = invoices.filter((inv) => {
    if ($invoiceCompany !== 'all' && companyName(inv) !== $invoiceCompany) return false
    return true
  })
  $: summary = summarizeInvoices(dashSource, { month: dashRange })
  $: openBalances = dashSource
    .map((inv) => ({
      invoice: inv,
      balance: invoiceBalance(inv),
      status: invoiceStatus(inv)
    }))
    .filter((row) => row.balance > 0.001)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 8)

  function openCreate (): void {
    showPopup(CreateInvoice, { currentSpace }, 'top', () => {})
  }

  function openEdit (invoice: Invoice): void {
    // Keep browser currentSpace (undefined on All invoices) so the form still shows which project the invoice belongs to.
    showPopup(CreateInvoice, { currentSpace, value: invoice }, 'top', () => {})
  }

  function openDuplicate (invoice: Invoice): void {
    showPopup(CreateInvoice, { currentSpace, duplicateFrom: invoice }, 'top', () => {})
  }

  function openPayment (invoice: Invoice): void {
    showPopup(RecordPayment, { invoice }, 'top', () => {})
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

  function statusClass (status: InvoicePayStatus): string {
    return `status status--${status}`
  }

  function showDashboard (): void {
    $invoiceNav = 'dashboard'
    $invoiceCompany = 'all'
  }

  function showAll (): void {
    $invoiceNav = 'all'
    $invoiceCompany = 'all'
  }

  function showCompany (name: string): void {
    $invoiceNav = 'all'
    $invoiceCompany = name
  }
</script>

{#if navigationOnly}
  <div class="sidebar-action">
    <Button icon={IconAdd} label={trackerRes.string.NewInvoice} kind={'primary'} width={'100%'} justify={'center'} on:click={openCreate} />
  </div>
  <NavItem
    icon={IconDetails}
    title="Dashboard"
    selected={$invoiceNav === 'dashboard' && $invoiceCompany === 'all'}
    on:click={showDashboard}
  />
  <NavItem
    icon={IconFile}
    title="All invoices"
    count={invoices.length}
    selected={$invoiceNav === 'all' && $invoiceCompany === 'all'}
    on:click={showAll}
  />
  <div class="sidebar-group-title">COMPANIES</div>
  {#each companiesWithInvoices as comp}
    <NavItem icon={IconFile} title={comp.name} count={comp.count} selected={$invoiceCompany === comp.name} on:click={() => { showCompany(comp.name) }} />
  {:else}
    <div class="sidebar-empty">No invoices yet</div>
  {/each}
{:else}
<div class="hulyComponent invoices-container">
  <div class="hulyComponent invoices-content">
    {#if currentSpace !== undefined && $invoiceCompany === 'all'}
      <div class="view-tabs" role="tablist">
        <button
          class="view-tab"
          class:selected={$invoiceNav === 'dashboard'}
          role="tab"
          aria-selected={$invoiceNav === 'dashboard'}
          on:click={showDashboard}
        >Dashboard</button>
        <button
          class="view-tab"
          class:selected={$invoiceNav === 'all'}
          role="tab"
          aria-selected={$invoiceNav === 'all'}
          on:click={showAll}
        >All invoices</button>
      </div>
    {/if}
    {#if $invoiceNav === 'dashboard' && $invoiceCompany === 'all'}
      <Header adaptive="disabled">
        <Breadcrumb
          icon={tracker.icon.Invoices}
          label={trackerRes.string.InvoiceDashboard}
          size={'large'}
          isCurrent
        />
        <svelte:fragment slot="extra">
          <div class="av-filters">
            <DropdownLabels
              items={dashRangeItems}
              bind:selected={dashRange}
              autoSelect={false}
              enableSearch={false}
              showDropdownIcon
              kind={'regular'}
              size={'small'}
              justify={'left'}
            />
          </div>
        </svelte:fragment>
        <svelte:fragment slot="actions">
          <Button icon={IconAdd} label={trackerRes.string.NewInvoice} kind={'primary'} on:click={openCreate} />
        </svelte:fragment>
      </Header>
      <Scroller>
        <div class="dash">
          <div class="dash-cards">
            <div class="dash-card">
              <span>Total invoiced</span>
              <strong>{formatINR(summary.invoiced)}</strong>
              <em>{dashSource.length} invoices</em>
            </div>
            <div class="dash-card dash-card--ok">
              <span><Label label={trackerRes.string.AmountReceived} /></span>
              <strong>{formatINR(summary.received)}</strong>
              <em>{summary.paidCount} paid · {summary.partialCount} partial</em>
            </div>
            <div class="dash-card dash-card--warn">
              <span><Label label={trackerRes.string.PendingAmount} /></span>
              <strong>{formatINR(summary.pending)}</strong>
              <em>{summary.unpaidCount + summary.partialCount + summary.overdueCount} open</em>
            </div>
            <div class="dash-card dash-card--danger">
              <span><Label label={trackerRes.string.OverdueAmount} /></span>
              <strong>{formatINR(summary.overdue)}</strong>
              <em>{summary.overdueCount} overdue</em>
            </div>
          </div>

          <div class="dash-status-row">
            <div class="dash-chip status--paid"><strong>{summary.paidCount}</strong> Paid</div>
            <div class="dash-chip status--partial"><strong>{summary.partialCount}</strong> Partial</div>
            <div class="dash-chip status--unpaid"><strong>{summary.unpaidCount}</strong> Unpaid</div>
            <div class="dash-chip status--overdue"><strong>{summary.overdueCount}</strong> Overdue</div>
          </div>

          <div class="dash-section">
            <div class="dash-section__head">
              <h3>Largest open balances</h3>
              <Button label={trackerRes.string.AllInvoices} kind={'ghost'} size={'small'} on:click={showAll} />
            </div>
            {#if openBalances.length === 0}
              <div class="dash-empty">No pending amounts — all caught up.</div>
            {:else}
              <table class="av-list">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th class="num">Balance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {#each openBalances as row (row.invoice._id)}
                    <tr>
                      <td>
                        <button class="link" on:click={() => { openEdit(row.invoice) }}>{row.invoice.number}</button>
                      </td>
                      <td>{companyName(row.invoice)}</td>
                      <td>{formatInvoiceDate(row.invoice.dueDate)}</td>
                      <td><span class={statusClass(row.status)}>{invoiceStatusLabel(row.status)}</span></td>
                      <td class="num due">{formatINR(row.balance)}</td>
                      <td class="acts">
                        <Button
                          icon={IconCheck}
                          kind={'ghost'}
                          size={'small'}
                          showTooltip={{ label: trackerRes.string.RecordPayment }}
                          on:click={() => { openPayment(row.invoice) }}
                        />
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </div>
      </Scroller>
    {:else}
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
        <table class="av-list av-list--dense">
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>Company</th>
              <th>Project</th>
              <th>Status</th>
              <th class="money-head">Total · Paid · Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each visible as invoice (invoice._id)}
              {@const status = invoiceStatus(invoice)}
              {@const paid = invoicePaidAmount(invoice)}
              {@const balance = invoiceBalance(invoice)}
              <tr>
                <td class="cell-num">
                  <button class="link" on:click={() => { openEdit(invoice) }}>{invoice.number}</button>
                </td>
                <td class="cell-date">{formatInvoiceDate(invoice.invoiceDate)}</td>
                <td class="cell-clip" title={companyName(invoice)}>{companyName(invoice)}</td>
                <td class="cell-clip" title={projectName(invoice)}>{projectName(invoice)}</td>
                <td class="cell-status"><span class={statusClass(status)}>{invoiceStatusLabel(status)}</span></td>
                <td class="cell-money">
                  <span class="money-total">{formatINR(invoice.total)}</span>
                  <span class="money-sep">·</span>
                  <span class="money-paid">{formatINR(paid)}</span>
                  <span class="money-sep">·</span>
                  <span class="money-balance" class:due={balance > 0}>{formatINR(balance)}</span>
                </td>
                <td class="acts">
                  <div class="acts-row">
                    {#if balance > 0.001}
                      <Button
                        icon={IconCheck}
                        kind={'ghost'}
                        size={'small'}
                        showTooltip={{ label: trackerRes.string.RecordPayment }}
                        on:click={() => { openPayment(invoice) }}
                      />
                    {/if}
                    <Button
                      icon={IconCopy}
                      kind={'ghost'}
                      size={'small'}
                      showTooltip={{ label: trackerRes.string.Duplicate }}
                      on:click={() => { openDuplicate(invoice) }}
                    />
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
                  </div>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="7" class="empty-invoices-cell">
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
    {/if}
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
  .view-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.55rem 0.85rem 0;
    border-bottom: 1px solid var(--theme-divider-color);
  }
  .view-tab {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--theme-dark-color);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 550;
    padding: 0.45rem 0.75rem;
    border-radius: 0.4rem 0.4rem 0 0;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .view-tab.selected {
    color: var(--theme-caption-color);
    border-bottom-color: var(--theme-link-color);
  }
  .av-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .dash {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 0.5rem 0.75rem 1.5rem;
  }
  .dash-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .dash-card {
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.65rem;
    padding: 1rem 1.05rem;
    background: var(--theme-button-default);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    span {
      font-size: 0.75rem;
      color: var(--theme-dark-color);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-weight: 600;
    }
    strong {
      font-size: 1.35rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }
    em {
      font-style: normal;
      font-size: 0.78rem;
      color: var(--theme-dark-color);
    }
  }
  .dash-card--ok strong { color: #10b981; }
  .dash-card--warn strong { color: #f59e0b; }
  .dash-card--danger strong { color: #ef4444; }
  .dash-status-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .dash-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    font-size: 0.8rem;
    border: 1px solid transparent;
  }
  .dash-section {
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.65rem;
    padding: 0.75rem;
    background: var(--theme-button-default);
  }
  .dash-section__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
    }
  }
  .dash-empty {
    padding: 1.5rem 0.5rem;
    text-align: center;
    color: var(--theme-dark-color);
    font-size: 0.9rem;
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
    .due { color: #ef4444; font-weight: 600; }
  }
  .av-list--dense {
    th, td {
      padding: 0.32rem 0.55rem;
      vertical-align: middle;
      white-space: nowrap;
      line-height: 1.25;
      font-size: 0.84rem;
    }
    th {
      font-size: 0.68rem;
      padding: 0.28rem 0.55rem;
    }
    .money-head {
      text-align: right;
      text-transform: none;
      letter-spacing: 0;
      font-size: 0.68rem;
    }
    .cell-num { width: 6.5rem; }
    .cell-date { width: 6.5rem; color: var(--theme-dark-color); }
    .cell-clip {
      max-width: 14rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cell-status { width: 5.5rem; }
    .cell-money {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .money-total { font-weight: 600; }
    .money-sep {
      margin: 0 0.35rem;
      color: var(--theme-dark-color);
      opacity: 0.55;
    }
    .money-paid { color: var(--theme-dark-color); }
    .money-balance.due { color: #ef4444; font-weight: 600; }
    .acts {
      width: 1%;
      padding-left: 0.25rem;
      padding-right: 0.35rem;
    }
  }
  .acts-row {
    display: inline-flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0;
    white-space: nowrap;
    :global(.anti-button),
    :global(button) {
      margin: 0 !important;
      flex: 0 0 auto;
    }
  }
  .status {
    display: inline-flex;
    align-items: center;
    padding: 0.08rem 0.4rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .status--paid, .dash-chip.status--paid {
    color: #047857;
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.25);
  }
  .status--partial, .dash-chip.status--partial {
    color: #1d4ed8;
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.25);
  }
  .status--unpaid, .dash-chip.status--unpaid {
    color: #92400e;
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.25);
  }
  .status--overdue, .dash-chip.status--overdue {
    color: #b91c1c;
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.25);
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
  @media (max-width: 1100px) {
    .dash-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 700px) {
    .dash-cards { grid-template-columns: 1fr; }
  }
</style>
