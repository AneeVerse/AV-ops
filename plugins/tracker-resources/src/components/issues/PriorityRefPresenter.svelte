<!--
// Copyright © 2023 Hardcore Engineering Inc.
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
  import { IssuePriority } from '@hcengineering/tracker'
  import { Icon, Label, getPlatformColorDef, themeStore } from '@hcengineering/ui'
  import { createEventDispatcher, onMount } from 'svelte'
  import { IssuePriorityColor, issuePriorities } from '../../utils'
  import PriorityInlineEditor from './PriorityInlineEditor.svelte'

  export let value: IssuePriority
  export let size: 'small' | 'medium' = 'small'
  export let colorInherit: boolean = false
  export let accent: boolean = false
  export let inline: boolean = false
  export let shouldShowLabel: boolean = true
  export let shouldShowAvatar: boolean = true
  export let onChange: ((value: IssuePriority) => void) | undefined = undefined
  export let disabled: boolean = false

  $: icon = issuePriorities[value]?.icon
  $: label = issuePriorities[value]?.label

  const dispatch = createEventDispatcher()
  $: accentColor = getPlatformColorDef(IssuePriorityColor[value], $themeStore.dark)

  $: dispatch('accent-color', accentColor)
  onMount(() => {
    dispatch('accent-color', accentColor)
  })
</script>

{#if onChange !== undefined}
  <PriorityInlineEditor
    kind="link"
    size="small"
    {shouldShowLabel}
    isEditable={!disabled}
    value={value ?? IssuePriority.NoPriority}
    on:change={(e) => {
      onChange?.(e.detail)
    }}
    on:accent-color
  />
{:else}
  <div class="flex-presenter">
    {#if !inline && icon && shouldShowAvatar}
      <Icon {icon} {size} fill={'var(--theme-caption-color)'} />
    {/if}
    {#if shouldShowLabel}
      <span
        class="overflow-label"
        class:ml-2={!inline && icon && shouldShowAvatar}
        style:color={colorInherit ? 'inherit' : 'var(--theme-content-color)'}
        class:fs-bold={accent}
      >
        <Label {label} />
      </span>
    {/if}
  </div>
{/if}
