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
  import contact from '@hcengineering/contact'
  import { Class, DocumentQuery, Ref, Space, WithLookup } from '@hcengineering/core'
  import { Lead } from '@hcengineering/lead'
  import { IntlString, Asset } from '@hcengineering/platform'
  import { getClient, buildRelatedSearchQuery, SpaceSelector } from '@hcengineering/presentation'
  import { Breadcrumb, SearchInput, Header } from '@hcengineering/ui'
  import { Viewlet, ViewletPreference, ViewOptions } from '@hcengineering/view'
  import {
    FilterBar,
    FilterButton,
    ViewletContentView,
    ViewletSelector,
    ViewletSettingButton
  } from '@hcengineering/view-resources'
  import lead from '../plugin'

  export let _class: Ref<Class<Lead>> = lead.class.Lead
  export let labelTasks: IntlString = lead.string.AllLeads
  export let icon: Asset = lead.icon.Lead

  let search = ''
  const client = getClient()
  let space: Ref<Space> | undefined = undefined
  let autoSelectSpace = true
  $: if (space !== undefined) autoSelectSpace = false

  function withSpace (q: DocumentQuery<Lead>, space: Ref<Space> | undefined): DocumentQuery<Lead> {
    if (space !== undefined) {
      return { ...q, space }
    }
    const { space: _ignored, ...rest } = q
    return rest
  }

  let searchQuery: DocumentQuery<Lead> = {}
  async function updateSearchQuery (search: string, space: Ref<Space> | undefined): Promise<void> {
    const q = await buildRelatedSearchQuery(
      client,
      _class,
      {},
      search,
      [{ field: 'attachedTo', _class: contact.class.Contact }],
      ['title']
    )
    searchQuery = withSpace(q, space)
  }
  $: void updateSearchQuery(search, space)
  $: resultQuery = withSpace({ ...searchQuery }, space)

  let viewlet: WithLookup<Viewlet> | undefined
  let preference: ViewletPreference | undefined = undefined
  let viewOptions: ViewOptions | undefined = undefined
</script>

<Header adaptive={'freezeActions'} hideActions freezeBefore>
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
