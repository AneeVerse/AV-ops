<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import type { IntlString } from '@hcengineering/platform'
  import { translateCB } from '@hcengineering/platform'
  import { themeStore } from '@hcengineering/theme'
  import { Button } from '@hcengineering/ui'
  import contact from '../plugin'

  export let value: string = ''
  export let placeholder: IntlString
  export let disabled: boolean = false
  export let maxWidth: string = '100%'

  let showPassword = false
  let phTranslate = ''

  $: translateCB(placeholder, {}, $themeStore.language, (res) => {
    phTranslate = res
  })

  function toggleVisibility (): void {
    showPassword = !showPassword
  }
</script>

<div class="password-editbox flex-row-center antiEditBox small-style">
  {#if showPassword}
    <input
      class="antiEditBoxInput flex-grow"
      type="text"
      autocomplete="new-password"
      {disabled}
      style:width={maxWidth}
      bind:value
      placeholder={phTranslate}
      on:blur
      on:input
      on:change
    />
  {:else}
    <input
      class="antiEditBoxInput flex-grow"
      type="password"
      autocomplete="new-password"
      {disabled}
      style:width={maxWidth}
      bind:value
      placeholder={phTranslate}
      on:blur
      on:input
      on:change
    />
  {/if}
  <Button
    kind={'ghost'}
    size={'small'}
    label={showPassword ? contact.string.HidePassword : contact.string.ShowPassword}
    on:click={toggleVisibility}
  />
</div>

<style lang="scss">
  .password-editbox {
    width: 100%;
    gap: 0.25rem;

    .antiEditBoxInput {
      min-width: 0;
    }
  }
</style>
