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
  import {
    AccessLevel,
    Calendar,
    Event,
    ReccuringEvent,
    RecurringRule,
    Visibility,
    generateEventId,
    GOOGLE_MEET_PLACEHOLDER,
    getMeetingJoinUrl,
    getPrimaryCalendar,
    isAccountCalendar,
    isGoogleMeetPlaceholder
  } from '@hcengineering/calendar'
  import { getCurrentEmployee, Person } from '@hcengineering/contact'
  import core, { Class, Doc, Markup, Ref, Space, generateId, getCurrentAccount } from '@hcengineering/core'
  import presentation, {
    createQuery,
    DocCreateExtComponent,
    DocCreateExtensionManager,
    getClient
  } from '@hcengineering/presentation'
  import { EmptyMarkup } from '@hcengineering/text'
  import { StyledTextBox } from '@hcengineering/text-editor-resources'
  import {
    Button,
    EditBox,
    FocusHandler,
    Icon,
    IconClose,
    Label,
    createFocusManager,
    getUserTimezone,
    showPopup,
    Scroller
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import { get } from 'svelte/store'
  import calendar from '../plugin'
  import { saveUTC } from '../utils'
  import CalendarSelector from './CalendarSelector.svelte'
  import EventParticipants from './EventParticipants.svelte'
  import EventReminders from './EventReminders.svelte'
  import EventTimeEditor from './EventTimeEditor.svelte'
  import EventTimeExtraButton from './EventTimeExtraButton.svelte'
  import LocationEditor from './LocationEditor.svelte'
  import ReccurancePopup from './ReccurancePopup.svelte'
  import VisibilityEditor from './VisibilityEditor.svelte'

  const acc = getCurrentAccount()
  const currentUser = getCurrentEmployee()
  const myPrimaryId = acc.primarySocialId

  export let attachedTo: Ref<Doc> = calendar.ids.NoAttached
  export let attachedToClass: Ref<Class<Doc>> = calendar.class.Event
  export let title: string = ''
  export let date: Date | undefined = undefined
  export let withTime = false
  export let participants: Ref<Person>[] = [currentUser]

  const now = new Date()
  const defaultDuration = 60 * 60 * 1000
  const allDayDuration = 24 * 60 * 60 * 1000 - 1

  const docCreateManager = DocCreateExtensionManager.create(calendar.class.Event)

  let startDate =
    date === undefined ? now.getTime() : withTime ? date.getTime() : date.setHours(now.getHours(), now.getMinutes())
  const duration = defaultDuration
  let dueDate = startDate + duration
  let allDay = false
  let location = ''
  let timeZone: string = getUserTimezone()

  let reminders = [30 * 60 * 1000]

  let description: Markup = EmptyMarkup
  $: joinUrl = getMeetingJoinUrl(location, description)
  let visibility: Visibility = 'private'
  let _calendar: Ref<Calendar> | undefined = undefined

  const spaceQ = createQuery()
  let space: Space | undefined = undefined
  spaceQ.query(core.class.Space, { _id: calendar.space.Calendar }, (res) => {
    space = res[0]
  })

  let rules: RecurringRule[] = []

  let externalParticipants: string[] = []

  const dispatch = createEventDispatcher()
  const client = getClient()

  export function canClose (): boolean {
    return title !== undefined && title.trim().length === 0 && participants.length === 0
  }

  function meetingRequested (): boolean {
    if (docCreateManager._extensions.length === 0) return true
    for (const e of docCreateManager._extensions) {
      const s = get(docCreateManager.getState(e._id))
      if (s?.isMeeting === true) return true
    }
    return false
  }

  function addGoogleMeet (): void {
    location = GOOGLE_MEET_PLACEHOLDER
  }

  async function saveEvent () {
    let date: number | undefined
    if (startDate != null) date = startDate
    if (date === undefined) return
    const acc = getCurrentAccount()
    if (_calendar === undefined) {
      const all = await client.findAll(calendar.class.Calendar, { hidden: false })
      const mine = all.filter(
        (c) =>
          isAccountCalendar(c, acc) &&
          (c.access === AccessLevel.Owner || c.access === AccessLevel.Writer || c._class !== calendar.class.ExternalCalendar)
      )
      _calendar = getPrimaryCalendar(mine, undefined, acc.uuid)
    }
    const wantMeet = !allDay && (meetingRequested() || isGoogleMeetPlaceholder(location))
    if (wantMeet) {
      const googleCals = await client.findAll(calendar.class.ExternalCalendar, { hidden: false })
      const mineGoogle = googleCals.filter((c) => isAccountCalendar(c, acc))
      const primaryGoogle = mineGoogle.find((c) => c.default) ?? mineGoogle[0]
      if (primaryGoogle !== undefined) {
        _calendar = primaryGoogle._id
      }
      if (location == null || location.trim() === '') {
        location = GOOGLE_MEET_PLACEHOLDER
      }
    }
    if (_calendar === undefined) return
    if (title.trim() === '') title = '(No title)'
    if (!allDay && (location == null || location.trim() === '') && meetingRequested()) {
      location = GOOGLE_MEET_PLACEHOLDER
    }
    const user = myPrimaryId
    const _id = generateId<Event>()
    if (rules.length > 0) {
      await client.addCollection(
        calendar.class.ReccuringEvent,
        calendar.space.Calendar,
        attachedTo,
        attachedToClass,
        'events',
        {
          calendar: _calendar,
          eventId: generateEventId(),
          date: allDay ? saveUTC(date) : date,
          dueDate: allDay ? saveUTC(dueDate) : dueDate,
          externalParticipants,
          rdate: [],
          exdate: [],
          rules,
          reminders,
          description,
          participants,
          visibility,
          title,
          location,
          blockTime: !allDay,
          allDay,
          access: AccessLevel.Owner,
          originalStartTime: allDay ? saveUTC(date) : date,
          timeZone,
          user
        },
        _id as Ref<ReccuringEvent>
      )
    } else {
      await client.addCollection(
        calendar.class.Event,
        calendar.space.Calendar,
        attachedTo,
        attachedToClass,
        'events',
        {
          calendar: _calendar,
          eventId: generateEventId(),
          date: allDay ? saveUTC(date) : date,
          dueDate: allDay ? saveUTC(dueDate) : dueDate,
          externalParticipants,
          description,
          visibility,
          participants,
          reminders,
          title,
          location,
          blockTime: !allDay,
          allDay,
          timeZone,
          access: AccessLevel.Owner,
          user
        },
        _id
      )
    }
    let calSpace = space
    if (calSpace === undefined) {
      calSpace = await client.findOne(core.class.Space, { _id: calendar.space.Calendar })
    }
    if (calSpace !== undefined) {
      await docCreateManager.commit(client, _id, calSpace, {}, 'post')
    }
    dispatch('close')
  }

  async function allDayChangeHandler () {
    if (allDay) {
      startDate = new Date(startDate).setHours(0, 0, 0, 0)
      if (dueDate - startDate < allDayDuration) dueDate = allDayDuration + startDate
      else dueDate = new Date(dueDate).setHours(23, 59, 59, 999)
    } else {
      dueDate = startDate + defaultDuration
    }
  }

  function setRecurrance () {
    showPopup(ReccurancePopup, { rules, startDate }, undefined, (res) => {
      if (res) {
        rules = res
      }
    })
  }

  const manager = createFocusManager()
</script>

<FocusHandler {manager} />

<div class="eventPopup-container">
  <div class="header flex-between">
    <EditBox
      bind:value={title}
      placeholder={calendar.string.EventTitlePlaceholder}
      kind={'ghost-large'}
      fullSize
      focusable
      autoFocus
      focusIndex={10001}
    />
    <div class="flex-row-center gap-1 flex-no-shrink ml-3">
      <Button
        id="card-close"
        focusIndex={10003}
        icon={IconClose}
        kind={'ghost'}
        size={'small'}
        on:click={() => {
          dispatch('close')
        }}
      />
    </div>
  </div>
  <div class="block first join-actions">
    {#if joinUrl}
      <Button
        kind="primary"
        size="medium"
        label={calendar.string.JoinGoogleMeet}
        focusIndex={10012}
        on:click={() => {
          window.open(joinUrl, '_blank', 'noopener,noreferrer')
        }}
      />
    {:else if isGoogleMeetPlaceholder(location)}
      <span class="text-sm content-dark-color"><Label label={calendar.string.CreatingGoogleMeet} /></span>
    {:else if !allDay}
      <Button
        kind="ghost"
        size="medium"
        label={calendar.string.AddGoogleMeet}
        focusIndex={10013}
        on:click={addGoogleMeet}
      />
    {/if}
  </div>
  <Scroller thinScrollBars>
    <div class="block first flex-no-shrink">
      <EventTimeEditor {allDay} bind:startDate bind:dueDate {timeZone} focusIndex={10004} />
      <EventTimeExtraButton
        bind:allDay
        bind:timeZone
        bind:rules
        on:repeat={setRecurrance}
        on:allday={allDayChangeHandler}
      />
    </div>
    <div class="block rightCropPadding">
      <LocationEditor focusIndex={10010} bind:value={location} />
      <EventParticipants focusIndex={10011} bind:participants bind:externalParticipants />
    </div>
    <div class="block">
      <DocCreateExtComponent manager={docCreateManager} kind={'body'} />
    </div>
    <div class="block description">
      <div class="top-icon">
        <Icon icon={calendar.icon.Description} size={'small'} />
      </div>
      <StyledTextBox
        alwaysEdit={true}
        isScrollable={false}
        kind={'indented'}
        showButtons={false}
        focusIndex={10100}
        placeholder={calendar.string.Description}
        bind:content={description}
      />
    </div>
    <div class="block rightCropPadding">
      <CalendarSelector bind:value={_calendar} focusIndex={10101} />
      <div class="flex-row-center flex-gap-1">
        <Icon icon={calendar.icon.Hidden} size={'small'} />
        <VisibilityEditor bind:value={visibility} kind="inline" size="medium" focusIndex={10102} withoutIcon />
      </div>
      <EventReminders bind:reminders focusIndex={10103} />
    </div>
  </Scroller>
  <div class="antiDivider noMargin" />
  <div class="flex-between p-5 flex-no-shrink">
    <div />
    <Button
      kind="primary"
      label={presentation.string.Create}
      focusIndex={10104}
      on:click={saveEvent}
    />
  </div>
</div>

<style lang="scss">
  .eventPopup-container {
    display: flex;
    flex-direction: column;
    max-width: 25rem;
    min-width: 25rem;
    min-height: 0;
    background: var(--theme-popup-color);
    border-radius: 1rem;
    box-shadow: var(--theme-popup-shadow);

    .header {
      flex-shrink: 0;
      padding: 0.75rem 0.75rem 0.5rem;
    }

    .block {
      display: flex;
      flex-shrink: 0;
      min-width: 0;
      min-height: 0;

      &:not(:last-child) {
        border-bottom: 1px solid var(--theme-divider-color);
      }
      &:not(.description) {
        flex-direction: column;
      }
      &.first {
        padding-top: 0;
      }
      &:not(.rightCropPadding) {
        padding: 0.75rem 1rem;
      }
      &.rightCropPadding {
        padding: 0.75rem 1rem 0.75rem 1.25rem;
      }
      &.description {
        padding: 0 1.25rem;
      }
      &.join-actions {
        padding: 0 1.25rem 0.5rem;
      }
    }
    .top-icon {
      flex-shrink: 0;
      margin-top: 1.375rem;
      margin-right: 0.125rem;
    }
  }
</style>
