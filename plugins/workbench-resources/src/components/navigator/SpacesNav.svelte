<!--
// Copyright © 2020 Anticrm Platform Contributors.
// Copyright © 2023 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
-->
<script lang="ts">
  import contact, { type Organization } from '@hcengineering/contact'
  import core, { Doc, Ref, Space, AccountRole, getCurrentAccount, hasAccountRole } from '@hcengineering/core'
  import { IntlString, getResource } from '@hcengineering/platform'
  import preference from '@hcengineering/preference'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import {
    Action,
    AnyComponent,
    IconAdd,
    IconSearch,
    SearchInput,
    getCurrentResolvedLocation,
    navigate,
    showPopup
  } from '@hcengineering/ui'
  import { TreeNode } from '@hcengineering/view-resources'
  import { SpacesNavModel } from '@hcengineering/workbench'
  import { createEventDispatcher } from 'svelte'
  import { InboxNotificationsClientImpl } from '@hcengineering/notification-resources'
  import { DocNotifyContext, InboxNotification } from '@hcengineering/notification'

  import plugin from '../../plugin'
  import TreeSeparator from './TreeSeparator.svelte'
  import SpacesNavItem from './SpacesNavItem.svelte'

  export let model: SpacesNavModel
  export let currentSpace: Ref<Space> | undefined
  export let spaces: Space[]
  export let currentSpecial: string | undefined
  export let currentFragment: string | undefined
  export let hasSpaceBrowser: boolean = false
  export let deselect: boolean = false
  export let separate: boolean = false

  const client = getClient()
  const dispatch = createEventDispatcher()

  const addSpace = (addSpaceLabel: IntlString, createComponent: AnyComponent): Action => ({
    label: addSpaceLabel,
    icon: IconAdd,
    action: async (_id: Ref<Doc>): Promise<void> => {
      dispatch('open')
      showPopup(createComponent, {}, 'top')
    }
  })

  const browseSpaces: Action = {
    label: plugin.string.BrowseSpaces,
    icon: IconSearch,
    action: async (_id: Ref<Doc>): Promise<void> => {
      const loc = getCurrentResolvedLocation()
      loc.path[3] = 'spaceBrowser'
      loc.path.length = 4
      dispatch('open')
      navigate(loc)
    }
  }

  const starSpace: Action = {
    label: preference.string.Star,
    icon: preference.icon.Star,
    action: async (_id: Ref<Space>): Promise<void> => {
      await client.createDoc(preference.class.SpacePreference, core.space.Workspace, {
        attachedTo: _id
      })
    }
  }

  const inboxClient = InboxNotificationsClientImpl.getClient()
  const notifyContextByDocStore = inboxClient.contextByDoc
  const inboxNotificationsByContextStore = inboxClient.inboxNotificationsByContext

  function isChanged (
    space: Space,
    notifyContextByDoc: Map<Ref<Doc>, DocNotifyContext>,
    inboxNotificationsByContext: Map<Ref<DocNotifyContext>, InboxNotification[]>
  ): boolean {
    const context = notifyContextByDoc.get(space._id)

    if (context === undefined) {
      return false
    }

    const inboxNotifications = inboxNotificationsByContext.get(context._id) ?? []

    return inboxNotifications.filter(({ isViewed }) => !isViewed).length > 0
  }

  function getParentActions (): Action[] {
    const result = hasSpaceBrowser ? [browseSpaces] : []
    if (
      hasAccountRole(getCurrentAccount(), AccountRole.User) &&
      model.addSpaceLabel !== undefined &&
      model.createComponent !== undefined
    ) {
      result.push(addSpace(model.addSpaceLabel, model.createComponent))
    }
    return result
  }

  let visibleIf: ((space: Space) => Promise<boolean>) | undefined

  $: if (model.visibleIf) {
    getResource(model.visibleIf).then((r) => {
      visibleIf = r
    })
  }

  let filteredSpaces: Space[] = []

  async function updateSpaces (spaces: Space[], visibleIf: (space: Space) => Promise<boolean>): Promise<void> {
    const result: Space[] = []
    for (const s of spaces) {
      if (await visibleIf(s)) {
        result.push(s)
      }
    }
    filteredSpaces = result
  }

  $: if (visibleIf) {
    updateSpaces(spaces, visibleIf)
  } else {
    filteredSpaces = spaces
  }

  // Optional company label on space docs (Tracker Project.company → Organization).
  type SpaceWithCompany = Space & { company?: Ref<Organization> }
  const companyQuery = createQuery()
  let companyNameById = new Map<Ref<Organization>, string>()

  $: companyIds = [
    ...new Set(
      filteredSpaces
        .map((s) => (s as SpaceWithCompany).company)
        .filter((id): id is Ref<Organization> => id != null)
    )
  ]

  $: if (companyIds.length > 0) {
    companyQuery.query(contact.class.Organization, { _id: { $in: companyIds } }, (res) => {
      companyNameById = new Map(res.map((o) => [o._id, o.name ?? '']))
    })
  } else {
    companyQuery.unsubscribe()
    companyNameById = new Map()
  }

  let search = ''
  let searchActive = false
  let searchEl: HTMLElement | undefined
  $: searchNorm = search.trim().toLowerCase()
  $: displayedSpaces =
    searchNorm === ''
      ? filteredSpaces
      : filteredSpaces.filter((s) => {
          if (s.name.toLowerCase().includes(searchNorm)) return true
          const companyId = (s as SpaceWithCompany).company
          if (companyId == null) return false
          return (companyNameById.get(companyId) ?? '').toLowerCase().includes(searchNorm)
        })

  $: visibleSpace = displayedSpaces.find((fs) => fs._id === currentSpace)
  $: empty = displayedSpaces.length === 0 || displayedSpaces === undefined
  $: visible =
    visibleSpace !== undefined &&
    (currentSpecial !== undefined || currentFragment !== undefined || currentFragment !== '') &&
    !deselect &&
    !empty

  function handleSearchFocusOut (ev: FocusEvent): void {
    const target = ev.currentTarget as HTMLElement
    const related = ev.relatedTarget
    if (related == null || !target.contains(related as Node)) {
      searchActive = false
    }
  }

  // NavGroup renders the tools slot inside the header <button>, so a plain click lands
  // on the button: focus goes there instead of the input and the group toggles. Take
  // the press over and focus the field ourselves.
  function handleSearchPointerDown (ev: PointerEvent): void {
    ev.stopPropagation()
    const input = searchEl?.querySelector('input')
    if (input == null) return
    // Once focused, leave the event alone so caret placement and selection still work.
    if (document.activeElement === input) return
    ev.preventDefault()
    searchActive = true
    input.focus()
  }

  function handleSearchKeydown (ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') return
    ev.stopPropagation()
    search = ''
    searchActive = false
    ;(ev.currentTarget as HTMLElement).querySelector('input')?.blur()
  }
