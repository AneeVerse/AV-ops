<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { RequestPriority } from '@hcengineering/tracker'
  import { Label } from '@hcengineering/ui'
  import { requestPriorityAssets } from '../../types'
  import tracker from '../../plugin'

  export let value: RequestPriority | undefined | null

  $: asset = value != null ? requestPriorityAssets[value as RequestPriority] : undefined
</script>

{#if asset !== undefined}
  <Label label={asset.label} />
{:else}
  <Label label={tracker.string.RequestPriorityNormal} />
{/if}
