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
  import { type AnyAttribute, Class, DocumentQuery, FindOptions, type IdMap, Ref, Status } from '@hcengineering/core'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import { Project, ProjectType, Task, findStatusAttr, getStates } from '@hcengineering/task'
  import type { TabItem } from '@hcengineering/ui'
  import type { ViewOptions, Viewlet } from '@hcengineering/view'
  import { ScrollerBar, TabList, Switcher } from '@hcengineering/ui'
  import { TableBrowser, statusStore } from '@hcengineering/view-resources'
  import { typeStore } from '..'
  import task from '../plugin'
  import Lost from './icons/Lost.svelte'
  import Won from './icons/Won.svelte'
  import StatesBar from './state/StatesBar.svelte'

  export let _class: Ref<Class<Task>>
  export let space: Ref<Project> | undefined = undefined
  export let query: DocumentQuery<Task>
  export let options: FindOptions<Task> | undefined
  export let config: string[]
  export let viewOptions: ViewOptions | undefined = undefined
  export let viewlet: Viewlet | undefined = undefined

  let doneStatusesView: boolean = false
  let state: Ref<Status> | undefined = undefined
  let _space: Project | undefined = undefined
  const selectedDoneStates: Set<Ref<Status>> = new Set<Ref<Status>>()
  $: resConfig = updateConfig(config)
  const client = getClient()
  // Restrict chips to this task class's status attribute so Lead/Client
  // Won/Lost IssueStatus leaks on a shared project type never appear in Tracker.
  // Also drop IssueStatus docs literally named Won/Lost (CreateTaskType used to
  // seed those from StatusCategory.defaultStatusName).
  const trackerIssueStatusAttr = 'tracker:attribute:IssueStatus' as Ref<AnyAttribute>
  const leadStyleIssueNames = new Set(['Won', 'Lost'])
  $: statusAttr = findStatusAttr(client.getHierarchy(), _class)

  function isTrackerDoneChip (p: Status, statusAttrId: Ref<AnyAttribute>): boolean {
    if (p.category == null || ![task.statusCategory.Won, task.statusCategory.Lost].includes(p.category)) {
      return false
    }
    if (p.ofAttribute !== statusAttrId) {
      return false
    }
    if (statusAttrId === trackerIssueStatusAttr && leadStyleIssueNames.has(p.name)) {
      return false
    }
    return true
  }

  function isActiveStateChip (p: Status, statusAttrId: Ref<AnyAttribute>): boolean {
    if (p.category === task.statusCategory.Won || p.category === task.statusCategory.Lost) {
      return false
    }
    return p.ofAttribute === statusAttrId
  }

  function collectStates (
    spaceDoc: Project | undefined,
    types: IdMap<ProjectType>,
    statuses: IdMap<Status>,
    statusAttrId: Ref<AnyAttribute>
  ): Status[] {
    if (spaceDoc !== undefined) {
      return getStates(spaceDoc, types, statuses).filter((p) => isActiveStateChip(p, statusAttrId))
    }
    const seen = new Set<Ref<Status>>()
    const result: Status[] = []
    for (const type of types.values()) {
      for (const ps of type.statuses ?? []) {
        if (seen.has(ps._id)) continue
        const st = statuses.get(ps._id)
        if (st == null || !isActiveStateChip(st, statusAttrId)) continue
        seen.add(ps._id)
        result.push(st)
      }
    }
    return result
  }

  /**
   * Project Issues has a space → statuses come from that project type.
   * All issues / My issues pass space=undefined; getStates() then returns [].
   * Union done statuses across all project types so Done/Canceled chips still appear.
   */
  function collectDoneStates (
    spaceDoc: Project | undefined,
    types: IdMap<ProjectType>,
    statuses: IdMap<Status>,
    statusAttrId: Ref<AnyAttribute>
  ): Status[] {
    if (spaceDoc !== undefined) {
      return getStates(spaceDoc, types, statuses).filter((p) => isTrackerDoneChip(p, statusAttrId))
    }
    const seen = new Set<Ref<Status>>()
    const result: Status[] = []
    for (const type of types.values()) {
      for (const ps of type.statuses ?? []) {
        if (seen.has(ps._id)) continue
        const st = statuses.get(ps._id)
        if (st == null || !isTrackerDoneChip(st, statusAttrId)) continue
        seen.add(ps._id)
        result.push(st)
      }
    }
    return result
  }

  $: states = collectStates(_space, $typeStore, $statusStore.byId, statusAttr._id)
  $: stateItems = states.map((s) => ({ id: s._id, label: s.name }))
  $: selectedState = state ?? ''
  $: doneStates = collectDoneStates(_space, $typeStore, $statusStore.byId, statusAttr._id)
  $: itemsDS = getItems(doneStates)
  let selectedDS: string[] = []
  let withoutDone: boolean = false
  let resultQuery: DocumentQuery<Task>
  let divScroll: HTMLElement

  function getItems (doneStates: Status[]): TabItem[] {
    const itemsDS: TabItem[] = doneStates.map((s) => {
      return {
        id: s._id,
        label: s.name,
        icon: s.category === task.statusCategory.Won ? Won : Lost,
        color: s.category === task.statusCategory.Won ? 'var(--theme-won-color)' : 'var(--theme-lost-color)'
      }
    })
    itemsDS.unshift({ id: 'NoDoneState', labelIntl: task.string.NoDoneState })
    return itemsDS
  }

  function updateConfig (config: string[]): string[] {
    // Keep the user's column layout stable when filtering by a single status /
    // done-state — hiding columns made Customize View look like it reset.
    return config
  }

  const spaceQuery = createQuery()

  $: if (space !== undefined) {
    spaceQuery.query(
      task.class.Project,
      {
        _id: space
      },
      (res) => {
        _space = res[0]
      }
    )
  } else {
    spaceQuery.unsubscribe()
    _space = undefined
  }

  function updateQuery (query: DocumentQuery<Task>, selectedDoneStates: Set<Ref<Status>>): void {
    resConfig = updateConfig(config)
    const result = client.getHierarchy().clone(query)
    if (state) {
      result.status = state
    } else {
      if (selectedDoneStates.size > 0) {
        result.status = {
          $in: Array.from(selectedDoneStates)
        }
      } else if (withoutDone) {
        result.status = {
          $nin: doneStates.map((p) => p._id)
        }
      }
    }
    resultQuery = result
  }

  function doneStateClick (id: Ref<Status>): void {
    withoutDone = false
    if (selectedDoneStates.has(id)) selectedDoneStates.delete(id)
    else selectedDoneStates.add(id)
    if (selectedDS.length === 2 && selectedDS.includes('NoDoneState')) {
      selectedDS = selectedDS.filter((s) => s !== 'NoDoneState')
    }
    if (selectedDS.length === 0) {
      selectedDS = ['NoDoneState']
      withoutDone = true
    }
    updateQuery(query, selectedDoneStates)
  }

  function noDoneClick (): void {
    withoutDone = true
    selectedDS = ['NoDoneState']
    selectedDoneStates.clear()
    updateQuery(query, selectedDoneStates)
  }

  function stateClick (id: Ref<Status>): void {
    state = state === id ? undefined : id
    updateQuery(query, selectedDoneStates)
  }

  $: updateQuery(query, selectedDoneStates)

  function clearStatusSelection (): void {
    state = undefined
    withoutDone = false
    selectedDoneStates.clear()
    selectedDS = []
    updateQuery(query, selectedDoneStates)
  }

  const handleSelect = (result: any) => {
    if (result.type === 'select') {
      const res = result.detail
      if (res.id === 'AllStates') {
        doneStatusesView = false
        clearStatusSelection()
      } else if (res.id === 'DoneStates') {
        doneStatusesView = true
        state = undefined
        selectedDoneStates.clear()
        updateQuery(query, selectedDoneStates)
      }
    }
  }
  const handleDoneSelect = (result: any) => {
    if (result.type === 'select') {
      const res = result.detail
      if (res.id === 'NoDoneState') noDoneClick()
      else doneStateClick(res.id)
    }
  }
  const handleStateSelect = (result: any) => {
    if (result.type === 'select') {
      stateClick(result.detail.id)
    }
  }
