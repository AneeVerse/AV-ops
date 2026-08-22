<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import drive, { type Drive, type Folder } from '@hcengineering/drive'
  import { Ref } from '@hcengineering/core'
  import { createQuery } from '@hcengineering/presentation'
  import { Project } from '@hcengineering/tracker'
  import { Switcher, TabItem } from '@hcengineering/ui'
  import { NavigatorModel } from '@hcengineering/workbench'
  import FolderBrowser from '../../../../drive-resources/src/components/FolderBrowser.svelte'
  import tracker from '../../plugin'
  import ProjectSpaceLayout from './ProjectSpaceLayout.svelte'

  export let currentSpace: Ref<Project>
  export let model: NavigatorModel | undefined = undefined

  let tab: 'production' | 'distributed' = 'production'
  const tabs: TabItem[] = [
    { id: 'production', labelIntl: tracker.string.ProductionFolder },
    { id: 'distributed', labelIntl: tracker.string.DistributedFolder }
  ]

  const projectQuery = createQuery()
  let project: Project | undefined

  $: projectQuery.query(tracker.class.Project, { _id: currentSpace }, (res) => {
    ;[project] = res
  })

  const driveQuery = createQuery()
  let companiesDrive: Drive | undefined
  $: driveQuery.query(drive.class.Drive, { name: 'Companies', archived: false }, (res) => {
    ;[companiesDrive] = res
  })

  const folderQuery = createQuery()
  let activeFolder: Folder | undefined
  $: targetFolderId =
    tab === 'production' ? project?.productionFolder : project?.distributedFolder
  $: if (targetFolderId !== undefined) {
    folderQuery.query(drive.class.Folder, { _id: targetFolderId as Ref<Folder> }, (res) => {
      ;[activeFolder] = res
    })
  } else {
    folderQuery.unsubscribe()
    activeFolder = undefined
  }

  function onTabSelect (e: CustomEvent<{ id?: string }>): void {
    const id = e.detail?.id
    if (id === 'production' || id === 'distributed') {
      tab = id
    }
  }
</script>

<div class="project-drive-files-root">
  <ProjectSpaceLayout {currentSpace} {model}>
    <div class="project-drive-files">
      <div class="project-drive-files__header">
        <Switcher
          name="project-drive-lanes"
          kind="subtle"
          items={tabs}
          selected={tab}
          on:select={onTabSelect}
        />
      </div>

      {#if companiesDrive !== undefined && activeFolder !== undefined}
        <FolderBrowser
          space={companiesDrive._id}
          parent={activeFolder._id}
          object={activeFolder}
          type="folder"
          embedded={true}
        />
      {:else}
        <p class="text-sm content-color p-4">
          Project folders are created when this project is saved with a company, or when the first file is attached in chat.
        </p>
      {/if}
    </div>
  </ProjectSpaceLayout>
</div>

<style lang="scss">
  .project-drive-files-root {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .project-drive-files {
    min-height: 20rem;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }

  .project-drive-files__header {
    padding: 0.5rem 0.75rem;
  }
</style>
