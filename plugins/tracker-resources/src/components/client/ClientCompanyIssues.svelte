<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { Ref } from '@hcengineering/core'
  import { createQuery } from '@hcengineering/presentation'
  import { location as locationStore } from '@hcengineering/ui'
  import { type Organization } from '@hcengineering/contact'
  import { type Project } from '@hcengineering/tracker'
  import tracker from '../../plugin'
  import Issues from '../issues/Issues.svelte'
  import { selectedCompanyStore } from '../../clientUtils'

  const projectQuery = createQuery()
  let projectIds: Ref<Project>[] = []

  $: companyId = ($locationStore.query?.company ?? $selectedCompanyStore) as Ref<Organization> | undefined
  $: spaceSelectorQuery =
    companyId !== undefined ? { company: companyId, archived: false } : { _id: { $in: [] as Ref<Project>[] } }
  $: baseQuery = {
    space: { $in: projectIds.length > 0 ? projectIds : (['none'] as unknown as Ref<Project>[]) }
  }
  $: currentSpace = projectIds.length === 1 ? projectIds[0] : undefined

  $: if (companyId !== undefined) {
    projectQuery.query(tracker.class.Project, { company: companyId, archived: false }, (result) => {
      projectIds = result.map(({ _id }) => _id)
    })
  } else {
    projectQuery.unsubscribe()
    projectIds = []
  }
</script>

<Issues
  {baseQuery}
  {currentSpace}
  title={tracker.string.Issues}
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
