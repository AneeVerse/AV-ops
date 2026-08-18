<!--
// Copyright © 2022 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
-->
<script lang="ts">
  import { Channel, combineName, Contact, findContacts } from '@hcengineering/contact'
  import { ChannelsDropdown, EditableAvatar, PersonPresenter } from '@hcengineering/contact-resources'
  import contact from '@hcengineering/contact-resources/src/plugin'
  import { AttachedData, Class, Doc, Ref, WithLookup, generateId } from '@hcengineering/core'
  import { Customer } from '@hcengineering/lead'
  import { type IntlString } from '@hcengineering/platform'
  import presentation, { Card, getClient, InlineAttributeBar } from '@hcengineering/presentation'
  import { EmptyMarkup } from '@hcengineering/text'
  import {
    Button,
    createFocusManager,
    EditBox,
    eventToHTMLElement,
    FocusHandler,
    IconInfo,
    Label,
    SelectPopup,
    showPopup
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import lead from '../plugin'
  import { type CustomerDraft, createDefaultChannels, normalizeCustomerChannels, persistCustomer } from '../utils'

  export let okLabel: IntlString = presentation.string.Create
  export let closeAfterCreate = true
  export let deferCreate = false
  export let draft: CustomerDraft | undefined = undefined

  let firstName = draft?.firstName ?? ''
  let lastName = draft?.lastName ?? ''
  const description = draft?.description ?? EmptyMarkup
  let createdId: Ref<Contact> | undefined
  let drafted = false

  export function canClose (): boolean {
    return firstName === '' && lastName === ''
  }

  let avatarEditor: EditableAvatar

  const object: Customer = {
    _class: contact.class.Person,
    ...(draft?.extra ?? {}),
    name: draft?.name ?? '',
    city: draft?.city ?? ''
  } as unknown as Customer

  const dispatch = createEventDispatcher()
  const client = getClient()
  let customerId = draft?.customerId ?? generateId()

  let channels: AttachedData<Channel>[] = draft?.channels ?? createDefaultChannels()
  let avatar: File | undefined = draft?.avatar

  function formatName (targetClass: Ref<Class<Doc>>, firstName: string, lastName: string, objectName: string): string {
    return targetClass === contact.class.Person ? combineName(firstName.trim(), lastName.trim()) : objectName
  }

  function collectDraft (): CustomerDraft {
    return {
      customerId,
      targetClass: targetClass._id,
      firstName,
      lastName,
      name,
      city: object.city ?? '',
      description,
      channels: normalizeCustomerChannels(channels),
      extra: Object.fromEntries(Object.entries(object).filter(([key]) => key !== '_class')),
      avatar,
      avatarInfo: undefined
    }
  }

  async function submitDraft (): Promise<void> {
    const nextDraft = collectDraft()
    if (avatarEditor !== undefined) {
      nextDraft.avatarInfo = await avatarEditor.createAvatar()
    }
    drafted = true
    dispatch('draft', nextDraft)
  }

  async function createCustomer (): Promise<void> {
    const id = await persistCustomer(client, {
      ...collectDraft(),
      avatarInfo: avatarEditor !== undefined ? await avatarEditor.createAvatar() : undefined
    })
    createdId = id
    dispatch('created', createdId)
  }

  const targets = [
    client.getModel().getObject(contact.class.Person),
    client.getModel().getObject(contact.class.Organization)
  ]
  let targetClass = targets.find((it) => it._id === draft?.targetClass) ?? targets[0]

  function selectTarget (evt: MouseEvent): void {
    showPopup(
      SelectPopup,
      {
        value: targets.map((it) => ({ id: it._id, label: it.label, icon: it.icon })),
        placeholder: contact.string.Contacts,
        searchable: false
      },
      eventToHTMLElement(evt),
      (ref) => {
        if (ref != null) {
          const newT = targets.find((it) => it._id === ref)
          if (newT !== undefined) {
            if (targetClass._id !== newT._id) {
              targetClass = newT
              object.name = ''
              firstName = ''
              lastName = ''
              customerId = generateId()
              channels = createDefaultChannels()
              avatar = undefined
            }
          }
        }
      }
    )
  }
  $: name = formatName(targetClass._id, firstName, lastName, object.name)
  $: canSave = name.trim().length > 0
  $: lookupChannels = normalizeCustomerChannels(channels)

  const manager = createFocusManager()

  let matches: WithLookup<Contact>[] = []
  let matchedChannels: AttachedData<Channel>[] = []
  $: if (targetClass !== undefined) {
    void findContacts(client, targetClass._id, name, lookupChannels).then((p) => {
      matches = p.contacts
      matchedChannels = p.channels
    })
  }
</script>

<FocusHandler {manager} />

<Card
  label={lead.string.CreateCustomer}
  {okLabel}
  okAction={deferCreate ? submitDraft : createCustomer}
  {canSave}
  on:close={() => {
    if ((createdId !== undefined || drafted) && !closeAfterCreate) {
      return
    }
    dispatch('close')
  }}
  on:changeContent
>
  <svelte:fragment slot="header">
    <Button icon={targetClass.icon} label={targetClass.label} size={'large'} on:click={selectTarget} focusIndex={100} />
  </svelte:fragment>
  {#if targetClass._id === contact.class.Person}
    <div class="flex-between flex-row-top">
      <div class="flex-col flex-grow">
        <EditBox
          placeholder={contact.string.PersonFirstNamePlaceholder}
          bind:value={firstName}
          kind={'large-style'}
          autoFocus
          focusIndex={1}
        />
        <EditBox
          placeholder={contact.string.PersonLastNamePlaceholder}
          bind:value={lastName}
          kind={'large-style'}
          focusIndex={2}
        />
        <div class="mt-1">
          <EditBox
            placeholder={contact.string.PersonLocationPlaceholder}
            bind:value={object.city}
            kind={'small-style'}
            focusIndex={3}
          />
        </div>
      </div>
      <div class="ml-4 flex">
        <EditableAvatar
          person={object}
          size={'large'}
          name={object.name}
          bind:this={avatarEditor}
          bind:direct={avatar}
        />
      </div>
    </div>
  {:else}
    <div class="flex-row-center clear-mins">
      <div class="mr-3">
        <Button icon={contact.icon.Company} size={'medium'} kind={'link-bordered'} noFocus />
      </div>
      <EditBox
        placeholder={contact.string.OrganizationNamePlaceholder}
        bind:value={object.name}
        kind={'large-style'}
        autoFocus
        focusIndex={1}
      />
    </div>
  {/if}
  <svelte:fragment slot="pool">
    <ChannelsDropdown
      bind:value={channels}
      focusIndex={10}
      kind={'regular'}
      size={'large'}
      editable
      highlighted={matchedChannels.map((it) => it.provider)}
    />
    {#if targetClass._id === contact.class.Organization}
      <InlineAttributeBar
        _class={contact.class.Organization}
        {object}
        toClass={contact.class.Contact}
        on:update
        extraProps={{ showNavigate: false }}
      />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="footer">
    {#if matches.length > 0}
      <div class="flex-row-center error-color">
        <IconInfo size={'small'} />
        <span class="text-sm overflow-label ml-2">
          <Label label={contact.string.PersonAlreadyExists} />
        </span>
        <div class="ml-4"><PersonPresenter value={matches[0]} /></div>
      </div>
    {/if}
  </svelte:fragment>
</Card>
