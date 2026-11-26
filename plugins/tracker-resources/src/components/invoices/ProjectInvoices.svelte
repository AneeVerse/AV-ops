<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { type Ref } from '@hcengineering/core'
  import { type Project } from '@hcengineering/tracker'
  import { type NavigatorModel } from '@hcengineering/workbench'
  import trackerRes from '../../plugin'
  import ProjectSpaceLayout from '../projects/ProjectSpaceLayout.svelte'
  import InvoicesBrowser from './InvoicesBrowser.svelte'

  export let currentSpace: Ref<Project>
  export let model: NavigatorModel | undefined = undefined
</script>

<ProjectSpaceLayout {currentSpace} {model}>
  <InvoicesBrowser {currentSpace} query={{ $or: [{ project: currentSpace }, { space: currentSpace }] }} title={trackerRes.string.Invoices} />
</ProjectSpaceLayout>
