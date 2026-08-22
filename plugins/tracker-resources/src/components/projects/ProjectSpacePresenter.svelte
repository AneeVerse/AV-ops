<!--
// Copyright © 2022 Hardcore Engineering Inc.
-->
<script lang="ts">
  import contact, { type Organization } from '@hcengineering/contact'
  import { Ref, Space } from '@hcengineering/core'
  import { createQuery, IconWithEmoji } from '@hcengineering/presentation'
  import { Project } from '@hcengineering/tracker'
  import { getPlatformColorDef, getPlatformColorForTextDef, themeStore, type Action } from '@hcengineering/ui'
  import view from '@hcengineering/view'
  import { NavLink, TreeItem } from '@hcengineering/view-resources'
  import { SpacesNavModel } from '@hcengineering/workbench'
  import { projectNavTitle } from '../../projectTitle'

  export let space: Project
  export let model: SpacesNavModel
  export let currentSpace: Ref<Space> | undefined
  export let currentSpecial: string | undefined
  export let getActions: (space: Project) => Promise<Action[]> = async () => []
  export let deselect: boolean = false
  export let forciblyСollapsed: boolean = false

  let company: Organization | undefined
  const orgQuery = createQuery()

  $: if (space?.company !== undefined) {
    orgQuery.query(
      contact.class.Organization,
      { _id: space.company },
      (res) => {
        company = res[0]
      },
      { limit: 1 }
    )
  } else {
    orgQuery.unsubscribe()
    company = undefined
  }

  $: navTitle = projectNavTitle(space, company)
  $: defaultSpecial = currentSpace === space._id && currentSpecial != null ? currentSpecial : 'issues'
</script>

<NavLink space={space._id} special={defaultSpecial}>
  <TreeItem
    _id={space._id}
    icon={space?.icon === view.ids.IconWithEmoji ? IconWithEmoji : (space?.icon ?? model?.icon)}
    iconProps={space?.icon === view.ids.IconWithEmoji
      ? { icon: space.color }
      : {
          fill:
            space.color !== undefined && typeof space.color !== 'string'
              ? getPlatformColorDef(space.color, $themeStore.dark).icon
              : getPlatformColorForTextDef(space.name, $themeStore.dark).icon
        }}
    title={navTitle}
    selected={deselect ? false : space._id === currentSpace}
    actions={() => getActions(space)}
    bold={false}
    {forciblyСollapsed}
    indent
  />
</NavLink>
