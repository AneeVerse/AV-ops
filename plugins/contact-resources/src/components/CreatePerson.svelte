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
  import {
    AvatarType,
    Channel,
    combineName,
    ContactEvents,
    findPerson,
    Person,
    SocialIdentityRef
  } from '@hcengineering/contact'
  import {
    AccountRole,
    AttachedData,
    buildSocialIdString,
    Data,
    generateId,
    getCurrentAccount,
    hasAccountRole,
    type PersonId,
    type PersonUuid,
    SocialIdType
  } from '@hcengineering/core'
  import { setPlatformStatus, type IntlString, unknownError } from '@hcengineering/platform'
  import { Card, getClient } from '@hcengineering/presentation'
  import { createFocusManager, EditBox, FocusHandler, IconInfo, Label, Toggle } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import { ChannelsDropdown } from '..'
  import contact from '../plugin'
  import { provisionContactLogin } from '../provisionContactLogin'
  import EditableAvatar from './EditableAvatar.svelte'
  import LoginCredentialsFields from './LoginCredentialsFields.svelte'
  import PersonPresenter from './PersonPresenter.svelte'
  import { Analytics } from '@hcengineering/analytics'

  let avatarEditor: EditableAvatar

  let firstName = ''
  let lastName = ''
  let platformLogin = false
  let email = ''
  let phone = ''
  let password = ''
  let formError: IntlString | undefined = undefined
  let saving = false

  const id = generateId()

  export function canClose (): boolean {
    return (
      firstName === '' &&
      lastName === '' &&
      (!platformLogin || (email === '' && phone === '' && password === ''))
    )
  }

  const object: Person = {} as unknown as Person

  const dispatch = createEventDispatcher()
  const client = getClient()
  const canProvisionLogin = hasAccountRole(getCurrentAccount(), AccountRole.Maintainer)

  async function createPerson (): Promise<void> {
    formError = undefined
    try {
      saving = true
      if (platformLogin) {
        changeEmail()
        changePhone()
      }

      const person: Data<Person> = {
        name: combineName(firstName, lastName),
        city: object.city,
        avatarType: AvatarType.COLOR
      }

      const info = await avatarEditor.createAvatar()
      person.avatar = info.avatar
      person.avatarType = info.avatarType
      person.avatarProps = info.avatarProps

      if (platformLogin) {
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
        person.personUuid = uuid

        const personId = await client.createDoc(contact.class.Person, contact.space.Contacts, person, id)

        const existingSocial = await client.findOne(contact.class.SocialIdentity, {
          _id: socialId as SocialIdentityRef
        })
        if (existingSocial == null) {
          await client.addCollection(
            contact.class.SocialIdentity,
            contact.space.Contacts,
            personId,
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
            id,
            contact.class.Person,
            'channels',
            { value: channel.value, provider: channel.provider }
          )
        }

        Analytics.handleEvent(ContactEvents.PersonCreated, { id: personId, email: mail })
        dispatch('close', personId)
        return
      }

      const personId = await client.createDoc(contact.class.Person, contact.space.Contacts, person, id)

      for (const channel of channels) {
        await client.addCollection(contact.class.Channel, contact.space.Contacts, id, contact.class.Person, 'channels', {
          value: channel.value,
          provider: channel.provider
        })
      }

      Analytics.handleEvent(ContactEvents.PersonCreated, { id: personId })
      dispatch('close', personId)
    } finally {
      saving = false
    }
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

  let matches: Person[] = []
  $: findPerson(client, combineName(firstName, lastName), channels).then((p) => {
    matches = p
  })

  const manager = createFocusManager()

  $: canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    matches.length === 0 &&
    !saving &&
    (!platformLogin || (email.trim().includes('@') && password.trim().length > 0))
</script>

<FocusHandler {manager} />

<Card
  label={contact.string.CreatePerson}
  okAction={createPerson}
  canSave={canSubmit}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  <svelte:fragment slot="error">
    {#if matches.length > 0}
      <div class="flex-row-center error-color">
        <IconInfo size={'small'} />
        <span class="text-sm overflow-label ml-2">
          <Label label={contact.string.PersonAlreadyExists} />
        </span>
        <div class="ml-4"><PersonPresenter value={matches[0]} /></div>
      </div>
    {/if}
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
      <div class="mt-1">
        <EditBox
          placeholder={contact.string.PersonLocationPlaceholder}
          bind:value={object.city}
          kind={'small-style'}
          focusIndex={3}
        />
      </div>
      {#if canProvisionLogin}
        <div class="mt-3 flex-row-center">
          <Toggle bind:on={platformLogin} />
          <span class="ml-2 text-sm">
            <Label label={contact.string.PlatformLogin} />
          </span>
        </div>
        {#if platformLogin}
          <div class="text-sm content-color mb-1 mt-1">
            <Label label={contact.string.PlatformLoginHint} />
          </div>
          <LoginCredentialsFields
            bind:email
            bind:password
            bind:phone
            showRole={false}
            focusIndexStart={4}
            onEmailBlur={changeEmail}
            onPhoneBlur={changePhone}
          />
        {/if}
      {/if}
    </div>
    <div class="ml-4">
      <EditableAvatar person={object} name={combineName(firstName, lastName)} size={'large'} bind:this={avatarEditor} />
    </div>
  </div>
  <svelte:fragment slot="pool">
    <ChannelsDropdown bind:value={channels} focusIndex={10} kind={'regular'} size={'large'} editable />
  </svelte:fragment>
</Card>
