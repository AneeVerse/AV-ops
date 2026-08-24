<!--
// Copyright © 2022 Hardcore Engineering Inc.
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
  import contact, { getCurrentEmployee } from '@hcengineering/contact'
  import { AttachedDoc, Class, DocumentQuery, getCurrentAccount, Ref, Space, WithLookup } from '@hcengineering/core'
  import { Lead } from '@hcengineering/lead'
  import { IntlString, Asset } from '@hcengineering/platform'
  import { createQuery, getClient, buildRelatedSearchQuery, SpaceSelector } from '@hcengineering/presentation'
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
  import lead from '../plugin'

  export let _class: Ref<Class<Lead>> = lead.class.Lead
  export let labelTasks: IntlString = lead.string.MyLeads
  export let icon: Asset = lead.icon.Lead
  export let config: [string, IntlString, object][] = []

  let search = ''
  const dispatch = createEventDispatcher()
  const client = getClient()
  const me = getCurrentEmployee()
  const myAcc = getCurrentAccount()
  const assigned = { assignee: me }
  const created = { createdBy: { $in: myAcc.socialIds } }
  let subscribed = { _id: { $in: [] as Ref<Lead>[] } }
  let mode: string | undefined = undefined
  let baseQuery: DocumentQuery<Lead> | undefined = undefined
  let modeSelectorProps: IModeSelector | undefined = undefined
  let space: Ref<Space> | undefined = undefined
  let autoSelectSpace = false

  $: queries = { assigned, created, subscribed }
  $: mode = $resolvedLocationStore.query?.mode ?? undefined

  function withSpace (q: DocumentQuery<Lead>, space: Ref<Space> | undefined): DocumentQuery<Lead> {
    if (space !== undefined) {
      return { ...q, space }
    }
    const { space: _ignored, ...rest } = q
    return rest
  }

  let searchQuery: DocumentQuery<Lead> = { ...(baseQuery ?? {}) }
  async function updateSearchQuery (search: string, space: Ref<Space> | undefined, base: DocumentQuery<Lead> | undefined): Promise<void> {
    const q = await buildRelatedSearchQuery(
      client,
      _class,
      base ?? {},
      search,
      [{ field: 'attachedTo', _class: contact.class.Contact }],
      ['title', 'identifier']
    )
    searchQuery = withSpace(q, space)
  }
  $: if (baseQuery !== undefined) void updateSearchQuery(search, space, baseQuery)
  $: resultQuery = withSpace({ ...searchQuery }, space)

  const subscribedQuery = createQuery()
  function getSubscribed () {
    subscribedQuery.query(
      _class,
      { 'notification:mixin:Collaborators.collaborators': myAcc.uuid },
      (result) => {
        const newSub = result.map((p) => p._id as Ref<AttachedDoc> as Ref<Lead>)
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
      _class={lead.class.Funnel}
      label={lead.string.Funnel}
      bind:space
      autoSelect={autoSelectSpace}
      allowDeselect={true}
      kind={'regular'}
      size={'small'}
      defaultIcon={lead.icon.Funnel}
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
