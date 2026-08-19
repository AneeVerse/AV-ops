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
    Icon,
    IconMoreV
  } from '@hcengineering/ui'
  import { SpecialElement } from '@hcengineering/workbench-resources'
  import { showMenu } from '@hcengineering/view-resources'
  import { type Project } from '@hcengineering/tracker'
  import tracker from '../../plugin'
  import { selectedCompanyStore, setSelectedCompany } from '../../clientUtils'
  import { projectNavTitle } from '../../projectTitle'

  const orgQuery = createQuery()
  const projectQuery = createQuery()
  let organization: Organization | undefined
  let projects: Project[] = []

  const listPages = new Set(['my-clients', 'companies', 'funnels'])

  $: pathSpace = $locationStore.path[3]
  $: onListPage = pathSpace !== undefined && listPages.has(pathSpace)
  $: companyId = onListPage
    ? undefined
    : (($locationStore.query?.company ?? $selectedCompanyStore) as Ref<Organization> | undefined)
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

  function openProjectSpecial (projectId: Ref<Project>, special: string): void {
    if (companyId === undefined) return
    const loc = getCurrentLocation()
    loc.path.length = 5
    loc.path[2] = 'company'
    loc.path[3] = projectId
    loc.path[4] = special
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

  $: onCompanyRoute =
    pathSpace === 'client-home' ||
    pathSpace === 'company-issues' ||
    pathSpace === 'company-files' ||
    (pathSpace !== undefined && projects.some((project) => project._id === pathSpace))
  $: visible = !onListPage && onCompanyRoute && companyId !== undefined && organization !== undefined
</script>

{#if visible && organization}
  <div class="client-nav">
    <div class="client-nav-header">
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
    <div class="client-nav-item" class:selected={currentSpecial === 'company-issues'} on:click={() => openSpecial('company-issues')}>
      <SpecialElement label={tracker.string.Issues} icon={tracker.icon.Issues} selected={currentSpecial === 'company-issues'} />
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="client-nav-item" class:selected={currentSpecial === 'company-files'} on:click={() => openSpecial('company-files')}>
      <SpecialElement label={tracker.string.CompanyFiles} icon={drive.icon.Folder} selected={currentSpecial === 'company-files'} />
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="client-nav-item" class:selected={currentSpecial === 'client-home'} on:click={() => openSpecial('client-home')}>
      <SpecialElement label={tracker.string.CompanyProjects} icon={tracker.icon.Home} selected={currentSpecial === 'client-home'} />
    </div>

    {#if projects.length > 0}
      <div class="client-nav-projects">
        {#each projects as project (project._id)}
          <div class="client-nav-project" class:current={pathSpace === project._id}>
            <div class="client-nav-project-head">
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div
                class="client-nav-project-title overflow-label"
                class:selected={pathSpace === project._id}
                on:click={() => openProjectSpecial(project._id, 'issues')}
              >
                {projectNavTitle(project, organization)}
              </div>
              <Button
                icon={IconMoreV}
                kind={'ghost'}
                size={'small'}
                on:click={(ev) => {
                  ev.stopPropagation()
                  showMenu(ev, { object: project, baseMenuClass: tracker.class.Project })
                }}
              />
            </div>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="client-nav-child" on:click={() => openProjectSpecial(project._id, 'issues')}>
              <SpecialElement
                indent
                label={tracker.string.Issues}
                icon={tracker.icon.Issues}
                selected={pathSpace === project._id && currentSpecial === 'issues'}
              />
            </div>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="client-nav-child" on:click={() => openProjectSpecial(project._id, 'project-files')}>
              <SpecialElement
                indent
                label={tracker.string.ProjectFiles}
                icon={drive.icon.Folder}
                selected={pathSpace === project._id && currentSpecial === 'project-files'}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .client-nav {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.25rem;
    min-width: 0;
  }

  .client-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.25rem;
    min-width: 0;
  }

  .client-nav-item,
  .client-nav-child {
    cursor: pointer;
    min-width: 0;
  }

  .client-nav-projects {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 0.35rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--theme-navpanel-divider);
    min-width: 0;
  }

  .client-nav-project {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
    padding: 0.15rem 0 0.25rem;
  }

  .client-nav-project-head {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    min-width: 0;
  }

  .client-nav-project-title {
    flex: 1;
    padding: 0.35rem 0.5rem;
    min-height: 1.75rem;
    font-weight: 600;
    font-size: 0.75rem;
    line-height: 1.25;
    color: var(--global-primary-TextColor);
    border-radius: var(--small-BorderRadius);
    min-width: 0;
  }

  .client-nav-project-title.selected,
  .client-nav-project.current .client-nav-project-title {
    background-color: var(--global-ui-highlight-BackgroundColor);
  }

  .client-nav-child {
    padding-left: 0.25rem;
  }
</style>
