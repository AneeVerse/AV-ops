<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import contact, { type Organization } from '@hcengineering/contact'
  import { Ref } from '@hcengineering/core'
  import drive from '@hcengineering/drive'
  import { createQuery } from '@hcengineering/presentation'
  import {
    getCurrentLocation,
    location as locationStore,
    navigate,
    Button,
    Icon
  } from '@hcengineering/ui'
  import { NavLink, TreeNode } from '@hcengineering/view-resources'
  import { SpecialElement } from '@hcengineering/workbench-resources'
  import { type Project } from '@hcengineering/tracker'
  import tracker from '../../plugin'
  import { selectedCompanyStore, setSelectedCompany } from '../../clientUtils'

  const orgQuery = createQuery()
  const projectQuery = createQuery()
  let organization: Organization | undefined
  let projects: Project[] = []

  $: companyId = ($locationStore.query?.company ?? $selectedCompanyStore) as Ref<Organization> | undefined
  $: pathSpace = $locationStore.path[3]
  $: currentSpecial = $locationStore.path[4] ?? $locationStore.path[3]

  $: if (companyId !== undefined) {
    orgQuery.query(contact.class.Organization, { _id: companyId }, (res) => {
      organization = res[0]
    })
    projectQuery.query(tracker.class.Project, { company: companyId, archived: false }, (res) => {
      projects = res
    })
  } else {
    orgQuery.unsubscribe()
    projectQuery.unsubscribe()
    organization = undefined
    projects = []
  }

  function openSpecial (special: string): void {
    if (companyId === undefined) return
    const loc = getCurrentLocation()
    loc.path.length = 4
    loc.path[2] = 'company'
    loc.path[3] = special
    loc.query = {
      ...(loc.query ?? {}),
      company: companyId
    }
    loc.fragment = undefined
    navigate(loc)
  }

  function backToClients (): void {
    setSelectedCompany(undefined)
    const loc = getCurrentLocation()
    loc.path.length = 4
    loc.path[2] = 'company'
    loc.path[3] = 'my-clients'
    loc.query = undefined
    loc.fragment = undefined
    navigate(loc)
  }

  $: visible = companyId !== undefined && organization !== undefined
</script>

{#if visible && organization}
  <div class="flex-col flex-gap-1 p-1">
    <div class="flex-between flex-gap-2 p-1">
      <div class="flex-row-center flex-gap-2 overflow-label">
        <Icon icon={contact.icon.Company} size={'small'} />
        <span class="overflow-label fs-bold">{organization.name}</span>
      </div>
      <Button
        kind={'ghost'}
        size={'small'}
        label={tracker.string.BackToClients}
        on:click={backToClients}
      />
    </div>

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="nav-item" class:selected={currentSpecial === 'company-issues'} on:click={() => openSpecial('company-issues')}>
      <SpecialElement label={tracker.string.Issues} icon={tracker.icon.Issues} selected={currentSpecial === 'company-issues'} />
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="nav-item" class:selected={currentSpecial === 'company-files'} on:click={() => openSpecial('company-files')}>
      <SpecialElement label={tracker.string.CompanyFiles} icon={drive.icon.Folder} selected={currentSpecial === 'company-files'} />
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="nav-item" class:selected={currentSpecial === 'client-home'} on:click={() => openSpecial('client-home')}>
      <SpecialElement label={tracker.string.CompanyProjects} icon={tracker.icon.Home} selected={currentSpecial === 'client-home'} />
    </div>

    {#each projects as project (project._id)}
      <TreeNode
        _id={project._id}
        title={project.name}
        icon={tracker.icon.Home}
        type={'nested'}
        highlighted={pathSpace === project._id}
        visible={pathSpace === project._id}
      >
        <NavLink space={project._id} special={'issues'}>
          <SpecialElement
            indent
            label={tracker.string.Issues}
            icon={tracker.icon.Issues}
            selected={pathSpace === project._id && currentSpecial === 'issues'}
          />
        </NavLink>
        <NavLink space={project._id} special={'project-files'}>
          <SpecialElement
            indent
            label={tracker.string.ProjectFiles}
            icon={drive.icon.Folder}
            selected={pathSpace === project._id && currentSpecial === 'project-files'}
          />
        </NavLink>
      </TreeNode>
    {/each}
  </div>
{/if}

<style lang="scss">
  .nav-item {
    cursor: pointer;
  }
</style>
