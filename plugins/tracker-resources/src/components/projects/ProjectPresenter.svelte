<!--
// Copyright © 2023 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { getCurrentAccount, Ref } from '@hcengineering/core'
  import presentation, { createQuery, IconWithEmoji, isAdminUser } from '@hcengineering/presentation'
  import { Project } from '@hcengineering/tracker'
  import { Button, Icon, IconMoreV, Label, getPlatformColorDef, getPlatformColorForTextDef, themeStore } from '@hcengineering/ui'
  import view from '@hcengineering/view'
  import { NavLink, showMenu } from '@hcengineering/view-resources'
  import tracker from '../../plugin'

  export let value: Project | Ref<Project> | undefined
  export let inline: boolean = false
  export let accent: boolean = false
  export let colorInherit: boolean = false
  export let openIssues: boolean
  export let showActions: boolean = false

  const projectQuery = createQuery()
  let projectObj: Project | undefined
  $: if (typeof value === 'string' && value !== undefined) {
    projectQuery.query<Project>(
      tracker.class.Project,
      { _id: value },
      (result) => {
        ;[projectObj] = result
      },
      { limit: 1 }
    )
  } else if (value !== undefined && typeof value === 'object') {
    projectObj = value
  } else {
    projectObj = undefined
  }

  function openActions (ev: MouseEvent): void {
    ev.stopPropagation()
    if (projectObj === undefined) return
    showMenu(ev, { object: projectObj, baseMenuClass: tracker.class.Project })
  }
</script>

{#if projectObj}
  <div class="flex-presenter cursor-default" class:inline-presenter={inline} class:colorInherit>
    <div class="icon" class:emoji={projectObj.icon === view.ids.IconWithEmoji}>
      <Icon
        icon={projectObj.icon === view.ids.IconWithEmoji ? IconWithEmoji : (projectObj.icon ?? tracker.icon.Home)}
        iconProps={projectObj.icon === view.ids.IconWithEmoji
          ? { icon: projectObj.color }
          : {
              fill:
                projectObj.color !== undefined && typeof projectObj.color !== 'string'
                  ? getPlatformColorDef(projectObj.color, $themeStore.dark).icon
                  : getPlatformColorForTextDef(projectObj.name, $themeStore.dark).icon
            }}
        size="small"
      />
    </div>
    <span class="label no-underline nowrap" class:fs-bold={accent}>
      {#if openIssues && (isAdminUser() || projectObj.members.includes(getCurrentAccount().uuid))}
        <NavLink app={'tracker'} space={projectObj._id} special={'issues'} noUnderline={false}>
          {projectObj.name}
        </NavLink>
      {:else}
        {projectObj.name}
      {/if}
      {#if projectObj.archived}
        <Label label={presentation.string.Archived} />
      {/if}
    </span>
    {#if showActions}
      <Button icon={IconMoreV} kind={'ghost'} size={'small'} on:click={openActions} />
    {/if}
  </div>
{/if}
