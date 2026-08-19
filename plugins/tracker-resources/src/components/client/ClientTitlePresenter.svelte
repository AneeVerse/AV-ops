<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { WithLookup } from '@hcengineering/core'
  import { Client } from '@hcengineering/tracker'

  export let value: WithLookup<Client>
  export let shouldUseMargin: boolean = false
  export let kind: 'list' | undefined = undefined
</script>

{#if value}
  <span
    class="name overflow-label select-text"
    class:with-margin={shouldUseMargin}
    class:list={kind === 'list'}
  >
    {value.title}
  </span>
{/if}

<style lang="scss">
  .name {
    flex-shrink: 1;
    min-width: 1rem;

    &.list {
      color: var(--theme-caption-color);
    }
    &:hover {
      text-decoration: underline;
    }
    &:active {
      color: var(--theme-content-color);
    }
  }

  .with-margin {
    margin-left: 0.5rem;
  }
</style>