</script>

<div class="status-table-bar clearPadding justify-between flex-gap-4">
  <Switcher
    name={'status-table-states'}
    kind={'subtle'}
    selected={doneStatusesView ? 'DoneStates' : 'AllStates'}
    items={[
      { id: 'AllStates', labelIntl: task.string.AllStates },
      { id: 'DoneStates', labelIntl: task.string.DoneStates }
    ]}
    on:select={handleSelect}
  />
  {#if doneStatusesView}
    <ScrollerBar gap={'none'} bind:scroller={divScroll}>
      <TabList items={itemsDS} bind:selected={selectedDS} multiselect on:select={handleDoneSelect} />
    </ScrollerBar>
  {:else if space !== undefined}
    <StatesBar
      bind:state
      {space}
      gap={'none'}
      on:change={() => {
        updateQuery(query, selectedDoneStates)
      }}
    />
  {:else if stateItems.length > 0}
    <ScrollerBar gap={'none'} bind:scroller={divScroll}>
      <TabList items={stateItems} selected={selectedState} on:select={handleStateSelect} />
    </ScrollerBar>
  {/if}
</div>
<TableBrowser {_class} bind:query={resultQuery} config={resConfig} {options} {viewOptions} {viewlet} showNotification />

<style lang="scss">
  .status-table-bar {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    width: 100%;
    min-width: 0;
    border-bottom: 1px solid var(--theme-divider-color);
  }
</style>
