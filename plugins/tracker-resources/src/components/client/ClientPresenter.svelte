<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import type { Client } from '@hcengineering/tracker'
  import { Icon, tooltip } from '@hcengineering/ui'
  import { DocNavLink, ObjectMention } from '@hcengineering/view-resources'
  import { getEmbeddedLabel } from '@hcengineering/platform'
  import { ObjectPresenterType } from '@hcengineering/view'
  import contact from '@hcengineering/contact'

  export let value: Client
  export let inline: boolean = false
  export let disabled: boolean = false
  export let accent: boolean = false
  export let noUnderline: boolean = false
  export let shouldShowAvatar: boolean = true
  export let type: ObjectPresenterType = 'link'
</script>

{#if value}
  {#if inline}
    <ObjectMention object={value} {disabled} />
  {:else if type === 'link'}
    <DocNavLink object={value} {disabled} {noUnderline} {accent}>
      <div class="flex-presenter">
        {#if shouldShowAvatar}
          <div class="icon"><Icon icon={contact.icon.Company} size={'small'} /></div>
        {/if}
        <span class="label nowrap" class:no-underline={noUnderline || disabled} class:fs-bold={accent}>
          {value.identifier}
        </span>
      </div>
    </DocNavLink>
  {:else if type === 'text'}
    <span class="overflow-label" use:tooltip={{ label: getEmbeddedLabel(value.title) }}>{value.identifier}</span>
  {/if}
{/if}
