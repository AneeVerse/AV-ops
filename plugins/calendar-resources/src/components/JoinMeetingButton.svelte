<!--
// Copyright © 2026 AneeVerse.
-->
<script lang="ts">
  import { Event, getMeetingJoinUrl, isGoogleMeetPlaceholder } from '@hcengineering/calendar'
  import { Button, Label } from '@hcengineering/ui'
  import calendar from '../plugin'

  export let event: Event
  export let location: string | undefined = undefined
  export let focusIndex: number = -1

  $: joinUrl = getMeetingJoinUrl(location ?? event.location, event.description)
  $: pendingMeet = isGoogleMeetPlaceholder(location ?? event.location)
  $: isGoogleMeet = joinUrl != null && /meet\.google\.com/i.test(joinUrl)

  function join (): void {
    if (joinUrl == null) return
    window.open(joinUrl, '_blank', 'noopener,noreferrer')
  }
</script>

{#if joinUrl}
  <div class="join-row">
    <Button
      kind="primary"
      size="medium"
      {focusIndex}
      label={isGoogleMeet ? calendar.string.JoinGoogleMeet : calendar.string.JoinMeeting}
      on:click={join}
    />
  </div>
{:else if pendingMeet}
  <div class="join-row pending">
    <span class="text-sm content-dark-color"><Label label={calendar.string.CreatingGoogleMeet} /></span>
  </div>
{/if}

<style lang="scss">
  .join-row {
    padding: 0.5rem 0 0.25rem;

    &.pending {
      padding: 0.25rem 0;
    }
  }
</style>
