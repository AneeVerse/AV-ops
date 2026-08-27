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
  import calendar, { CalendarEventPresenter, Event, getMeetingJoinUrl } from '@hcengineering/calendar'
  import { Doc } from '@hcengineering/core'
  import { getClient } from '@hcengineering/presentation'
  import { Component, Label, MILLISECONDS_IN_MINUTE, showPopup, tooltip } from '@hcengineering/ui'
  import view, { ObjectEditor } from '@hcengineering/view'
  import { showMenu } from '@hcengineering/view-resources'
  import { calendarByIdStore, isVisible } from '../utils'
  import EventPresenter from './EventPresenter.svelte'
  import plugin from '../plugin'

  export let event: Event
  // export let hourHeight: number
  export let size: { width: number, height: number }

  $: oneRow = size.height < 42 || event.allDay
  $: narrow = event.dueDate - event.date < MILLISECONDS_IN_MINUTE * 25
  $: empty = size.width < 44
  $: joinUrl = getMeetingJoinUrl(event.location, event.description)

  function click () {
    if (visible) {
      const editor = hierarchy.classHierarchyMixin<Doc, ObjectEditor>(event._class, view.mixin.ObjectEditor)
      if (editor?.editor !== undefined) {
        showPopup(editor.editor, { object: event })
      }
    }
  }

  function joinMeet (): void {
    if (joinUrl == null) return
    window.open(joinUrl, '_blank', 'noopener,noreferrer')
  }

  const client = getClient()
  const hierarchy = client.getHierarchy()
  $: presenter = hierarchy.classHierarchyMixin<Doc, CalendarEventPresenter>(
    event._class,
    calendar.mixin.CalendarEventPresenter
  )

  let div: HTMLDivElement

  $: visible = isVisible(event, $calendarByIdStore)

  function contextMenu (e: MouseEvent): void {
    showMenu(e, { object: event })
  }
</script>

{#if event}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    bind:this={div}
    class="event-container"
    class:oneRow
    class:empty
    use:tooltip={{ component: EventPresenter, props: { value: event, hideDetails: !visible } }}
    on:click|stopPropagation={click}
    on:contextmenu={contextMenu}
  >
    {#if !empty && presenter?.presenter}
      <Component is={presenter.presenter} props={{ event, narrow, oneRow, hideDetails: !visible }} />
      {#if joinUrl && visible && !narrow}
        <button class="join-chip" type="button" on:click|stopPropagation={joinMeet}>
          <Label label={plugin.string.Join} />
        </button>
      {/if}
    {/if}
  </div>
{/if}

<style lang="scss">
  .event-container {
    pointer-events: auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    font-size: 0.8125rem;
    background-color: var(--calendar-event-back-color);
    border: 1px solid var(--calendar-event-border-color);
    border-left: 0.25rem solid var(--calendar-event-handle-color);
    border-radius: 0.25rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem 0.25rem 1rem;
  }

  .join-chip {
    align-self: flex-start;
    margin-top: 0.2rem;
    padding: 0.1rem 0.45rem;
    border: none;
    border-radius: 0.25rem;
    background: var(--theme-button-contrast-hovered, #1a73e8);
    color: var(--theme-button-contrast-color, #fff);
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
  }
</style>
