<!--
// Copyright © 2026 Hardcore Engineering Inc.
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
  import { Organization } from '@hcengineering/contact'
  import { Ref } from '@hcengineering/core'
  import { createQuery } from '@hcengineering/presentation'
  import { Project } from '@hcengineering/tracker'
  import { Button, IconAdd, Switcher, TabItem, showPopup } from '@hcengineering/ui'
  import { TableBrowser } from '@hcengineering/view-resources'
  import tracker from '../../plugin'
  import Issues from '../issues/Issues.svelte'
  import CreateProject from '../projects/CreateProject.svelte'
  import CompanyDriveFiles from './CompanyDriveFiles.svelte'

  export let object: Organization
  export let readonly: boolean = false

  let tab: string = 'projects'
  const tabs: TabItem[] = [
    { id: 'projects', labelIntl: tracker.string.CompanyProjects },
    { id: 'issues', labelIntl: tracker.string.CompanyTasks },
    { id: 'files', labelIntl: tracker.string.CompanyFiles }
  ]

  const projectQuery = createQuery()
  let projectIds: Ref<Project>[] = []

  $: spaceSelectorQuery = { company: object._id, archived: false }
  $: baseQuery = {
    space: { $in: projectIds.length > 0 ? projectIds : (['none'] as unknown as Ref<Project>[]) }
  }
  $: currentSpace = projectIds.length === 1 ? projectIds[0] : undefined

  $: projectQuery.query(tracker.class.Project, { company: object._id, archived: false }, (result) => {
    projectIds = result.map(({ _id }) => _id)
  })

  function createProject (): void {
    showPopup(CreateProject, { company: object._id }, 'top')
  }
</script>

<div class="antiSection company-related">
  <div class="antiSection-header">
    <Switcher
      name={'company-related'}
      kind={'subtle'}
      items={tabs}
      selected={tab}
      on:select={(e) => {
        if (e.detail?.id != null) {
          tab = String(e.detail.id)
        }
      }}
    />
    {#if tab === 'projects' && !readonly}
      <Button icon={IconAdd} label={tracker.string.CreateRequest} kind={'primary'} size={'small'} on:click={createProject} />
    {/if}
  </div>

  {#if tab === 'projects'}
    <div class="company-related__body">
      <TableBrowser
        _class={tracker.class.Project}
        query={{ company: object._id }}
        config={[
          {
            key: '',
            presenter: tracker.component.ProjectPresenter,
            props: { openIssues: true, showActions: true }
          },
          {
            key: 'requestStatus',
            presenter: tracker.component.RequestStatusPresenter,
            label: tracker.string.RequestStatus
          },
          {
            key: 'requestPriority',
            presenter: tracker.component.RequestPriorityPresenter,
            label: tracker.string.RequestPriority
          },
          'requestDueDate',
          'requestAssignee',
          'members',
          'modifiedOn'
        ]}
      />
    </div>
  {:else if tab === 'issues'}
    <div class="company-related__body">
      <Issues
        {baseQuery}
        {currentSpace}
        title={tracker.string.CompanyTasks}
        icon={tracker.icon.Issues}
        config={[
          ['all', tracker.string.All, {}],
          ['active', tracker.string.Active, {}],
          ['backlog', tracker.string.Backlog, {}]
        ]}
        allProjectsTypes={true}
        useLocalMode={true}
        {spaceSelectorQuery}
        autoSelectSpace={false}
      />
    </div>
  {:else}
    <div class="company-related__body">
      <CompanyDriveFiles {object} {readonly} />
    </div>
  {/if}
</div>

<style lang="scss">
  .company-related {
    min-height: 24rem;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }

  .company-related__body {
    min-height: 20rem;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }
</style>
