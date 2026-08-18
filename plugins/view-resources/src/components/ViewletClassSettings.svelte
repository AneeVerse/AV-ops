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
  import { Button, ToggleWithLabel, moveItem, rowIndexFromY } from '@hcengineering/ui'
  import { Viewlet } from '@hcengineering/view'
  import { createEventDispatcher } from 'svelte'
  import view from '../plugin'
  import { AttributeConfig, Config, isAttribute } from '../viewOptions'

  export let viewlet: Viewlet
  export let items: Array<Config | AttributeConfig> = []

  const dispatch = createEventDispatcher()
  const elements: HTMLElement[] = []

  let dragIndex = -1
  let isDragging = false
  $: sortable = viewlet.configOptions?.sortable === true

  function change (item: Config, value: boolean): void {
    if (isAttribute(item)) {
      item.enabled = value
      dispatch('save', items)
    }
  }

  function canSort (item: Config | AttributeConfig, index: number): boolean {
    return sortable && isAttribute(item) && item.enabled
  }

  function onPointerMove (ev: PointerEvent): void {
    if (dragIndex < 0) return
    const over = rowIndexFromY(ev.clientY, elements)
    if (over === dragIndex || over < 0 || items[over] === undefined || !isAttribute(items[over])) return
    items = moveItem(items, dragIndex, over)
    dragIndex = over
  }

  function onPointerUp (): void {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    const moved = isDragging && dragIndex >= 0
    dragIndex = -1
    isDragging = false
    if (moved) {
      dispatch('save', items)
    }
  }

  function startDrag (ev: PointerEvent, index: number): void {
    if (!canSort(items[index], index)) return
    const target = ev.target as HTMLElement | null
    if (target?.closest('.toggle') != null) return
    ev.preventDefault()
    dragIndex = index
    isDragging = true
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }
</script>

<div class="flex-row-reverse mb-2 mr-2">
  <Button
    on:click={() => dispatch('restoreDefaults')}
    label={view.string.RestoreDefaults}
    size={'x-small'}
    kind={'link'}
    noFocus
  />
</div>
<div class="column-customize" class:is-dragging={isDragging}>
  {#each items as item, i}
    {#if isAttribute(item)}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="menu-item flex-row-center"
        class:dragging={isDragging && dragIndex === i}
        class:grab={canSort(item, i)}
        bind:this={elements[i]}
        on:pointerdown={(ev) => {
          startDrag(ev, i)
        }}
      >
        <ToggleWithLabel
          on={item.enabled}
          label={item.label}
          on:change={(e) => {
            change(item, e.detail)
          }}
        />
      </div>
    {:else}
      <div class="antiDivider" />
    {/if}
  {/each}
</div>

<style lang="scss">
  .column-customize {
    &.is-dragging {
      user-select: none;
    }
  }

  .grab {
    cursor: grab;
  }

  .dragging {
    opacity: 0.55;
    background-color: var(--theme-button-hovered);
    cursor: grabbing;
  }
</style>
