<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { AccountRole } from '@hcengineering/core'
  import login from '@hcengineering/login'
  import setting from '@hcengineering/setting'
  import {
    DropdownIntlItem,
    DropdownLabelsIntl,
    EditBox,
    Label
  } from '@hcengineering/ui'
  import contact from '../plugin'
  import PasswordEditBox from './PasswordEditBox.svelte'

  export let email: string = ''
  export let password: string = ''
  export let phone: string = ''
  export let showPhone: boolean = true
  export let showRole: boolean = false
  export let workspaceRole: AccountRole = AccountRole.User
  export let focusIndexStart: number = 3
  export let onEmailBlur: (() => void) | undefined = undefined
  export let onPhoneBlur: (() => void) | undefined = undefined

  const roleItems: DropdownIntlItem[] = [
    { id: AccountRole.Guest, label: setting.string.Guest },
    { id: AccountRole.User, label: setting.string.User },
    { id: AccountRole.Maintainer, label: setting.string.Maintainer }
  ]

  function onRoleSelected (e: CustomEvent<AccountRole | string | number>): void {
    workspaceRole = e.detail as AccountRole
  }
</script>

<div class="mt-1">
  <EditBox
    placeholder={contact.string.Email}
    bind:value={email}
    kind={'small-style'}
    focusIndex={focusIndexStart}
    on:blur={() => onEmailBlur?.()}
  />
</div>
{#if showPhone}
  <div class="mt-1">
    <EditBox
      placeholder={contact.string.PhonePlaceholder}
      bind:value={phone}
      kind={'small-style'}
      focusIndex={focusIndexStart + 1}
      on:blur={() => onPhoneBlur?.()}
    />
  </div>
{/if}
<div class="mt-1">
  <PasswordEditBox placeholder={login.string.Password} bind:value={password} />
</div>
{#if showRole}
  <div class="mt-3 flex-row-center">
    <span class="mr-2 whitespace-nowrap">
      <Label label={contact.string.WorkspaceRole} />
    </span>
    <DropdownLabelsIntl
      label={contact.string.WorkspaceRole}
      kind={'regular'}
      size={'medium'}
      items={roleItems}
      selected={workspaceRole}
      on:selected={onRoleSelected}
    />
  </div>
{/if}
