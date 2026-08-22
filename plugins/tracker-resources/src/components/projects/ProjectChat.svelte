<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Ref } from '@hcengineering/core'
  import { ChannelEmbeddedContent } from '@hcengineering/chunter-resources'
  import { createQuery } from '@hcengineering/presentation'
  import { Project } from '@hcengineering/tracker'
  import { Label, Scroller } from '@hcengineering/ui'
  import { NavigatorModel } from '@hcengineering/workbench'
  import tracker from '../../plugin'
  import ProjectSpaceLayout from './ProjectSpaceLayout.svelte'

  export let currentSpace: Ref<Project>
  export let model: NavigatorModel | undefined = undefined

  const projectQuery = createQuery()
  let project: Project | undefined
  let container: HTMLDivElement | undefined = undefined
  let height = '0px'
  let width = '0px'
  let resizeObserver: ResizeObserver | undefined

  $: projectQuery.query(tracker.class.Project, { _id: currentSpace }, (res) => {
    ;[project] = res
  })

  function measure (): void {
    height = `${container?.clientHeight ?? 0}px`
    width = `${container?.clientWidth ?? 0}px`
  }

  $: if (container !== undefined) {
    measure()
    if (resizeObserver === undefined) {
      resizeObserver = new ResizeObserver(() => {
        measure()
      })
      resizeObserver.observe(container)
    }
  }

  onDestroy(() => {
    resizeObserver?.disconnect()
  })
</script>

<div class="project-chat-root">
  <ProjectSpaceLayout {currentSpace} {model}>
    <div class="project-chat" bind:this={container}>
      {#if project !== undefined}
        {#key project._id}
          <ChannelEmbeddedContent
            object={project}
            threadId={undefined}
            collection="comments"
            {height}
            {width}
          />
        {/key}
      {:else}
        <Scroller padding="1rem">
          <Label label={tracker.string.ProjectChat} />
        </Scroller>
      {/if}
    </div>
  </ProjectSpaceLayout>
</div>

<style lang="scss">
  .project-chat-root {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .project-chat {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 100%;
    width: 100%;
  }
</style>
