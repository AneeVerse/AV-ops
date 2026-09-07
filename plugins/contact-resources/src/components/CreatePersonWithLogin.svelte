<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import {
    AvatarType,
    Channel,
    combineName,
    ContactEvents,
    Person,
    SocialIdentityRef
  } from '@hcengineering/contact'
  import {
    AccountRole,
    AttachedData,
    buildSocialIdString,
    Data,
    generateId,
    type PersonId,
    type PersonUuid,
    Ref,
    SocialIdType
  } from '@hcengineering/core'
  import { setPlatformStatus, type IntlString, unknownError } from '@hcengineering/platform'
  import { Card, getClient } from '@hcengineering/presentation'
  import { createFocusManager, EditBox, FocusHandler, IconInfo, Label } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import { ChannelsDropdown } from '..'
  import contact from '../plugin'
  import { provisionContactLogin } from '../provisionContactLogin'
  import EditableAvatar from './EditableAvatar.svelte'
  import LoginCredentialsFields from './LoginCredentialsFields.svelte'
  import { Analytics } from '@hcengineering/analytics'

  export let canSave: boolean = true
  export let onCreate: ((id: Ref<Person>) => Promise<void>) | undefined = undefined

  let avatarEditor: EditableAvatar
  let firstName = ''
  let lastName = ''
  let email = ''
  let phone = ''
  let password = ''
  let formError: IntlString | undefined = undefined
  let saving = false

  const id: Ref<Person> = generateId()
  const dispatch = createEventDispatcher()
  const client = getClient()

  export function canClose (): boolean {
    return firstName === '' && lastName === '' && email === '' && phone === '' && password === ''
  }

  let channels: AttachedData<Channel>[] = []

  function changeEmail (): void {
    const mail = email.trim().toLowerCase()
    const index = channels.findIndex((p) => p.provider === contact.channelProvider.Email)
    if (index !== -1) {
      channels[index].value = mail
    } else {
      channels.push({ provider: contact.channelProvider.Email, value: mail })
    }
    channels = channels
  }

  function changePhone (): void {
    const trimmed = phone.trim()
    const index = channels.findIndex((p) => p.provider === contact.channelProvider.Phone)
    if (trimmed.length > 0) {
      if (index !== -1) {
        channels[index].value = trimmed
      } else {
        channels.push({ provider: contact.channelProvider.Phone, value: trimmed })
      }
    } else if (index !== -1) {
      channels.splice(index, 1)
    }
    channels = channels
  }

  async function createPersonWithLogin (): Promise<void> {
    formError = undefined
    try {
      saving = true
      changeEmail()
      changePhone()
      const mail = email.trim().toLowerCase()
      const socialString = buildSocialIdString({ type: SocialIdType.EMAIL, value: mail })

      let uuid: PersonUuid
      let socialId: PersonId
      try {
        const provisioned = await provisionContactLogin(mail, password, firstName, lastName, AccountRole.User)
        uuid = provisioned.uuid
        socialId = provisioned.socialId
      } catch (err: unknown) {
        Analytics.handleError(err as Error)
        void setPlatformStatus(unknownError(err))
        formError = contact.string.InviteEmailFailed
        return
      }

      const person: Data<Person> = {
        name: combineName(firstName, lastName),
        city: '',
        avatarType: AvatarType.COLOR,
        personUuid: uuid
      }
      const info = await avatarEditor.createAvatar()
      person.avatar = info.avatar
      person.avatarType = info.avatarType
      person.avatarProps = info.avatarProps

      const existingId = await client.findOne(contact.class.SocialIdentity, { key: socialString })
      const existingPerson =
        existingId !== undefined
          ? await client.findOne(contact.class.Person, { _id: existingId.attachedTo })
          : undefined

      let personRef: Ref<Person>
      if (existingPerson === undefined) {
        await client.createDoc(contact.class.Person, contact.space.Contacts, person, id)
        personRef = id
      } else {
        await client.update(existingPerson, person)
        personRef = existingPerson._id as Ref<Person>
      }

      const existingSocial = await client.findOne(contact.class.SocialIdentity, {
        _id: socialId as SocialIdentityRef
      })
      if (existingSocial == null) {
        await client.addCollection(
          contact.class.SocialIdentity,
          contact.space.Contacts,
          personRef,
          contact.class.Person,
          'socialIds',
          { type: SocialIdType.EMAIL, value: mail, key: socialString },
          socialId as SocialIdentityRef
        )
      }

      for (const channel of channels) {
        await client.addCollection(
          contact.class.Channel,
          contact.space.Contacts,
          personRef,
          contact.class.Person,
          'channels',
          { value: channel.value, provider: channel.provider }
        )
      }

      if (onCreate != null) {
        await onCreate(personRef)
      }
      Analytics.handleEvent(ContactEvents.PersonCreated, { id: personRef, email: mail })
      dispatch('close', personRef)
    } finally {
      saving = false
    }
  }

  const manager = createFocusManager()

  $: canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().includes('@') &&
    password.trim().length > 0 &&
    !saving &&
    canSave

  $: avatarPerson = {
    name: combineName(firstName, lastName),
    avatarType: AvatarType.COLOR
  } as Person
</script>

<FocusHandler {manager} />

<Card
  label={contact.string.CreatePersonWithLogin}
  okLabel={contact.string.CreatePersonWithLogin}
  okAction={createPersonWithLogin}
  canSave={canSubmit}
  on:close={() => dispatch('close')}
  on:changeContent
>
  <svelte:fragment slot="error">
    {#if formError !== undefined && !saving}
      <div class="flex-row-center error-color">
        <IconInfo size={'small'} />
        <span class="text-sm overflow-label ml-2">
          <Label label={formError} />
        </span>
      </div>
    {/if}
  </svelte:fragment>
  <div class="flex-row-center">
    <div class="flex-grow flex-col">
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
      <LoginCredentialsFields
        bind:email
        bind:password
        bind:phone
        showRole={false}
        onEmailBlur={changeEmail}
        onPhoneBlur={changePhone}
      />
    </div>
    <div class="ml-4">
      <EditableAvatar
        person={avatarPerson}
        name={combineName(firstName, lastName)}
        {email}
        size={'large'}
        bind:this={avatarEditor}
      />
    </div>
  </div>
  <svelte:fragment slot="pool">
    <ChannelsDropdown
      bind:value={channels}
      focusIndex={10}
      kind={'regular'}
      size={'large'}
      editable
      restricted={[contact.channelProvider.Email, contact.channelProvider.Phone]}
    />
  </svelte:fragment>
</Card>
