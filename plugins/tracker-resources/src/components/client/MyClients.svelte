<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { getCurrentEmployee } from '@hcengineering/contact'
  import { AttachedDoc, Class, DocumentQuery, getCurrentAccount, Ref, Space, WithLookup } from '@hcengineering/core'
  import { IntlString, Asset } from '@hcengineering/platform'
  import { createQuery, SpaceSelector } from '@hcengineering/presentation'
  import {
    IModeSelector,
    Breadcrumb,
    ModeSelector,
    resolvedLocationStore,
    SearchInput,
    Header
  } from '@hcengineering/ui'
  import { Viewlet, ViewletPreference, ViewOptions } from '@hcengineering/view'
  import {
    FilterBar,
    FilterButton,
    ViewletContentView,
    ViewletSelector,
    ViewletSettingButton
  } from '@hcengineering/view-resources'
  import { createEventDispatcher } from 'svelte'
  import { type Client } from '@hcengineering/tracker'
  import tracker from '../../plugin'
  import contact from '@hcengineering/contact'
  import { setSelectedCompany } from '../../clientUtils'

  export let _class: Ref<Class<Client>> = tracker.class.Client
  export let labelTasks: IntlString = tracker.string.MyClients
  export let icon: Asset = contact.icon.Company
  export let config: [string, IntlString, object][] = []

  let search = ''
  const dispatch = createEventDispatcher()
  const me = getCurrentEmployee()
  const myAcc = getCurrentAccount()
  const assigned = { assignee: me }
  const created = { createdBy: { $in: myAcc.socialIds } }
  let subscribed = { _id: { $in: [] as Ref<Client>[] } }
  let mode: string | undefined = undefined
  let baseQuery: DocumentQuery<Client> | undefined = undefined
  let modeSelectorProps: IModeSelector | undefined = undefined
  let space: Ref<Space> | undefined = undefined
  let autoSelectSpace = true
  $: if (space !== undefined) autoSelectSpace = false

  setSelectedCompany(undefined)

  $: queries = { assigned, created, subscribed }
  $: mode = $resolvedLocationStore.query?.mode ?? undefined

  function withSpace (q: DocumentQuery<Client>, space: Ref<Space> | undefined): DocumentQuery<Client> {
    if (space !== undefined) {
      return { ...q, space }
    }
    const { space: _ignored, ...rest } = q
    return rest
  }

  let searchQuery: DocumentQuery<Client> = { ...(baseQuery ?? {}) }
  function updateSearchQuery (search: string, space: Ref<Space> | undefined): void {
    searchQuery = withSpace(search === '' ? { ...baseQuery } : { ...baseQuery, $search: search }, space)
  }
  $: if (baseQuery) updateSearchQuery(search, space)
  $: resultQuery = withSpace({ ...searchQuery }, space)

  const subscribedQuery = createQuery()
  function getSubscribed () {
    subscribedQuery.query(
      _class,
      { 'notification:mixin:Collaborators.collaborators': myAcc.uuid },
      (result) => {
        const newSub = result.map((p) => p._id as Ref<AttachedDoc> as Ref<Client>)
        const curSub = subscribed._id.$in
        if (curSub.length !== newSub.length || curSub.some((id, i) => newSub[i] !== id)) {
          subscribed = { _id: { $in: newSub } }
        }
      },
      { sort: { _id: 1 } }
    )
  }
  $: if (mode === 'subscribed') getSubscribed()
  $: if (mode === undefined || (queries as any)[mode] === undefined) {
    ;[[mode]] = config
  }
  $: if (mode !== undefined) {
    baseQuery = { ...((queries as any)[mode] ?? {}) }
    modeSelectorProps = {
      config,
      mode,
      onChange: (newMode: string) => dispatch('action', { mode: newMode })
    }
  }

  let viewlet: WithLookup<Viewlet> | undefined
  let preference: ViewletPreference | undefined = undefined
  let viewOptions: ViewOptions | undefined = undefined
</script>

<Header adaptive={'freezeActions'} hideActions={modeSelectorProps === undefined} freezeBefore>
  <svelte:fragment slot="beforeTitle">
    <ViewletSelector
      bind:viewlet
      bind:preference
      viewletQuery={{
        attachTo: _class,
        variant: { $exists: false }
      }}
    />
    <ViewletSettingButton bind:viewOptions bind:viewlet />
  </svelte:fragment>

  <Breadcrumb {icon} label={labelTasks} size={'large'} isCurrent />

  <svelte:fragment slot="search">
    <SearchInput bind:value={search} collapsed on:change={(e) => (search = e.detail)} />
    <FilterButton {_class} {space} />
    <SpaceSelector
      _class={tracker.class.ClientFunnel}
      label={tracker.string.Funnels}
      bind:space
      autoSelect={autoSelectSpace}
      allowDeselect={true}
      kind={'regular'}
      size={'small'}
      defaultIcon={contact.icon.Company}
    />
  </svelte:fragment>
  <svelte:fragment slot="actions">
    {#if modeSelectorProps !== undefined}
      <ModeSelector kind={'subtle'} props={modeSelectorProps} />
    {/if}
  </svelte:fragment>
</Header>
<FilterBar
  {_class}
  query={searchQuery}
  {viewOptions}
  {space}
  on:change={(e) => (resultQuery = withSpace(e.detail, space))}
/>

{#if viewlet && viewOptions}
  <ViewletContentView {_class} {viewlet} query={resultQuery} {space} {viewOptions} />
{/if}
