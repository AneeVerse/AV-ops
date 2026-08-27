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
  import { Event, getMeetingJoinUrl } from '@hcengineering/calendar'
  import { DateRangeMode, Doc } from '@hcengineering/core'
  import { getClient } from '@hcengineering/presentation'
  import { Button, DatePresenter, DateTimeRangePresenter, Label, showPopup, DateRangePresenter } from '@hcengineering/ui'
  import view, { ObjectEditor } from '@hcengineering/view'
  import calendar from '../plugin'

  export let value: Event
  export let hideDetails: boolean = false
  export let inline: boolean = false

  $: joinUrl = getMeetingJoinUrl(value.location, value.description)

  function click (): void {
    if (!hideDetails) {
      const client = getClient()
      const hierarchy = client.getHierarchy()
      const editor = hierarchy.classHierarchyMixin<Doc, ObjectEditor>(value._class, view.mixin.ObjectEditor)
      if (editor?.editor !== undefined) {
        showPopup(editor.editor, { object: value })
      }
    }
  }

  function joinMeet (e: MouseEvent): void {
    e.stopPropagation()
    if (joinUrl == null) return
    window.open(joinUrl, '_blank', 'noopener,noreferrer')
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="antiSelect w-full cursor-pointer flex-center flex-between" on:click={click}>
  {#if value}
    <div class="mr-4 flex-col">
      {#if !hideDetails}
        {value.title}
      {:else}
        <Label label={calendar.string.Busy} />
      {/if}
      {#if joinUrl && !hideDetails}
        <Button
          kind="primary"
          size="small"
          label={calendar.string.Join}
          on:click={joinMeet}
        />
      {/if}
    </div>
    {#if !inline}
      {#if value.allDay}
        <DatePresenter value={value.date} />
      {:else}
        <div class="flex-row-center flex-no-shrink">
          <DateTimeRangePresenter value={value.date} /> <span class="p-1">-</span>
          <DateRangePresenter value={value.dueDate} mode={DateRangeMode.TIME} editable={false} />
        </div>
      {/if}
    {/if}
  {/if}
</div>
