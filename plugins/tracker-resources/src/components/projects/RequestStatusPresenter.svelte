<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { RequestStatus } from '@hcengineering/tracker'
  import { Label } from '@hcengineering/ui'
  import { requestStatusAssets } from '../../types'
  import tracker from '../../plugin'

  export let value: RequestStatus | undefined | null

  $: asset = value != null ? requestStatusAssets[value as RequestStatus] : undefined
</script>

{#if asset !== undefined}
  <Label label={asset.label} />
{:else}
  <Label label={tracker.string.RequestStatusNew} />
{/if}
