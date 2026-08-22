<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { Ref } from '@hcengineering/core'
  import { createQuery } from '@hcengineering/presentation'
  import { Project } from '@hcengineering/tracker'
  import { getCurrentLocation, location, navigate, Scroller, TabItem, TabList } from '@hcengineering/ui'
  import { NavigatorModel } from '@hcengineering/workbench'
  import { setFilters } from '@hcengineering/view-resources'
  import tracker from '../../plugin'
  import { getProjectSpacesNavModel, resolveProjectSpaceSpecials } from '../../projectSpaceNav'

  export let currentSpace: Ref<Project>
  export let model: NavigatorModel | undefined = undefined

  const projectQuery = createQuery()
  let project: Project | undefined
  let tabItems: TabItem[] = []

  $: projectQuery.query(tracker.class.Project, { _id: currentSpace }, (res) => {
    ;[project] = res
  })

  $: spacesNavModel = getProjectSpacesNavModel(model)
  $: if (spacesNavModel != null && project != null) {
    void resolveProjectSpaceSpecials(spacesNavModel, project).then((specials) => {
      tabItems = specials.map((special) => ({
        id: special.id,
        labelIntl: special.label,
        icon: special.icon
      }))
    })
  } else {
    tabItems = []
  }

  $: selectedTab = $location.path[4] ?? tabItems[0]?.id ?? ''

  function selectTab (item: TabItem): void {
    if (item.id === selectedTab) return
    setFilters([])
    const loc = getCurrentLocation()
    loc.path[3] = currentSpace
    loc.path[4] = String(item.id)
    loc.path.length = 5
    navigate(loc)
  }
</script>

{#if tabItems.length > 0}
  <div class="project-space-nav-tabs">
    <TabList
      items={tabItems}
      selected={selectedTab}
      kind="plain"
      size="medium"
      adaptiveShrink="md"
      padding="0 var(--spacing-2)"
      on:select={(e) => {
        selectTab(e.detail)
      }}
    />
  </div>
{/if}

<style lang="scss">
  .project-space-nav-tabs {
    display: flex;
    flex-shrink: 0;
    align-items: stretch;
    min-width: 0;
    width: 100%;
    border-bottom: 1px solid var(--theme-divider-color);
    background-color: var(--theme-comp-header-color);

    :global(.tablist-container.plain) {
      width: 100%;
      min-width: 0;
    }

    :global(.tablist-container .plain) {
      min-height: 2.75rem;
    }
  }
</style>
