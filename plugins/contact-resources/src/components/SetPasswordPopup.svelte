<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { Person } from '@hcengineering/contact'
  import login from '@hcengineering/login'
  import { setPlatformStatus, unknownError } from '@hcengineering/platform'
  import { Card } from '@hcengineering/presentation'
  import { Label } from '@hcengineering/ui'
  import { Analytics } from '@hcengineering/analytics'
  import { createEventDispatcher } from 'svelte'
  import contact from '../plugin'
  import { getAccountClient, getPersonLoginEmail } from '../utils'
  import PasswordEditBox from './PasswordEditBox.svelte'

  export let object: Person

  const dispatch = createEventDispatcher()
  const accountClient = getAccountClient()

  let email = ''
  let newPassword = ''
  let loaded = false

  $: void loadEmail(object)

  async function loadEmail (person: Person): Promise<void> {
    loaded = false
    email = await getPersonLoginEmail(person)
    loaded = true
  }

  async function save (): Promise<void> {
    if (email === '' || newPassword.trim().length === 0) return
    try {
      await accountClient.setWorkspaceUserPassword(email, newPassword.trim())
    } catch (err: unknown) {
      Analytics.handleError(err as Error)
      void setPlatformStatus(unknownError(err))
      throw err
    }
  }
</script>

<Card
  label={contact.string.SetPassword}
  okLabel={contact.string.SetPassword}
  okAction={save}
  canSave={loaded && email !== '' && newPassword.trim().length > 0}
  width={'small'}
  on:close={() => dispatch('close')}
>
  <div class="flex-col gap">
    <div class="text-sm content-color">
      <Label label={contact.string.SetPasswordDescr} />
    </div>
    {#if loaded && email === ''}
      <div class="text-sm error-color">
        <Label label={contact.string.NoLoginEmail} />
      </div>
    {:else if email !== ''}
      <div class="text-sm">{email}</div>
      <PasswordEditBox placeholder={login.string.Password} bind:value={newPassword} />
    {/if}
  </div>
</Card>

<style lang="scss">
  .gap {
    gap: 0.75rem;
  }
</style>
