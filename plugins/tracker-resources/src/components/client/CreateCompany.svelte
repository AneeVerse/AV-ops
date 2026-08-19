<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import contact, { Channel, findContacts, Organization } from '@hcengineering/contact'
  import { ChannelsDropdown, OrganizationPresenter } from '@hcengineering/contact-resources'
  import { AttachedData, WithLookup } from '@hcengineering/core'
  import { Card, getClient } from '@hcengineering/presentation'
  import { Button, createFocusManager, EditBox, FocusHandler, IconInfo, Label } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import tracker from '../../plugin'
  import { createDefaultChannels, persistOrganization } from '../../clientUtils'

  let companyName = ''
  let channels: AttachedData<Channel>[] = createDefaultChannels()

  const dispatch = createEventDispatcher()
  const client = getClient()

  export function canClose (): boolean {
    return companyName === ''
  }

  $: canSave = companyName.trim().length > 0

  let matches: WithLookup<Organization>[] = []
  let matchedChannels: AttachedData<Channel>[] = []
  $: void findContacts(client, contact.class.Organization, companyName.trim(), channels).then((p) => {
    matches = p.contacts as Organization[]
    matchedChannels = p.channels
  })

  async function createCompany (): Promise<void> {
    await persistOrganization(client, {
      name: companyName.trim(),
      channels
    })
    dispatch('close')
  }

  const manager = createFocusManager()
</script>

<FocusHandler {manager} />

<Card
  label={tracker.string.CreateCompany}
  okAction={createCompany}
  {canSave}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  <div class="flex-row-center clear-mins">
    <div class="mr-3">
      <Button icon={contact.icon.Company} size={'medium'} kind={'link-bordered'} noFocus />
    </div>
    <EditBox
      bind:value={companyName}
      placeholder={contact.string.OrganizationNamePlaceholder}
      kind={'large-style'}
      autoFocus
      focusIndex={1}
    />
  </div>

  <svelte:fragment slot="pool">
    <ChannelsDropdown
      bind:value={channels}
      focusIndex={10}
      kind={'regular'}
      size={'large'}
      editable
      highlighted={matchedChannels.map((it) => it.provider)}
    />
  </svelte:fragment>
  <svelte:fragment slot="footer">
    {#if matches.length > 0}
      <div class="flex-row-center error-color">
        <IconInfo size={'small'} />
        <span class="text-sm overflow-label ml-2">
          <Label label={contact.string.PersonAlreadyExists} />
        </span>
        <div class="ml-4"><OrganizationPresenter value={matches[0]} /></div>
      </div>
    {/if}
  </svelte:fragment>
</Card>
