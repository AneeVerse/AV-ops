<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { Organization } from '@hcengineering/contact'
  import drive, { type Drive, type Folder } from '@hcengineering/drive'
  import { Ref } from '@hcengineering/core'
  import { createQuery } from '@hcengineering/presentation'
  import { Label } from '@hcengineering/ui'
  import FolderBrowser from '../../../../drive-resources/src/components/FolderBrowser.svelte'
  import tracker from '../../plugin'

  export let object: Organization
  export let readonly: boolean = false

  const driveQuery = createQuery()
  let companiesDrive: Drive | undefined
  let folder: Folder | undefined

  $: driveQuery.query(
    drive.class.Drive,
    { name: 'Companies', archived: false },
    (res) => {
      ;[companiesDrive] = res
    }
  )

  const folderQuery = createQuery()
  $: if (object.driveFolder !== undefined) {
    folderQuery.query(drive.class.Folder, { _id: object.driveFolder as Ref<Folder> }, (res) => {
      ;[folder] = res
    })
  } else {
    folderQuery.unsubscribe()
    folder = undefined
  }
</script>

<div class="company-drive-files">
  {#if companiesDrive === undefined}
    <Label label={tracker.string.ProjectFiles} />
    <p class="text-sm content-color">Companies Drive is not ready yet. Run workspace upgrade or attach a file to a project.</p>
  {:else if folder === undefined}
    <p class="text-sm content-color">No folder linked for this company yet. Create a project or upload a file to provision folders.</p>
  {:else}
    <FolderBrowser
      space={companiesDrive._id}
      parent={folder._id}
      object={folder}
      type="folder"
      embedded={true}
      {readonly}
    />
  {/if}
</div>

<style lang="scss">
  .company-drive-files {
    min-height: 20rem;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }
</style>
