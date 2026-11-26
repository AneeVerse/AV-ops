<!--
// Copyright © 2024 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
-->
<script lang="ts">
  import contact, { getCurrentEmployee, type EmployeeAccess } from '@hcengineering/contact'
  import { AccountRole, getCurrentAccount, hasAccountRole, isOwnerOrMaintainer } from '@hcengineering/core'
  import { getResourcePlugin } from '@hcengineering/platform'
  import { createQuery, getClient, pluginConfigurationStore } from '@hcengineering/presentation'
  import { panelstore } from '@hcengineering/ui'
  import { Widget, WidgetPreference } from '@hcengineering/workbench'

  import { isAllowedWidget } from '../../employeeAccess'
  import workbench from '../../plugin'
  import { novinoWidget } from '../../novinoWidget'
  import { vpsWidget } from '../../vpsWidget'
  import { closeWidget, sidebarStore, SidebarVariant } from '../../sidebar'
  import SidebarExpanded from './SidebarExpanded.svelte'
  import SidebarMini from './SidebarMini.svelte'
  import { isAllowedToRole } from '../../utils'

  const account = getCurrentAccount()
  const client = getClient()

  const seenWidgets = new Set<string>()
  const allWidgets = [
    ...client
      .getModel()
      .findAllSync<Widget>(workbench.class.Widget, {})
      .filter((w) => !String(w._id).toLowerCase().includes('chunter')),
    novinoWidget,
    ...(hasAccountRole(account, AccountRole.Owner) ? [vpsWidget] : [])
  ].filter((it) => {
    if (!isAllowedToRole(it.accessLevel, account) || seenWidgets.has(it._id)) return false
    seenWidgets.add(it._id)
    return true
  })

  let employeeAccess: EmployeeAccess | undefined
  const employeeAccessQuery = createQuery()
  if (!isOwnerOrMaintainer() && client.getHierarchy().hasClass(contact.class.EmployeeAccess)) {
    employeeAccessQuery.query(contact.class.EmployeeAccess, { attachedTo: getCurrentEmployee() }, (res) => {
      employeeAccess = res[0]
    })
  }

  function isWidgetPluginEnabled (widget: Widget): boolean {
    try {
      const plugin = getResourcePlugin(widget._id)
      return $pluginConfigurationStore.configuration.get(plugin)?.enabled ?? true
    } catch {
      return true
    }
  }

  $: widgets = ($pluginConfigurationStore, allWidgets)
    .filter((widget) => isAllowedWidget(employeeAccess, widget))
    .filter((widget) => isWidgetPluginEnabled(widget))
  $: if ($sidebarStore.widget !== undefined && !widgets.some((widget) => widget._id === $sidebarStore.widget)) {
    void closeWidget($sidebarStore.widget)
  }

  const preferencesQuery = createQuery()

  let preferences: WidgetPreference[] = []
  $: preferencesQuery.query(workbench.class.WidgetPreference, {}, (res) => {
    preferences = res
  })

  $: mini = $sidebarStore.variant === SidebarVariant.MINI
  $: if ((!mini || mini) && $panelstore.panel?.refit !== undefined) $panelstore.panel.refit()
</script>

<div id="sidebar" class="antiPanel-application vertical sidebar-container" class:mini={mini || $sidebarStore.float}>
  {#if mini}
    <SidebarMini {widgets} {preferences} />
  {:else if $sidebarStore.variant === SidebarVariant.EXPANDED}
    <SidebarExpanded {widgets} {preferences} />
  {/if}
</div>

<style lang="scss">
  .sidebar-container {
    overflow: hidden;
    flex-direction: row;
    min-width: 36rem !important;
    border-radius: 0 var(--medium-BorderRadius) var(--medium-BorderRadius) 0;
    border-bottom: 1px solid transparent; // adjust the side panel body height to match the main panel

    &.mini {
      justify-content: flex-end;
      width: calc(3.5rem + 1px) !important;
      min-width: calc(3.5rem + 1px) !important;
      max-width: calc(3.5rem + 1px) !important;
    }
  }
  @media (max-width: 1024px) {
    .sidebar-container {
      width: 100%;
      border-left-color: transparent;
    }
  }
  @media (max-width: 480px) {
    :global(.mobile-theme) .sidebar-container {
      border-right: none;
      border-bottom-right-radius: 0 !important;
    }
  }
</style>
