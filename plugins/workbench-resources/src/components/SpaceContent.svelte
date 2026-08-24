<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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
  import type { Class, Doc, DocumentQuery, Ref, RefTo, Space, WithLookup } from '@hcengineering/core'
  import core from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import {
    buildRelatedSearchQuery,
    createQuery,
    getClient,
    type RelatedSearchRef
  } from '@hcengineering/presentation'
  import { AnyComponent, Component, Loading } from '@hcengineering/ui'
  import view, { Viewlet, ViewletPreference, ViewOptions } from '@hcengineering/view'
  import { FilterBar } from '@hcengineering/view-resources'

  export let _class: Ref<Class<Doc>>
  export let space: Ref<Space>
  export let search: string = ''
  export let viewlet: WithLookup<Viewlet> | undefined
  export let createItemDialog: AnyComponent | undefined
  export let createItemLabel: IntlString | undefined
  export let viewOptions: ViewOptions

  const preferenceQuery = createQuery()
  let preference: ViewletPreference | undefined
  let loading = true

  const client = getClient()
  const hierarchy = client.getHierarchy()
  $: baseQuery = hierarchy.classHierarchyMixin(_class, view.mixin.BaseQuery)

  $: query = buildQuery(space, baseQuery?.baseQuery, viewlet)

  let searchQuery: DocumentQuery<Doc> = {}
  $: resultQuery = searchQuery
  $: void updateSearchQuery(_class, query, search)

  function buildQuery (
    space: Ref<Space>,
    baseQuery: DocumentQuery<Doc> | undefined,
    viewlet: WithLookup<Viewlet> | undefined
  ): DocumentQuery<Doc> {
    return {
      space,
      ...(baseQuery ?? {}),
      ...(viewlet?.baseQuery ?? {})
    }
  }

  /** Widen search to Contact names when the class has an attachedTo → Contact ref (Lead customer). */
  function relatedSearchRefs (objectClass: Ref<Class<Doc>>): RelatedSearchRef[] | undefined {
    try {
      const attr = hierarchy.getAttribute(objectClass, 'attachedTo')
      if (!hierarchy.isDerived(attr.type._class, core.class.RefTo)) return undefined
      const to = (attr.type as RefTo<Doc>).to
      const base = hierarchy.isMixin(to) ? hierarchy.getBaseClass(to) : to
      if (hierarchy.isDerived(to, contact.class.Contact) || hierarchy.isDerived(base, contact.class.Contact)) {
        return [{ field: 'attachedTo', _class: contact.class.Contact }]
      }
    } catch {
      // No attachedTo on this class.
    }
    return undefined
  }

  async function updateSearchQuery (
    objectClass: Ref<Class<Doc>>,
    base: DocumentQuery<Doc>,
    text: string
  ): Promise<void> {
    searchQuery = await buildRelatedSearchQuery(
      client,
      objectClass,
      base,
      text,
      relatedSearchRefs(objectClass),
      ['title', 'identifier', 'name']
    )
  }

  $: viewlet &&
    preferenceQuery.query(
      view.class.ViewletPreference,
      {
        space: core.space.Workspace,
        attachedTo: viewlet._id
      },
      (res) => {
        preference = res[0]
        loading = false
      },
      { limit: 1 }
    )
</script>

{#if viewlet}
  {#key space}
    {#if viewlet.$lookup?.descriptor?.component}
      {#if loading}
        <Loading />
      {:else}
        <FilterBar
          {_class}
          {space}
          query={searchQuery}
          {viewOptions}
          on:change={(e) => {
            // FilterBar already starts from searchQuery — do not re-merge the
            // unsearched base or free-text `_id: { $in }` is wiped.
            resultQuery = e.detail
          }}
        />
        <Component
          is={viewlet.$lookup?.descriptor?.component}
          props={{
            _class,
            space,
            options: viewlet.options,
            config: preference?.config ?? viewlet.config,
            viewlet,
            viewOptions,
            viewOptionsConfig: viewlet.viewOptions?.other,
            createItemDialog,
            createItemLabel,
            query: resultQuery
          }}
        />
      {/if}
    {/if}
  {/key}
{/if}
