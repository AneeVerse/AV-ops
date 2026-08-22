<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { Ref } from '@hcengineering/core'
  import { Project } from '@hcengineering/tracker'
  import { NavigatorModel } from '@hcengineering/workbench'
  import ProjectSpaceNavTabs from './ProjectSpaceNavTabs.svelte'

  export let currentSpace: Ref<Project>
  export let model: NavigatorModel | undefined = undefined
</script>

<div class="project-space-layout">
  <ProjectSpaceNavTabs {currentSpace} {model} />
  <div class="project-space-layout__content">
    <slot />
  </div>
</div>

<style lang="scss">
  .project-space-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .project-space-layout__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
</style>
