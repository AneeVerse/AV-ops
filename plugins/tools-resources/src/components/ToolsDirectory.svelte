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
  import { createQuery, getClient, MessageBox } from '@hcengineering/presentation'
  import {
    catalogToolId,
    DEFAULT_GROUPS,
    OBSOLETE_TOOL_HOSTS,
    OBSOLETE_TOOL_IDS,
    TOOL_SITES,
    type Tool,
    type ToolGroupDefinition
  } from '@hcengineering/tools'
  import {
    Breadcrumb,
    Button,
    Header,
    Icon,
    IconAdd,
    IconClose,
    IconDelete,
    IconEdit,
    IconFolder,
    IconSearch,
    Label,
    NavItem,
    Scroller,
    SearchInput,
    showPopup
  } from '@hcengineering/ui'

  import tools from '../plugin'
  import EmbeddedToolView from './EmbeddedToolView.svelte'
  import GroupEditor from './GroupEditor.svelte'
  import ToolCard from './ToolCard.svelte'
  import ToolEditor from './ToolEditor.svelte'
  import ToolViewerModal from './ToolViewerModal.svelte'

  /** Avoid a tools-resources → contact package link; ids are stable. */
  const EMPLOYEE_ACCESS = 'contact:class:EmployeeAccess' as Ref<Class<Doc>>
  const EMPLOYEE = 'contact:mixin:Employee' as Ref<Mixin<Doc>>

  let query = ''
  let activeGroupId: string = 'all'
  let rawList: Tool[] = []
  let seedAttempted = false
  let employeeId: Ref<Doc> | undefined
  let allowedTools: Array<Ref<Doc>> | undefined
  let limitEnabled = false

  // In-app tabs & modal popup state
  let openTabs: Tool[] = []
  let activeTabId: string = 'directory'
  let modalSite: Tool | undefined = undefined

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
    rawList = result.slice()
    void maybeSeedCatalog()
  })

  // Separate custom group docs from actual tool docs
  $: groupDocs = rawList.filter((doc) => doc.group === '__group__' || doc._id.startsWith('tools:group:'))
  $: toolsList = rawList
    .filter((doc) => doc.group !== '__group__' && !doc._id.startsWith('tools:group:'))
    .sort((a, b) => {
      const order = (a.order ?? 0) - (b.order ?? 0)
      if (order !== 0) return order
      return a.name.localeCompare(b.name)
    })

  // Build list of all available groups
  $: availableGroups = (() => {
    const list: ToolGroupDefinition[] = [...DEFAULT_GROUPS]

    for (const gDoc of groupDocs) {
      const slug = gDoc.host || gDoc._id.replace('tools:group:', '')
      const existing = list.find((g) => g.id === slug)
      if (existing) {
        existing.name = gDoc.name
        existing.hint = gDoc.description
        if (gDoc.color) existing.color = gDoc.color
      } else {
        list.push({
          id: slug,
          name: gDoc.name,
          hint: gDoc.description,
          color: gDoc.color ?? '#8b5cf6',
          isDefault: false
        })
      }
    }

    // Include any group that exists on tools but not defined yet
    for (const tool of toolsList) {
      if (tool.group && !list.some((g) => g.id === tool.group)) {
        list.push({
          id: tool.group,
          name: tool.group.charAt(0).toUpperCase() + tool.group.slice(1),
          hint: 'Custom group',
          color: '#6366f1',
          isDefault: false
        })
      }
    }

    return list
  })()

  // Detect obsolete tools (ERP, CRM, sales1, chat, bot, scrape, etc.)
  $: obsoleteTools = toolsList.filter((t) => {
    const host = t.host?.toLowerCase() ?? ''
    const href = t.href?.toLowerCase() ?? ''
    const id = t._id?.replace('tools:tool:', '') ?? ''
    return (
      OBSOLETE_TOOL_HOSTS.some((oh) => host.includes(oh) || href.includes(oh)) ||
      OBSOLETE_TOOL_IDS.includes(id)
    )
  })

  // Seed default catalog once
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
            openMode: site.openMode ?? 'popup',
            order: index
          },
          _id
        )
      }
    } catch (err) {
      console.error('Failed to seed tools catalog', err)
    }
  }

  // Filter tools by active group and query
  $: filteredTools = toolsList.filter((site) => {
    if (!toolAllowed(site._id)) return false
    if (activeGroupId !== 'all' && site.group !== activeGroupId) return false
    const q = query.trim().toLowerCase()
    if (q === '') return true
    return [site.name, site.host, site.description, site.login ?? ''].join(' ').toLowerCase().includes(q)
  })

  // Grouped sections when "All tools" is active
  $: groupedSections = availableGroups
    .map((g) => ({
      group: g,
      sites: filteredTools.filter((site) => site.group === g.id)
    }))
    .filter((section) => section.sites.length > 0)

  // Current active group definition
  $: currentGroup = availableGroups.find((g) => g.id === activeGroupId)

  // Helper counts
  function getGroupCount (groupId: string): number {
    return toolsList.filter((site) => toolAllowed(site._id) && site.group === groupId).length
  }

  function handleOpenTool (event: CustomEvent<{ site: Tool, mode: 'popup' | 'tab' | 'window' }>): void {
    const { site, mode } = event.detail
    if (mode === 'popup') {
      modalSite = site
    } else if (mode === 'tab') {
      if (!openTabs.some((t) => t._id === site._id)) {
        openTabs = [...openTabs, site]
      }
      activeTabId = site._id
    } else {
      window.open(site.href, '_blank', 'noopener,noreferrer')
    }
  }

  function closeTab (toolId: string): void {
    openTabs = openTabs.filter((t) => t._id !== toolId)
    if (activeTabId === toolId) {
      activeTabId = openTabs.length > 0 ? openTabs[openTabs.length - 1]._id : 'directory'
    }
  }

  function addTool (groupForNew?: string): void {
    const targetGroup = typeof groupForNew === 'string' && groupForNew !== 'all' ? groupForNew : activeGroupId !== 'all' ? activeGroupId : 'tools'
    showPopup(ToolEditor, { availableGroups, defaultGroup: targetGroup }, 'top')
  }

  function addGroup (): void {
    showPopup(GroupEditor, {}, 'top')
  }

  function editCustomGroup (event: MouseEvent, gDef: ToolGroupDefinition): void {
    event.stopPropagation()
    const doc = groupDocs.find((d) => d.host === gDef.id || d._id === `tools:group:${gDef.id}`)
    showPopup(GroupEditor, { group: gDef, groupDoc: doc }, 'top')
  }

  function deleteCustomGroup (event: MouseEvent, gDef: ToolGroupDefinition): void {
    event.stopPropagation()
    const doc = groupDocs.find((d) => d.host === gDef.id || d._id === `tools:group:${gDef.id}`)
    if (!doc) return
    showPopup(
      MessageBox,
      {
        label: tools.string.DeleteGroup,
        message: tools.string.DeleteGroupConfirm,
        action: async () => {
          // Reassign tools in this group to 'tools'
          const inGroup = toolsList.filter((t) => t.group === gDef.id)
          for (const t of inGroup) {
            await client.update(t, { group: 'tools' })
          }
          await client.remove(doc)
          if (activeGroupId === gDef.id) {
            activeGroupId = 'all'
          }
        }
      },
      'top'
    )
  }

  function cleanObsoleteTools (): void {
    showPopup(
      MessageBox,
      {
        label: tools.string.CleanObsolete,
        message: tools.string.CleanObsoleteConfirm,
        action: async () => {
          for (const t of obsoleteTools) {
            await client.remove(t)
          }
        }
      },
      'top'
    )
  }

  function selectNavGroup (id: string): void {
    activeGroupId = id
    activeTabId = 'directory'
  }

  $: activeTabTool = openTabs.find((t) => t._id === activeTabId)
