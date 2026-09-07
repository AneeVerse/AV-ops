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
  import { AvatarType, Channel, combineName, ContactEvents, Person, SocialIdentityRef } from '@hcengineering/contact'
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
  import { ChannelsDropdown, employeeBySocialKeyStore } from '..'
  import contact from '../plugin'
  import { provisionContactLogin } from '../provisionContactLogin'
  import LoginCredentialsFields from './LoginCredentialsFields.svelte'
  import { Analytics } from '@hcengineering/analytics'

  export let canSave: boolean = true
  export let onCreate: ((id: Ref<Person>) => Promise<void>) | undefined = undefined

  let firstName = ''
  let lastName = ''
  let email = ''
  let phone = ''
  let password = ''
  let formError: IntlString | undefined = undefined

  const id: Ref<Person> = generateId()

  export function canClose (): boolean {
    return firstName === '' && lastName === '' && email === '' && phone === '' && password === ''
  }

  let saving: boolean = false

  const dispatch = createEventDispatcher()
  const client = getClient()

  async function createGuest (): Promise<void> {
    formError = undefined
    try {
      saving = true
      changeEmail()
      changePhone()
      const mail = email.trim().toLowerCase()
      const socialString = buildSocialIdString({
        type: SocialIdType.EMAIL,
        value: mail
      })

      const existingId = await client.findOne(contact.class.SocialIdentity, { key: socialString })
      const existingPerson =
        existingId !== undefined
          ? await client.findOne(contact.class.Person, { _id: existingId.attachedTo })
          : undefined

      const existingEmployee =
        existingPerson !== undefined && client.getHierarchy().hasMixin(existingPerson, contact.mixin.Employee)
          ? client.getHierarchy().as(existingPerson, contact.mixin.Employee)
          : undefined

      if (existingEmployee !== undefined && existingEmployee.active) {
        formError = contact.string.EmployeeAlreadyActive
        return
      }

      let uuid: PersonUuid
      let socialId: PersonId
      try {
        const provisioned = await provisionContactLogin(
          mail,
          password,
          firstName,
          lastName,
          AccountRole.Guest
        )
        uuid = provisioned.uuid
        socialId = provisioned.socialId
      } catch (err: unknown) {
        Analytics.handleError(err as Error)
        void setPlatformStatus(unknownError(err))
        formError = contact.string.InviteEmailFailed
        return
      }

      const name = combineName(firstName, lastName)
      const person: Data<Person> = {
        name,
        city: '',
        avatarType: AvatarType.COLOR,
        personUuid: uuid
      }

      let personRef: Ref<Person>
      const mixinData = { active: true, role: 'GUEST' as const }

      if (existingEmployee !== undefined && !existingEmployee.active) {
        await client.update(existingPerson as Person, person)
        await client.update(existingEmployee, mixinData)
        personRef = existingEmployee._id
      } else if (existingPerson === undefined) {
        await client.createDoc(contact.class.Person, contact.space.Contacts, person, id)
        personRef = id
        await client.createMixin(
          personRef,
          contact.class.Person,
          contact.space.Contacts,
          contact.mixin.Employee,
          mixinData
        )
      } else {
        await client.update(existingPerson, person)
        personRef = existingPerson._id as Ref<Person>
        await client.createMixin(
          personRef,
          contact.class.Person,
          contact.space.Contacts,
          contact.mixin.Employee,
          mixinData
        )
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
          {
            type: SocialIdType.EMAIL,
            value: mail,
            key: socialString
          },
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
          {
            value: channel.value,
            provider: channel.provider
          }
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

  let channels: AttachedData<Channel>[] = []

  $: emailSocialString = buildSocialIdString({
    type: SocialIdType.EMAIL,
    value: email.trim().toLowerCase()
  })
  $: existingForEmail = $employeeBySocialKeyStore.get(emailSocialString)
  $: existsActive = existingForEmail !== undefined && existingForEmail.active

  const manager = createFocusManager()

  function changeEmail (): void {
    const index = channels.findIndex((p) => p.provider === contact.channelProvider.Email)
    if (index !== -1) {
      channels[index].value = email.trim().toLowerCase()
    } else {
      channels.push({
        provider: contact.channelProvider.Email,
        value: email.trim().toLowerCase()
      })
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
        channels.push({
          provider: contact.channelProvider.Phone,
          value: trimmed
        })
      }
    } else if (index !== -1) {
      channels.splice(index, 1)
    }
    channels = channels
  }

  $: showDuplicateActive = existsActive && !saving && formError === undefined
  $: canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    password.trim().length > 0 &&
    !existsActive &&
    !saving &&
    canSave
</script>

<FocusHandler {manager} />

<Card
  label={contact.string.AddGuest}
  okAction={createGuest}
  canSave={canSubmit}
  on:close={() => {
    dispatch('close')
  }}
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
    {#if showDuplicateActive}
      <div class="flex-row-center error-color">
        <IconInfo size={'small'} />
        <span class="text-sm overflow-label ml-2">
          <Label label={contact.string.EmployeeAlreadyActive} />
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
        showPhone={true}
        showRole={false}
        onEmailBlur={changeEmail}
        onPhoneBlur={changePhone}
      />
      <slot name="extraControls" />
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