</script>

{#if model.searchable}
  <div class="spaces-nav-searchable" class:search-active={searchActive || search !== ''}>
    <TreeNode
      _id={'tree-' + model.id}
      label={model.label}
      actions={async () => getParentActions()}
      highlighted={visible}
      isFold={!empty}
      noDivider
      {empty}
      {visible}
    >
      <svelte:fragment slot="tools">
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          bind:this={searchEl}
          class="spaces-nav-search"
          on:pointerdown={handleSearchPointerDown}
          on:click|stopPropagation
          on:keydown={handleSearchKeydown}
          on:focusin={() => {
            searchActive = true
          }}
          on:focusout={handleSearchFocusOut}
        >
          <SearchInput bind:value={search} collapsed width="100%" />
        </div>
      </svelte:fragment>

      {#each displayedSpaces as space, i (space._id)}
        {#if separate && model.specials && i !== 0}<TreeSeparator line />{/if}
        <SpacesNavItem
          {model}
          {space}
          {currentSpace}
          {currentSpecial}
          {currentFragment}
          {deselect}
          isChanged={isChanged(space, $notifyContextByDocStore, $inboxNotificationsByContextStore)}
          spaceActions={[starSpace]}
        />
      {/each}

      <svelte:fragment slot="visible">
        {#if visibleSpace}
          <SpacesNavItem
            {model}
            space={visibleSpace}
            {currentSpace}
            {currentSpecial}
            {currentFragment}
            {deselect}
            isChanged={isChanged(visibleSpace, $notifyContextByDocStore, $inboxNotificationsByContextStore)}
            spaceActions={[starSpace]}
            forciblyСollapsed
          />
        {/if}
      </svelte:fragment>
    </TreeNode>
  </div>
{:else}
  <TreeNode
    _id={'tree-' + model.id}
    label={model.label}
    actions={async () => getParentActions()}
    highlighted={visible}
    isFold={!empty}
    noDivider
    {empty}
    {visible}
  >
    {#each displayedSpaces as space, i (space._id)}
      {#if separate && model.specials && i !== 0}<TreeSeparator line />{/if}
      <SpacesNavItem
        {model}
        {space}
        {currentSpace}
        {currentSpecial}
        {currentFragment}
        {deselect}
        isChanged={isChanged(space, $notifyContextByDocStore, $inboxNotificationsByContextStore)}
        spaceActions={[starSpace]}
      />
    {/each}

    <svelte:fragment slot="visible">
      {#if visibleSpace}
        <SpacesNavItem
          {model}
          space={visibleSpace}
          {currentSpace}
          {currentSpecial}
          {currentFragment}
          {deselect}
          isChanged={isChanged(visibleSpace, $notifyContextByDocStore, $inboxNotificationsByContextStore)}
          spaceActions={[starSpace]}
          forciblyСollapsed
        />
      {/if}
    </svelte:fragment>
  </TreeNode>
{/if}

<style lang="scss">
  /* Keep search and create-project visible; the theme hides header tools until hover. */
  .spaces-nav-searchable :global(.hulyNavGroup-header__tools) {
    display: flex;
    min-width: 0;
    max-width: none;
  }
  .spaces-nav-searchable.search-active :global(.hulyNavGroup-header__label) {
    display: none;
  }
  /* While searching the field takes the whole row. */
  .spaces-nav-searchable.search-active :global(.hulyNavGroup-header__tools) {
    flex: 1;
  }
  /* The header keeps a flex-grow spacer between label and tools, which would otherwise
     split the free space with the expanding field. */
  .spaces-nav-searchable.search-active :global(.hulyNavGroup-header > .flex-grow) {
    display: none;
  }
  /* Match the expand UX: hide fold chevron and create/browse buttons; search alone. */
  .spaces-nav-searchable.search-active :global(.hulyNavGroup-header__chevron) {
    display: none;
  }
  .spaces-nav-searchable.search-active :global(.hulyNavGroup-header__tools > :not(.spaces-nav-search)) {
    display: none;
  }
  .spaces-nav-search {
    flex: 1;
    min-width: 0;
  }
  .spaces-nav-searchable.search-active :global(.spaces-nav-search .searchInput-wrapper) {
    max-width: 100% !important;
    width: 100%;
  }
  /* No trailing rule under the spaces group above Help & Support. */
  .spaces-nav-searchable :global(.hulyNavGroup-container) {
    border-bottom: none;
  }
</style>