</script>

<div class="hulyComponent tools-layout">
  <!-- Left Navigation Sidebar (Tracker-Style Left Aligned) -->
  <aside class="antiPanel-navigator landscape border-right">
    <div class="antiPanel-wrap__content hulyNavPanel-container">
      <div class="hulyNavPanel-header">
        <div class="app-header-row">
          <span class="app-header-icon">
            <Icon icon={tools.icon.Application} size="small" />
          </span>
          <span class="app-header-title">Tools</span>
        </div>
      </div>

      <!-- Action Button Area (Like Tracker's "+ New task") -->
      {#if canManage}
        <div class="nav-action-wrap">
          <Button
            icon={IconAdd}
            label={tools.string.AddTool}
            kind="primary"
            size="large"
            width="100%"
            on:click={() => addTool()}
          />
        </div>
      {/if}

      <Scroller shrink>
        <!-- All Tools Link -->
        <div class="nav-section">
          <NavItem
            icon={tools.icon.Application}
            label={tools.string.AllTools}
            count={toolsList.filter((s) => toolAllowed(s._id)).length}
            selected={activeGroupId === 'all' && activeTabId === 'directory'}
            on:click={() => selectNavGroup('all')}
          />
        </div>

        <!-- Groups Section -->
        <div class="nav-groups-section">
          <div class="nav-groups-header">
            <span class="nav-groups-label"><Label label={tools.string.Groups} /></span>
            {#if canManage}
              <button
                type="button"
                class="add-group-btn"
                title="Add new group"
                on:click|stopPropagation={addGroup}
              >
                +
              </button>
            {/if}
          </div>

          <div class="groups-list">
            {#each availableGroups as gDef (gDef.id)}
              {@const isCustom = !DEFAULT_GROUPS.some((dg) => dg.id === gDef.id)}
              {@const count = getGroupCount(gDef.id)}
              <div
                class="group-nav-row"
                class:selected={activeGroupId === gDef.id && activeTabId === 'directory'}
                on:click={() => selectNavGroup(gDef.id)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && selectNavGroup(gDef.id)}
              >
                <span class="group-dot" style:background-color={gDef.color ?? '#3b82f6'}></span>
                <span class="group-name overflow-label">{gDef.name}</span>
                <span class="group-count">{count}</span>

                {#if canManage && isCustom}
                  <div class="custom-group-actions" on:click|stopPropagation>
                    <button
                      type="button"
                      class="row-action-btn"
                      title="Edit group"
                      on:click={(e) => editCustomGroup(e, gDef)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      class="row-action-btn danger"
                      title="Delete group"
                      on:click={(e) => deleteCustomGroup(e, gDef)}
                    >
                      ✕
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </Scroller>

      <!-- Sidebar Footer -->
      <footer class="nav-footer-stats">
        <span class="footer-count">{toolsList.length} total tools</span>
        <span class="footer-brand">Aneeverse Ops</span>
      </footer>
    </div>
  </aside>

  <!-- Right Main Content Area -->
  <main class="antiPanel-component">
    <!-- Top Header -->
    <Header adaptive="disabled">
      <div class="header-left-wrap">
        <Breadcrumb icon={tools.icon.Application} label={tools.string.Application} size={'large'} />
        {#if activeGroupId !== 'all' && currentGroup}
          <span class="breadcrumb-slash">/</span>
          <span class="breadcrumb-group" style:color={currentGroup.color ?? 'inherit'}>
            {currentGroup.name}
          </span>
        {/if}
      </div>

      <svelte:fragment slot="actions">
        <!-- Search Input -->
        <SearchInput
          bind:value={query}
          placeholder={tools.string.SearchPlaceholder}
          delay={150}
          width="16rem"
          on:change={(e) => {
            query = e.detail ?? ''
          }}
        />

        <!-- Obsolete Tools Cleanup Button -->
        {#if canManage && obsoleteTools.length > 0}
          <Button
            label={`Clean inactive (${obsoleteTools.length})`}
            kind="ghost"
            size="medium"
            showTooltip={{ label: tools.string.CleanObsoleteConfirm }}
            on:click={cleanObsoleteTools}
          />
        {/if}

        <!-- Add Tool Button -->
        {#if canManage}
          <Button
            icon={IconAdd}
            label={tools.string.AddTool}
            kind="primary"
            size="medium"
            on:click={() => addTool()}
          />
        {/if}
      </svelte:fragment>
    </Header>

    <!-- In-App Tabs Bar (when tools are opened inside tabs) -->
    {#if openTabs.length > 0}
      <div class="workbench-tabs-bar">
        <button
          type="button"
          class="tab-chip"
          class:active={activeTabId === 'directory'}
          on:click={() => {
            activeTabId = 'directory'
          }}
        >
          <span class="tab-chip-icon">🗂</span>
          <span><Label label={tools.string.Directory} /></span>
        </button>

        {#each openTabs as openTool (openTool._id)}
          <div class="tab-chip" class:active={activeTabId === openTool._id}>
            <button
              type="button"
              class="tab-chip-title"
              on:click={() => {
                activeTabId = openTool._id
              }}
            >
              <span class="tab-chip-dot"></span>
              <span class="overflow-label">{openTool.name}</span>
            </button>
            <button
              type="button"
              class="tab-chip-close"
              title="Close tab"
              on:click|stopPropagation={() => closeTab(openTool._id)}
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Content: Embedded Tool Tab View OR Directory View -->
    {#if activeTabId !== 'directory' && activeTabTool !== undefined}
      <EmbeddedToolView site={activeTabTool} on:close={() => closeTab(activeTabId)} />
    {:else}
      <!-- Directory View -->
      <div class="directory-view">
        <!-- Group Header Subtitle Banner -->
        <div class="group-banner">
          <div class="group-banner-text">
            <h1 class="group-banner-title">
              {activeGroupId === 'all' ? 'All Hosted Tools' : currentGroup?.name ?? 'Tools'}
            </h1>
            <p class="group-banner-hint">
              {activeGroupId === 'all'
                ? 'Hosted Aneeverse tools & workflows. Click a card to open in popup, tab, or new window.'
                : currentGroup?.hint ?? 'Aneeverse tools directory'}
            </p>
          </div>
          <div class="group-banner-meta">
            <span class="count-badge">{filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'}</span>
          </div>
        </div>

        <!-- Cards Catalog Area -->
        <div class="catalog-scroll-container">
          <Scroller padding="0 1.5rem" bottomPadding="5rem">
            {#if filteredTools.length === 0}
              <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-title"><Label label={tools.string.Empty} /></div>
                {#if canManage}
                  <Button
                    icon={IconAdd}
                    label={tools.string.AddTool}
                    kind="primary"
                    size="medium"
                    on:click={() => addTool(activeGroupId)}
                  />
                {/if}
              </div>
            {:else if activeGroupId === 'all' && query.trim() === ''}
              <!-- Grouped by section when viewing All without query -->
              {#each groupedSections as section (section.group.id)}
                <section class="catalog-section">
                  <div class="section-head">
                    <span class="section-dot" style:background-color={section.group.color ?? '#3b82f6'}></span>
                    <h2 class="section-title">{section.group.name}</h2>
                    {#if section.group.hint}
                      <span class="section-hint">{section.group.hint}</span>
                    {/if}
                    <span class="section-count">{section.sites.length}</span>
                  </div>
                  <div class="cards-grid">
                    {#each section.sites as site (site._id)}
                      <ToolCard
                        {site}
                        canEdit={canManage}
                        {availableGroups}
                        on:open={handleOpenTool}
                      />
                    {/each}
                  </div>
                </section>
              {/each}
            {:else}
              <!-- Flat Grid when group is selected or searching -->
              <div class="cards-grid">
                {#each filteredTools as site (site._id)}
                  <ToolCard
                    {site}
                    canEdit={canManage}
                    {availableGroups}
                    on:open={handleOpenTool}
                  />
                {/each}
              </div>
            {/if}
          </Scroller>
        </div>
      </div>
    {/if}
  </main>
</div>

<!-- Modal Popup for viewing tools inside Huly -->
{#if modalSite !== undefined}
  <ToolViewerModal site={modalSite} on:close={() => { modalSite = undefined }} />
{/if}

<style lang="scss">
  .tools-layout {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Left Navigation Sidebar */
  .antiPanel-navigator {
    position: relative;
    width: 16.5rem;
    min-width: 14rem;
    max-width: 20rem;
    height: 100%;
    background-color: var(--theme-navpanel-color);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .hulyNavPanel-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .hulyNavPanel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.125rem 1.25rem 0.75rem;
    flex-shrink: 0;
  }

  .app-header-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .app-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    background-color: var(--theme-button-hovered);
    color: var(--theme-caption-color);
  }

  .app-header-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--theme-caption-color);
    letter-spacing: -0.01em;
  }

  .nav-action-wrap {
    padding: 0 1rem 0.875rem;
    flex-shrink: 0;
  }

  .nav-section {
    padding: 0.25rem 0;
  }

  .nav-groups-section {
    padding-top: 1rem;
    margin-top: 0.5rem;
    border-top: 1px solid var(--theme-divider-color);
  }

  .nav-groups-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 1.25rem 0.5rem;
  }

  .nav-groups-label {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-dark-color);
  }

  .add-group-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    color: var(--theme-dark-color);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
    }
  }

  .groups-list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0 0.5rem;
  }

  .group-nav-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4375rem 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--theme-content-color);
    transition: background-color 0.1s ease, color 0.1s ease;
    user-select: none;
    outline: none;

    &:hover {
      background-color: var(--theme-button-default);
      color: var(--theme-caption-color);

      .custom-group-actions {
        display: flex;
      }
    }

    &.selected {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
      font-weight: 600;
    }
  }

  .group-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .group-name {
    flex-grow: 1;
    min-width: 0;
  }

  .group-count {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--theme-dark-color);
    flex-shrink: 0;
  }

  .custom-group-actions {
    display: none;
    align-items: center;
    gap: 0.125rem;
    margin-left: 0.25rem;
  }

  .row-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    color: var(--theme-dark-color);
    font-size: 0.6875rem;
    cursor: pointer;

    &:hover {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
    }
    &.danger:hover {
      color: var(--theme-warning-color, #f43f5e);
    }
  }

  .nav-footer-stats {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--theme-divider-color);
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--theme-dark-color);
  }

  /* Right Main Content Panel */
  .antiPanel-component {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    background-color: var(--theme-bg-color);
  }

  .header-left-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .breadcrumb-slash {
    color: var(--theme-dark-color);
    font-size: 0.875rem;
  }

  .breadcrumb-group {
    font-size: 0.875rem;
    font-weight: 600;
  }

  /* Workbench Tabs Bar */
  .workbench-tabs-bar {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 1.25rem;
    background-color: var(--theme-comp-header-color);
    border-bottom: 1px solid var(--theme-divider-color);
    flex-shrink: 0;
    overflow-x: auto;
  }

  .tab-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    border: 1px solid var(--theme-button-border);
    background-color: var(--theme-button-default);
    color: var(--theme-content-color);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.1s ease;
    white-space: nowrap;

    &:hover {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
    }

    &.active {
      background-color: var(--theme-button-hovered);
      border-color: var(--theme-button-border-hover);
      color: var(--theme-caption-color);
      font-weight: 600;
    }
  }

  .tab-chip-title {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: none;
    background: transparent;
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    padding: 0;
    cursor: pointer;
    max-width: 10rem;
  }

  .tab-chip-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 999px;
    background-color: var(--primary-button-default);
  }

  .tab-chip-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    color: var(--theme-dark-color);
    font-size: 0.625rem;
    cursor: pointer;
    margin-left: 0.25rem;

    &:hover {
      background-color: var(--theme-bg-accent-color);
      color: var(--theme-caption-color);
    }
  }

  /* Directory View */
  .directory-view {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    overflow: hidden;
  }

  .group-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.5rem 0.5rem;
    flex-shrink: 0;
  }

  .group-banner-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--theme-caption-color);
    letter-spacing: -0.01em;
  }

  .group-banner-hint {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    color: var(--theme-dark-color);
  }

  .count-badge {
    padding: 0.1875rem 0.625rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    background-color: var(--theme-button-default);
    color: var(--theme-dark-color);
    border: 1px solid var(--theme-button-border);
  }

  .catalog-scroll-container {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    overflow: hidden;
  }

  .catalog-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
    flex-shrink: 0;
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .section-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
  }

  .section-title {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--theme-caption-color);
  }

  .section-hint {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }

  .section-count {
    margin-left: auto;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--theme-dark-color);
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 1rem;
    padding-top: 0.25rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem 1rem;
    text-align: center;
  }

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.6;
  }

  .empty-title {
    font-size: 0.875rem;
    color: var(--theme-dark-color);
    margin-bottom: 0.5rem;
  }
</style>
