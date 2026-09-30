<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import core, {
    getCurrentAccount,
    isOwnerOrMaintainer,
    type Class,
    type Doc,
    type Mixin,
    type Ref
  } from '@hcengineering/core'
  import type { IntlString } from '@hcengineering/platform'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import { catalogToolId, TOOL_GROUPS, TOOL_SITES, type Tool, type ToolGroup } from '@hcengineering/tools'
  import {
    Breadcrumb,
    Button,
    Header,
    IconAdd,
    Label,
    Scroller,
    SearchInput,
    showPopup,
    Switcher,
    type TabItem
  } from '@hcengineering/ui'

  import tools from '../plugin'
  import ToolCard from './ToolCard.svelte'
  import ToolEditor from './ToolEditor.svelte'

  /** Avoid a tools-resources → contact package link; ids are stable. */
  const EMPLOYEE_ACCESS = 'contact:class:EmployeeAccess' as Ref<Class<Doc>>
  const EMPLOYEE = 'contact:mixin:Employee' as Ref<Mixin<Doc>>

  let query = ''
  let group: ToolGroup | 'all' = 'all'
  let toolsList: Tool[] = []
  let seedAttempted = false
  let employeeId: Ref<Doc> | undefined
  let allowedTools: Array<Ref<Doc>> | undefined
  let limitEnabled = false

  const canManage = isOwnerOrMaintainer()
  const client = getClient()
  const liveQuery = createQuery()
  const employeeQuery = createQuery()
  const accessQuery = createQuery()

  if (!canManage && client.getHierarchy().hasClass(EMPLOYEE)) {
    employeeQuery.query(
      EMPLOYEE,
      { personUuid: getCurrentAccount().uuid, active: true },
      (res) => {
        employeeId = res[0]?._id
      }
    )
  }

  $: if (!canManage && employeeId !== undefined && client.getHierarchy().hasClass(EMPLOYEE_ACCESS)) {
    accessQuery.query(EMPLOYEE_ACCESS, { attachedTo: employeeId }, (res) => {
      const access = res[0] as (Doc & { limitEnabled?: boolean, tools?: Array<Ref<Doc>> }) | undefined
      limitEnabled = access?.limitEnabled === true
      allowedTools = access?.tools
    })
  } else {
    accessQuery.unsubscribe()
    limitEnabled = false
    allowedTools = undefined
  }

  function toolAllowed (toolId: Ref<Doc>): boolean {
    if (canManage || !limitEnabled) return true
    return (allowedTools ?? []).includes(toolId)
  }

  liveQuery.query(tools.class.Tool, {}, (result) => {
    toolsList = result.slice().sort((a, b) => {
      const order = (a.order ?? 0) - (b.order ?? 0)
      if (order !== 0) return order
      return a.name.localeCompare(b.name)
    })
    void maybeSeedCatalog()
  })

  // Official transactor images do not run toolsOperation, so the catalog seed
  // upgrade never fires in production. Owner/maintainer first open fills it.
  async function maybeSeedCatalog (): Promise<void> {
    if (seedAttempted || !canManage) return
    seedAttempted = true
    try {
      const existing = await client.findAll(tools.class.Tool, {})
      if (existing.length > 0) return
      for (let index = 0; index < TOOL_SITES.length; index++) {
        const site = TOOL_SITES[index]
        const _id = catalogToolId(site.id)
        const already = await client.findOne(tools.class.Tool, { _id })
        if (already !== undefined) continue
        await client.createDoc(
          tools.class.Tool,
          core.space.Workspace,
          {
            name: site.name,
            description: site.description,
            href: site.href,
            host: site.host,
            group: site.group,
            https: site.https,
            current: site.current,
            order: index
          },
          _id
        )
      }
    } catch (err) {
      console.error('Failed to seed tools catalog', err)
    }
  }

  const groupLabel: Record<ToolGroup, IntlString> = {
    websites: tools.string.Websites,
    studio: tools.string.Studio,
    business: tools.string.BusinessApps,
    tools: tools.string.BotsAndTools
  }

  const groupHint: Record<ToolGroup, IntlString> = {
    websites: tools.string.WebsitesHint,
    studio: tools.string.StudioHint,
    business: tools.string.BusinessHint,
    tools: tools.string.ToolsHint
  }

  const filters: TabItem[] = [
    { id: 'all', labelIntl: tools.string.All },
    { id: 'websites', labelIntl: tools.string.Websites },
    { id: 'studio', labelIntl: tools.string.Studio },
    { id: 'business', labelIntl: tools.string.BusinessApps },
    { id: 'tools', labelIntl: tools.string.BotsAndTools }
  ]

  $: filtered = toolsList.filter((site) => {
    if (!toolAllowed(site._id)) return false
    if (group !== 'all' && site.group !== group) return false
    const q = query.trim().toLowerCase()
    if (q === '') return true
    return [site.name, site.host, site.description, site.login ?? ''].join(' ').toLowerCase().includes(q)
  })

  $: grouped = TOOL_GROUPS.map((key) => ({
    key,
    sites: filtered.filter((site) => site.group === key)
  })).filter((section) => section.sites.length > 0)

  function openSite (site: Tool): void {
    window.open(site.href, '_blank', 'noopener,noreferrer')
  }

  function selectGroup (event: CustomEvent<TabItem>): void {
    if (event.detail === undefined) return
    const id = String(event.detail.id)
    group = id as ToolGroup | 'all'
  }

  function addTool (): void {
    showPopup(ToolEditor, {}, 'top')
  }
