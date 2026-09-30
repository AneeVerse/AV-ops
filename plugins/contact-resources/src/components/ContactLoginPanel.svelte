<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { Person } from '@hcengineering/contact'
  import { AccountRole, getCurrentAccount, hasAccountRole, SocialIdType } from '@hcengineering/core'
  import login from '@hcengineering/login'
  import { setPlatformStatus, unknownError } from '@hcengineering/platform'
  import { createQuery, MessageBox } from '@hcengineering/presentation'
  import { Button, Label, showPopup } from '@hcengineering/ui'
  import { Analytics } from '@hcengineering/analytics'
  import contact from '../plugin'
  import { getAccountClient } from '../utils'
  import EmployeeAccessEditor from './EmployeeAccessEditor.svelte'
  import PasswordEditBox from './PasswordEditBox.svelte'

  export let object: Person
  export let readonly: boolean = false

  const account = getCurrentAccount()
  const accountClient = getAccountClient()

  let email = ''
  let socialEmail = ''
  let channelEmail = ''
  let newPassword = ''
  let pending: 'password' | 'reset' | undefined
  let statusMessage: 'updated' | 'sent' | undefined
  let lastObjectId = object._id

  const socialQuery = createQuery()
  const channelQuery = createQuery()

  $: if (object._id !== lastObjectId) {
    lastObjectId = object._id
    newPassword = ''
    statusMessage = undefined
    pending = undefined
  }

  $: socialQuery.query(
    contact.class.SocialIdentity,
    { attachedTo: object._id, type: SocialIdType.EMAIL },
    (res) => {
      socialEmail = res[0]?.value?.trim() ?? ''
    }
  )
  $: channelQuery.query(
    contact.class.Channel,
    { attachedTo: object._id, provider: contact.channelProvider.Email },
    (res) => {
      channelEmail = res[0]?.value?.trim() ?? ''
    }
  )
  $: email = (socialEmail !== '' ? socialEmail : channelEmail).toLowerCase()

  $: canManage =
    !readonly &&
    object.personUuid != null &&
    hasAccountRole(account, AccountRole.Maintainer) &&
    object.personUuid !== account.uuid

  async function setPassword (): Promise<void> {
    if (email === '' || newPassword.trim().length === 0) return
    showPopup(MessageBox, {
      label: contact.string.SetPassword,
      message: contact.string.SetPasswordDescr,
      dangerous: true,
      action: async () => {
        pending = 'password'
        statusMessage = undefined
        try {
          await accountClient.setWorkspaceUserPassword(email, newPassword.trim())
          newPassword = ''
          statusMessage = 'updated'
        } catch (err: unknown) {
          Analytics.handleError(err as Error)
          void setPlatformStatus(unknownError(err))
        } finally {
          pending = undefined
        }
      }
    })
  }

  async function sendResetLink (): Promise<void> {
    if (email === '') return
    showPopup(MessageBox, {
      label: contact.string.SendResetLink,
      message: contact.string.SendResetLinkDescr,
      action: async () => {
        pending = 'reset'
        statusMessage = undefined
        try {
          await accountClient.sendWorkspaceUserPasswordReset(email)
          statusMessage = 'sent'
        } catch (err: unknown) {
          Analytics.handleError(err as Error)
          void setPlatformStatus(unknownError(err))
        } finally {
          pending = undefined
        }
      }
    })
  }
</script>

<EmployeeAccessEditor {object} />

{#if canManage}
  <div class="login-panel mt-4">
    <div class="fs-title mb-2">
      <Label label={contact.string.LoginCredentials} />
    </div>
    {#if email === ''}
      <div class="text-sm content-color">
        <Label label={contact.string.NoLoginEmail} />
      </div>
    {:else}
      <div class="text-sm content-color mb-2">{email}</div>
      <PasswordEditBox placeholder={login.string.Password} bind:value={newPassword} disabled={pending !== undefined} />
      <div class="flex-row-center mt-2 buttons-gap">
        <Button
          label={contact.string.SetPassword}
          kind={'regular'}
          size={'small'}
          loading={pending === 'password'}
          disabled={pending !== undefined || newPassword.trim().length === 0}
          on:click={setPassword}
        />
        <Button
          label={contact.string.SendResetLink}
          kind={'ghost'}
          size={'small'}
          loading={pending === 'reset'}
          disabled={pending !== undefined}
          on:click={sendResetLink}
        />
      </div>
      {#if statusMessage === 'updated'}
        <div class="text-sm mt-2">
          <Label label={contact.string.PasswordUpdated} />
        </div>
      {:else if statusMessage === 'sent'}
        <div class="text-sm mt-2">
          <Label label={contact.string.ResetLinkSent} />
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style lang="scss">
  .login-panel {
    padding-top: 0.5rem;
    border-top: 1px solid var(--theme-divider-color);
  }
  .buttons-gap {
    gap: 0.5rem;
  }
</style>
