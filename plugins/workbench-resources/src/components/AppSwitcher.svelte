<!--
// Copyright © 2022 Hardcore Engineering Inc.
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
  import core, { AccountRole, getCurrentAccount, type Ref } from '@hcengineering/core'
  import type { Application } from '@hcengineering/workbench'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import workbench from '@hcengineering/workbench'
  import {
    applicationOrderStore,
    hideApplication,
    hydrateApplicationOrderStore,
    isAllowedToRole,
    saveApplicationOrder,
    showApplication,
    sortApplicationsByOrder
  } from '../utils'
  import { Loading, IconCheck, Label, Icon, PointerSortHandle, moveItem, rowIndexFromY } from '@hcengineering/ui'
  import { getMetadata } from '@hcengineering/platform'
  import { onDestroy } from 'svelte'

  export let apps: Application[] = []

  let activeElement: HTMLElement
  const btns: HTMLElement[] = []

  function focusTarget (target: HTMLElement): void {
    activeElement = target
  }

  const keyDown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Tab') {
      ev.preventDefault()
      ev.stopPropagation()
    }
    const n = btns.indexOf(activeElement) ?? 0
    if (ev.key === 'ArrowDown') {
      if (n < btns.length - 1) {
        activeElement = btns[n + 1]
      }
      ev.preventDefault()
      ev.stopPropagation()
    }
    if (ev.key === 'ArrowUp') {
      if (n > 0) {
        activeElement = btns[n - 1]
      }
      ev.preventDefault()
      ev.stopPropagation()
    }
  }

  hydrateApplicationOrderStore()

  let loaded: boolean = false
  let hiddenAppsIds: Array<Ref<Application>> = []
  let applicationOrder: Array<Ref<Application>> = $applicationOrderStore

  const unsubOrder = applicationOrderStore.subscribe((value) => {
    applicationOrder = value
  })
  onDestroy(unsubOrder)

  const hiddenAppsIdsQuery = createQuery()
  hiddenAppsIdsQuery.query(
    workbench.class.HiddenApplication,
    {
      space: core.space.Workspace
    },
    (res) => {
      hiddenAppsIds = res.map((r) => r.attachedTo)
      loaded = true
    }
  )

  const client = getClient()
  if (client.getHierarchy().hasClass(workbench.class.ApplicationOrder)) {
    const applicationOrderQuery = createQuery()
    applicationOrderQuery.query(workbench.class.ApplicationOrder, { space: core.space.Workspace }, (res) => {
      const stored = res[0]?.applications ?? []
      if (stored.length > 0) {
        applicationOrderStore.set(stored)
      }
    })
  }

  const me = getCurrentAccount()

  function isExcludedApp (alias: string): boolean {
    const me = getCurrentAccount()

    if (me.role === AccountRole.ReadOnlyGuest || me.role === AccountRole.Guest) {
      return (getMetadata(workbench.metadata.ExcludedApplicationsForAnonymous) ?? []).includes(alias)
    } else {
      return false
    }
  }

  $: baseCustomizableApps = sortApplicationsByOrder(
    apps.filter(
      (it) =>
        isAllowedToRole(it.accessLevel, me) &&
        it.position !== 'top' &&
        it.position !== 'bottom' &&
        !isExcludedApp(it.alias)
    ),
    applicationOrder
  )

  let customizableApps: Application[] = []
  let isDragging = false
  let dragIndex = -1
  let didDrag = false

  $: if (!isDragging) {
    customizableApps = baseCustomizableApps
  }

  function onPointerMove (ev: PointerEvent): void {
    if (dragIndex < 0) return
    const over = rowIndexFromY(ev.clientY, btns)
    if (over === dragIndex || over < 0) return
    didDrag = true
    customizableApps = moveItem(customizableApps, dragIndex, over)
    dragIndex = over
  }

  async function onPointerUp (): Promise<void> {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    const moved = didDrag
    dragIndex = -1
    isDragging = false
    if (moved) {
      await saveApplicationOrder(customizableApps.map((app) => app._id))
    }
    window.setTimeout(() => {
      didDrag = false
    }, 50)
  }

  function startDrag (ev: PointerEvent, index: number): void {
    ev.preventDefault()
    ev.stopPropagation()
    dragIndex = index
    didDrag = false
    isDragging = true
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function toggleApp (app: Application): void {
    if (didDrag) {
      didDrag = false
      return
    }
    if (hiddenAppsIds.includes(app._id)) showApplication(app)
    else hideApplication(app)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="antiPopup min-w-60" class:is-dragging={isDragging} on:keydown={keyDown}>
  <div class="ap-space x2" />
  <div class="ap-scroll">
    <div class="ap-box">
      {#if loaded}
        {#each customizableApps as app, i (app._id)}
          <button
            bind:this={btns[i]}
            class="ap-menuItem withIcon flex-row-center flex-grow"
            class:hover={btns[i] === activeElement}
            class:dragging={isDragging && dragIndex === i}
            data-id={`app-switcher-row-${app.alias}`}
            on:click={() => {
              toggleApp(app)
            }}
            on:mousemove={() => {
              focusTarget(btns[i])
            }}
          >
            <PointerSortHandle
              on:pointerdown={(ev) => {
                startDrag(ev, i)
              }}
            />
            <div class="icon mr-2"><Icon icon={app.icon} size={'small'} /></div>
            <span class="label overflow-label flex-grow"><Label label={app.label} /></span>
            <div class="ap-check">
              {#if !hiddenAppsIds.includes(app._id)}
                <IconCheck size={'small'} />
              {/if}
            </div>
          </button>
        {/each}
      {:else}
        <div class="ap-menuItem empty">
          <Loading />
        </div>
      {/if}
    </div>
  </div>
  <div class="ap-space x2" />
</div>

<style lang="scss">
  .is-dragging {
    user-select: none;
  }

  .dragging {
    opacity: 0.55;
    background-color: var(--theme-button-hovered);
  }
</style>