</script>

<div class="hulyComponent">
  <Header adaptive="disabled">
    <Breadcrumb icon={tools.icon.Application} label={tools.string.Application} size={'large'} isCurrent />
    <svelte:fragment slot="actions">
      {#if canManage}
        <Button
          icon={IconAdd}
          label={tools.string.AddTool}
          kind="primary"
          size="medium"
          on:click={addTool}
        />
      {/if}
    </svelte:fragment>
  </Header>
  <div class="antiPanel-component">
    <p class="subtitle"><Label label={tools.string.Subtitle} /></p>
    <div class="toolbar">
      <SearchInput
        bind:value={query}
        placeholder={tools.string.SearchPlaceholder}
        delay={150}
        width="100%"
        on:change={(e) => {
          query = e.detail ?? ''
        }}
      />
      <Switcher
        name="tools-group-filter"
        items={filters}
        kind="subtle"
        selected={group}
        on:select={selectGroup}
      />
    </div>
    <div class="catalog">
      <Scroller padding="0 1.5rem" bottomPadding="5rem">
        {#if grouped.length === 0}
          <div class="empty"><Label label={tools.string.Empty} /></div>
        {:else}
          {#each grouped as section (section.key)}
            <section class="section">
              <div class="section-head">
                <h2 class="section-title"><Label label={groupLabel[section.key]} /></h2>
                <span class="section-hint"><Label label={groupHint[section.key]} /></span>
              </div>
              <div class="cards_grid">
                {#each section.sites as site (site._id)}
                  <ToolCard {site} canEdit={canManage} on:click={() => openSite(site)} />
                {/each}
              </div>
            </section>
          {/each}
        {/if}
      </Scroller>
    </div>
  </div>
</div>

<style lang="scss">
  .antiPanel-component {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    overflow: hidden;
  }
  .catalog {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    overflow: hidden;
  }
  .subtitle {
    flex-shrink: 0;
    margin: 0;
    padding: 0 1.5rem 0.75rem;
    color: var(--theme-dark-color);
    font-size: 0.8125rem;
  }
  .toolbar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 0.75rem;
    padding: 0 1.5rem 1.25rem;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.75rem;
    flex-shrink: 0;
  }
  .section:last-child {
    margin-bottom: 0;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  .section-title {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-caption-color);
  }
  .section-hint {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
  .cards_grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr));
    gap: 1rem;
  }
  .empty {
    padding: 3rem 0;
    text-align: center;
    color: var(--theme-dark-color);
  }
</style>
