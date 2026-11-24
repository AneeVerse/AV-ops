<!--
// Copyright © 2026 AneeVerse
-->
<script context="module" lang="ts">
  import { writable } from 'svelte/store'
  const activeGroup = writable('all')
  const activeTab = writable('directory')
  const toolTabs = writable<import('@hcengineering/tools').Tool[]>([])
</script>
<script lang="ts">
  import core, {
    AccountRole,
    getCurrentAccount,
    isOwnerOrMaintainer,
    type Class,
    type Doc,
    type Mixin,
    type Ref
  } from '@hcengineering/core'
  import { onDestroy } from 'svelte'
  import type { IntlString } from '@hcengineering/platform'
  import { createQuery, getClient, MessageBox } from '@hcengineering/presentation'
  import {
    catalogToolId,
    DEFAULT_GROUPS,
    LISTING_IMAGES_SITE,
    OBSOLETE_TOOL_HOSTS,
    OBSOLETE_TOOL_IDS,
    TOOL_SITES,
    type Tool,
    type ToolGroupDefinition
  } from '@hcengineering/tools'
  import {
    Action,
    Breadcrumb,
    Button,
    Header,
    Icon,
    IconAdd,
    IconDelete,
    IconEdit,
    IconFolder,
    IconMoreV,
    IconSearch,
    Label,
    Menu,
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
  export let model: { id: string } | undefined = undefined
  const navigationOnly = model?.id === 'tools-navigation'
  let rawList: Tool[] = []
  let seedAttempted = false
  let listingEnsureInFlight = false
  let employeeId: Ref<Doc> | undefined
  let allowedTools: Array<Ref<Doc>> | undefined
  let limitEnabled = false

  // In-app tabs & modal popup state
  let modalSite: Tool | undefined = undefined

  onDestroy(() => {
    if (!navigationOnly) { activeGroup.set('all'); activeTab.set('directory'); toolTabs.set([]) }
  })

  const canManage = isOwnerOrMaintainer()
  const account = getCurrentAccount()
  const isGuestAccount =
    account.role === AccountRole.Guest || account.role === AccountRole.ReadOnlyGuest
  const client = getClient()
  const liveQuery = createQuery()
  const employeeQuery = createQuery()
  const accessQuery = createQuery()

  if (!isGuestAccount && !canManage && client.getHierarchy().hasClass(EMPLOYEE)) {
    employeeQuery.query(
      EMPLOYEE,
      { personUuid: getCurrentAccount().uuid, active: true },
      (res) => {
        employeeId = res[0]?._id
      }
    )
  }

  $: if (
    !isGuestAccount &&
    !canManage &&
    employeeId !== undefined &&
    client.getHierarchy().hasClass(EMPLOYEE_ACCESS)
  ) {
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
    if (isGuestAccount) return false
    if (canManage || !limitEnabled) return true
    return (allowedTools ?? []).includes(toolId)
  }

  if (isGuestAccount) {
    liveQuery.unsubscribe()
    rawList = []
  } else {
    liveQuery.query(tools.class.Tool, {}, (result) => {
      rawList = result.slice()
      if (!navigationOnly) void maybeSeedCatalog()
    })
  }

  // Separate custom group docs from actual tool docs
  $: groupDocs = rawList.filter((doc) => doc.group === '__group__' || doc._id.startsWith('tools:group:'))
  $: toolsList = rawList
    .filter((doc) => {
      if (doc.group === '__group__' || doc._id.startsWith('tools:group:')) return false
      const rawId = doc._id.replace('tools:tool:', '')
      // The live listing tool must never be hidden by the obsolete-name/id
      // rules below (that is exactly how the n8n group ended up empty).
      if (rawId === LISTING_IMAGES_SITE.id) return true
      const lowerName = (doc.name ?? '').toLowerCase()
      if (
        rawId === 'n8n' ||
        rawId === 'amazon' ||
        rawId === 'etsy' ||
        rawId === 'n8n-ebay' ||
        rawId === 'n8n-amazon' ||
        rawId === 'n8n-etsy' ||
        lowerName.includes('ebay -> listing') ||
        lowerName.includes('amazon -> listing') ||
        lowerName.includes('etsy -> listing')
      ) return false
      return true
    })
    .sort((a, b) => {
      const order = (a.order ?? 0) - (b.order ?? 0)
      if (order !== 0) return order
      return a.name.localeCompare(b.name)
    })

  $: deletedGroupIds = new Set(
    rawList
      .filter((d) => d.group === '__deleted__' || d._id.startsWith('tools:deleted:'))
      .map((d) => d.host || d._id.replace('tools:deleted:', ''))
  )

  // Build list of all available groups
  $: availableGroups = (() => {
    const list: ToolGroupDefinition[] = []

    for (const dg of DEFAULT_GROUPS) {
      if (!deletedGroupIds.has(dg.id)) {
        list.push({ ...dg })
      }
    }

    for (const gDoc of groupDocs) {
      const slug = gDoc.host || gDoc._id.replace('tools:group:', '')
      if (deletedGroupIds.has(slug)) continue
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
      if (tool.group && !deletedGroupIds.has(tool.group) && !list.some((g) => g.id === tool.group)) {
        list.push({
          id: tool.group,
          name: tool.group.charAt(0).toUpperCase() + tool.group.slice(1),
          hint: 'Group',
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
    if (id === LISTING_IMAGES_SITE.id) return false
    return (
      OBSOLETE_TOOL_HOSTS.some((oh) => host.includes(oh) || href.includes(oh)) ||
      OBSOLETE_TOOL_IDS.includes(id)
    )
  })

  // Seed default catalog once, but ensure the Listing Images tool on every
  // tools change: if it is ever missing the n8n group must heal itself
  // instead of silently staying empty.
  async function maybeSeedCatalog (): Promise<void> {
    if (!canManage || listingEnsureInFlight) return
    listingEnsureInFlight = true
    try {
      // 1) Ensure the replacement FIRST, from the hard-coded site (not a
      //    TOOL_SITES lookup that a stale bundle can miss), and repair a
      //    copy that still points at an old per-marketplace n8n form.
      //    Only then may old tools be removed below — deleting first and
      //    creating second is how the listing URL vanished from the UI.
      const listingImagesId = catalogToolId(LISTING_IMAGES_SITE.id)
      const listing = await client.findOne(tools.class.Tool, { _id: listingImagesId })
      if (listing === undefined) {
        await client.createDoc(
          tools.class.Tool,
          core.space.Workspace,
          {
            name: LISTING_IMAGES_SITE.name,
            description: LISTING_IMAGES_SITE.description,
            href: LISTING_IMAGES_SITE.href,
            host: LISTING_IMAGES_SITE.host,
            group: LISTING_IMAGES_SITE.group,
            https: LISTING_IMAGES_SITE.https,
            current: LISTING_IMAGES_SITE.current,
            openMode: LISTING_IMAGES_SITE.openMode ?? 'tab',
            order: 40
          },
          listingImagesId
        )
      } else if (
        listing.group !== LISTING_IMAGES_SITE.group ||
        (listing.href ?? '').includes('n8n.aneeverse.com/form/')
      ) {
        await client.update(listing, {
          href: LISTING_IMAGES_SITE.href,
          host: LISTING_IMAGES_SITE.host,
          group: LISTING_IMAGES_SITE.group,
          https: LISTING_IMAGES_SITE.https,
          openMode: LISTING_IMAGES_SITE.openMode ?? 'tab'
        })
      }

      if (seedAttempted) return
      seedAttempted = true

      const existing = await client.findAll(tools.class.Tool, {})

      // 2) Auto-migrate old n8n tools (n8n, amazon, etsy, etc.) to the
      //    single listing tool ensured above. Never touch that tool here.
      const oldN8nTools = existing.filter((t) => {
        const id = (t._id as string)?.replace('tools:tool:', '')
        if (id === LISTING_IMAGES_SITE.id) return false
        const name = (t.name ?? '').toLowerCase()
        return (
          id === 'n8n' ||
          id === 'amazon' ||
          id === 'etsy' ||
          id === 'n8n-ebay' ||
          id === 'n8n-amazon' ||
          id === 'n8n-etsy' ||
          name.includes('ebay -> listing') ||
          name.includes('amazon -> listing') ||
          name.includes('etsy -> listing')
        )
      })
      if (oldN8nTools.length > 0) {
        for (const oldTool of oldN8nTools) {
          try {
            await client.remove(oldTool)
          } catch (e) {
            console.error('Failed to remove obsolete tool:', e)
          }
        }
      }

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
    } finally {
      listingEnsureInFlight = false
    }
  }

  // Filter tools by active group and query
  $: filteredTools = toolsList.filter((site) => {
    if (!toolAllowed(site._id)) return false
    if ($activeGroup !== 'all' && site.group !== $activeGroup) return false
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
  $: currentGroup = availableGroups.find((g) => g.id === $activeGroup)

  // Helper counts
  function getGroupCount (groupId: string): number {
    return toolsList.filter((site) => toolAllowed(site._id) && site.group === groupId).length
  }

  function handleOpenTool (event: CustomEvent<{ site: Tool, mode: 'popup' | 'tab' | 'window' }>): void {
    const { site, mode } = event.detail
    if (mode === 'popup') {
      modalSite = site
    } else if (mode === 'tab') {
      if (!$toolTabs.some((t) => t._id === site._id)) {
        $toolTabs = [...$toolTabs, site]
      }
      $activeTab = site._id
    } else {
      window.open(site.href, '_blank', 'noopener,noreferrer')
    }
  }

  function openToolDirectly (site: Tool): void {
    if (site.openMode === 'window') {
      window.open(site.href, '_blank', 'noopener,noreferrer')
      return
    }
    if (!$toolTabs.some((t) => t._id === site._id)) {
      $toolTabs = [...$toolTabs, site]
    }
    $activeTab = site._id
  }

  function closeTab (toolId: string): void {
    $toolTabs = $toolTabs.filter((t) => t._id !== toolId)
    if ($activeTab === toolId) {
      $activeTab = $toolTabs.length > 0 ? $toolTabs[$toolTabs.length - 1]._id : 'directory'
    }
  }

  function addTool (groupForNew?: string): void {
    const targetGroup = typeof groupForNew === 'string' && groupForNew !== 'all' ? groupForNew : $activeGroup !== 'all' ? $activeGroup : 'tools'
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
    showPopup(
      MessageBox,
      {
        label: tools.string.DeleteGroup,
        message: tools.string.DeleteGroupConfirm,
        dangerous: true,
        action: async () => {
          try {
            // Reassign tools in this group to 'tools'
            const inGroup = toolsList.filter((t) => t.group === gDef.id)
            for (const t of inGroup) {
              await client.update(t, { group: 'tools' })
            }
            const doc = groupDocs.find((d) => d.host === gDef.id || d._id === `tools:group:${gDef.id}`)
            if (doc !== undefined) {
              await client.remove(doc)
            } else {
              const existing = await client.findOne(tools.class.Tool, { _id: `tools:group:${gDef.id}` as any })
              if (existing !== undefined) {
                await client.remove(existing)
              }
            }
            // Permanently mark as deleted
            const deletedDocId = `tools:deleted:${gDef.id}` as any
            const alreadyDeleted = await client.findOne(tools.class.Tool, { _id: deletedDocId })
            if (alreadyDeleted === undefined) {
              await client.createDoc(
                tools.class.Tool,
                core.space.Workspace,
                {
                  name: gDef.name,
                  description: 'deleted',
                  href: `deleted:${gDef.id}`,
                  host: gDef.id,
                  group: '__deleted__',
                  https: true
                },
                deletedDocId
              )
            }
            if ($activeGroup === gDef.id) {
              $activeGroup = 'all'
            }
          } catch (err) {
            console.error('Failed to delete group:', err)
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

  let sidebarSearchQuery = ''
  let showSidebarSearch = false

  function getGroupColor (groupId: string): string {
    const g = availableGroups.find((item) => item.id === groupId)
    return g?.color ?? '#6366f1'
  }

  function editTool (site: Tool): void {
    showPopup(ToolEditor, { value: site, availableGroups }, 'top')
  }

  function deleteTool (site: Tool): void {
    showPopup(
      MessageBox,
      {
        label: tools.string.DeleteTool,
        message: tools.string.DeleteToolConfirm,
        dangerous: true,
        action: async () => {
          await client.remove(site)
        }
      },
      'top'
    )
  }

  function openGroupMenu (ev: MouseEvent, gDef: ToolGroupDefinition): void {
    ev.stopPropagation()
    const target = ev.currentTarget as HTMLElement
    const actions: Action[] = [
      {
        label: `Add tool to ${gDef.name}` as any,
        icon: IconAdd,
        action: async () => {
          addTool(gDef.id)
        }
      },
      {
        label: tools.string.EditGroup,
        icon: IconEdit,
        action: async () => {
          const doc = groupDocs.find((d) => d.host === gDef.id || d._id === `tools:group:${gDef.id}`)
          showPopup(GroupEditor, { group: gDef, groupDoc: doc }, 'top')
        }
      },
      {
        label: tools.string.DeleteGroup,
        icon: IconDelete,
        action: async () => {
          deleteCustomGroup(ev, gDef)
        }
      }
    ]
    showPopup(Menu, { actions }, target)
  }

  function openToolMenu (ev: MouseEvent, tool: Tool): void {
    ev.stopPropagation()
    const target = ev.currentTarget as HTMLElement
    const actions: Action[] = [
      {
        label: tools.string.EditTool,
        icon: IconEdit,
        action: async () => {
          editTool(tool)
        }
      },
      {
        label: 'Open in new window' as any,
        icon: IconFolder,
        action: async () => {
          window.open(tool.href, '_blank', 'noopener,noreferrer')
        }
      },
      {
        label: tools.string.DeleteTool,
        icon: IconDelete,
        action: async () => {
          deleteTool(tool)
        }
      }
    ]
    showPopup(Menu, { actions }, target)
  }

  $: sidebarInvolvedTools = toolsList.filter((site) => {
    if (!toolAllowed(site._id)) return false
    if ($activeGroup !== 'all' && site.group !== $activeGroup) return false
    if (sidebarSearchQuery.trim() !== '') {
      const q = sidebarSearchQuery.trim().toLowerCase()
      return (
        site.name.toLowerCase().includes(q) ||
        (site.description ?? '').toLowerCase().includes(q) ||
        (site.host ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  $: involvedSectionTitle =
    $activeGroup === 'all'
      ? 'YOUR TOOLS'
      : `${(currentGroup?.name ?? 'GROUP').toUpperCase()} TOOLS`

  function selectNavGroup (id: string): void {
    $activeGroup = id
    $activeTab = 'directory'
  }

  $: activeTabTool = $toolTabs.find((t) => t._id === $activeTab)
</script>

{#if navigationOnly}
      <div class="tools-navigation">
        <!-- Top: All Tools -->
        <div class="nav-section">
          <NavItem
            icon={tools.icon.Application}
            label={tools.string.AllTools}
            count={toolsList.filter((s) => toolAllowed(s._id)).length}
            selected={$activeGroup === 'all' && $activeTab === 'directory'}
            on:click={() => selectNavGroup('all')}
          />
        </div>

        <!-- Top: Groups / Categories Section -->
        <div class="nav-groups-section">
          <div class="nav-section-header">
            <span class="nav-section-label"><Label label={tools.string.Groups} /></span>
            {#if canManage}
              <button
                type="button"
                class="header-tool-btn"
                title="Add new group"
                on:click|stopPropagation={addGroup}
              >
                +
              </button>
            {/if}
          </div>

          <div class="groups-list">
            {#each availableGroups as gDef (gDef.id)}
              {@const count = getGroupCount(gDef.id)}
              <NavItem title={gDef.name} type="type-tag" color={gDef.color ?? '#3b82f6'} count={count}
                selected={$activeGroup === gDef.id && $activeTab === 'directory'}
                on:click={() => selectNavGroup(gDef.id)}>
                <svelte:fragment slot="actions">
                {#if canManage}
                  <button
                    type="button"
                    class="row-more-btn"
                    title="Group actions"
                    on:click|stopPropagation={(e) => openGroupMenu(e, gDef)}
                  >
                    <Icon icon={IconMoreV} size="small" />
                  </button>
                {/if}
                </svelte:fragment>
              </NavItem>
            {/each}
          </div>
        </div>

        <!-- Down: Involved Tools Section (Tracker Projects style) -->
        <div class="nav-involved-section">
          <div class="nav-section-header">
            <div class="header-title-wrap">
              <span class="header-chevron">▼</span>
              <span class="nav-section-label">{involvedSectionTitle}</span>
            </div>
            <div class="header-actions-wrap">
              {#if canManage}
                <button
                  type="button"
                  class="header-tool-btn"
                  title="Add tool to this group"
                  on:click|stopPropagation={() => addTool($activeGroup)}
                >
                  +
                </button>
              {/if}
              <button
                type="button"
                class="header-tool-btn"
                class:active={showSidebarSearch}
                title="Search tools"
                on:click|stopPropagation={() => {
                  showSidebarSearch = !showSidebarSearch
                  if (!showSidebarSearch) sidebarSearchQuery = ''
                }}
              >
                🔍
              </button>
            </div>
          </div>

          {#if showSidebarSearch}
            <div class="sidebar-search-row">
              <input
                type="text"
                class="sidebar-search-input"
                placeholder="Filter tools..."
                bind:value={sidebarSearchQuery}
              />
              {#if sidebarSearchQuery}
                <button
                  type="button"
                  class="sidebar-search-clear"
                  on:click={() => (sidebarSearchQuery = '')}
                >
                  ✕
                </button>
              {/if}
            </div>
          {/if}

          <!-- Tools list matching Project sidebar items -->
          <div class="involved-tools-list">
            {#if sidebarInvolvedTools.length === 0}
              <div class="empty-involved-tools">
                <span class="empty-involved-text">
                  No tools {$activeGroup !== 'all' ? 'in ' + (currentGroup?.name ?? 'group') : ''}
                </span>
                {#if canManage}
                  <button
                    type="button"
                    class="empty-involved-add-btn"
                    on:click={() => addTool($activeGroup)}
                  >
                    + Add tool
                  </button>
                {/if}
              </div>
            {:else}
              {#each sidebarInvolvedTools as tool (tool._id)}
                <NavItem title={tool.name} icon={IconFolder} iconProps={{ fill: getGroupColor(tool.group) }}
                  selected={$activeTab === tool._id} on:click={() => openToolDirectly(tool)}>
                  <svelte:fragment slot="actions">
                  <div class="tool-hover-actions" on:click|stopPropagation>
                    <button
                      type="button"
                      class="row-action-btn"
                      title="Open in new window"
                      on:click={() => window.open(tool.href, '_blank', 'noopener,noreferrer')}
                    >
                      ↗
                    </button>
                    {#if canManage}
                      <button
                        type="button"
                        class="row-more-btn"
                        title="Tool options"
                        on:click={(e) => openToolMenu(e, tool)}
                      >
                        <Icon icon={IconMoreV} size="small" />
                      </button>
                    {/if}
                  </div>
                  </svelte:fragment>
                </NavItem>
              {/each}
            {/if}
          </div>
        </div>
      </div>

{:else}
<div class="hulyComponent tools-layout">
  <!-- Right Main Content Area -->
  <main class="antiPanel-component">
    {#if $activeTab !== 'directory' && activeTabTool !== undefined}
      <EmbeddedToolView site={activeTabTool} on:close={() => closeTab($activeTab)} hideToolbar />
    {:else}
    <!-- Top Header. Hidden while a tool tab is open so the iframe uses the full panel. -->
    <Header adaptive="disabled">
      <div class="header-left-wrap">
          <Breadcrumb icon={tools.icon.Application} label={tools.string.Application} size={'large'} />
          {#if $activeGroup !== 'all' && currentGroup}
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

      <!-- Directory View -->
      <div class="directory-view">
        <!-- Group Header Subtitle Banner -->
        <div class="group-banner">
          <div class="group-banner-text">
            <h1 class="group-banner-title">
              {$activeGroup === 'all' ? 'All Hosted Tools' : currentGroup?.name ?? 'Tools'}
            </h1>
            <p class="group-banner-hint">
              {$activeGroup === 'all'
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
                    on:click={() => addTool($activeGroup)}
                  />
                {/if}
              </div>
            {:else if $activeGroup === 'all' && query.trim() === ''}
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
{/if}

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

  .nav-section {
    padding: 0.25rem 0.25rem 0;
  }

  .nav-groups-section {
    padding-top: 0.75rem;
    margin-top: 0.5rem;
    border-top: 1px solid var(--theme-divider-color);
  }

  .nav-involved-section {
    padding-top: 0.75rem;
    margin-top: 0.5rem;
    border-top: 1px solid var(--theme-divider-color);
  }

  .nav-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 1rem 0.375rem 1.25rem;
  }

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  .header-chevron {
    font-size: 0.5rem;
    color: var(--theme-dark-color);
    line-height: 1;
    user-select: none;
  }

  .nav-section-label {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-dark-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-actions-wrap {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .header-tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    color: var(--theme-dark-color);
    font-size: 0.8125rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover,
    &.active {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
    }
  }

  .sidebar-search-row {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0.25rem 0.75rem 0.5rem;
  }

  .sidebar-search-input {
    width: 100%;
    height: 1.75rem;
    padding: 0 1.5rem 0 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--theme-divider-color);
    background-color: rgba(0, 0, 0, 0.2);
    font-size: 0.75rem;
    color: var(--theme-caption-color);
    outline: none;

    &:focus {
      border-color: var(--theme-button-primary);
      background-color: rgba(0, 0, 0, 0.35);
    }
  }

  .sidebar-search-clear {
    position: absolute;
    right: 1rem;
    border: none;
    background: transparent;
    color: var(--theme-dark-color);
    font-size: 0.6875rem;
    cursor: pointer;

    &:hover {
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

      .group-hover-actions {
        display: flex;
      }
    }

    &.selected {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
      font-weight: 600;

      .group-hover-actions {
        display: flex;
      }
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

  .group-hover-actions {
    display: none;
    align-items: center;
    gap: 0.125rem;
    margin-left: 0.25rem;
  }

  .involved-tools-list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0 0.5rem 1rem;
  }

  .involved-tool-row {
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

      .tool-hover-actions {
        display: flex;
      }
    }

    &.selected {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
      font-weight: 500;
    }
  }

  .tool-project-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .tool-row-label {
    flex-grow: 1;
    min-width: 0;
    line-height: 1.25;
  }

  .tool-hover-actions {
    display: none;
    align-items: center;
    gap: 0.125rem;
    margin-left: auto;
    flex-shrink: 0;
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

  .row-more-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    color: var(--theme-dark-color);
    cursor: pointer;
    margin-left: 0.25rem;
    flex-shrink: 0;

    &:hover {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
    }
  }

  .group-nav-row:hover .row-more-btn,
  .group-nav-row.selected .row-more-btn,
  .involved-tool-row:hover .row-more-btn {
    display: flex;
  }

  .empty-involved-tools {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }

  .empty-involved-text {
    line-height: 1.25;
  }

  .empty-involved-add-btn {
    border: none;
    background: transparent;
    color: var(--theme-button-primary);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;

    &:hover {
      text-decoration: underline;
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

  .header-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    border: 1px solid var(--theme-button-border);
    background-color: var(--theme-button-default);
    color: var(--theme-caption-color);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover {
      background-color: var(--theme-button-hovered);
      border-color: var(--theme-button-border-hover);
    }
  }

  .active-tool-title {
    font-weight: 600;
    color: var(--theme-caption-color);
  }

  .tool-quick-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-right: 0.5rem;
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
