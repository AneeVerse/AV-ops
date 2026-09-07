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
    Employee,
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
  import {
    createFocusManager,
    EditBox,
    FocusHandler,
    IconInfo,
    Label
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import { ChannelsDropdown } from '..'
  import contact from '../plugin'
  import { employeeBySocialKeyStore } from '../utils'
  import { provisionContactLogin } from '../provisionContactLogin'
  import EditableAvatar from './EditableAvatar.svelte'
  import LoginCredentialsFields from './LoginCredentialsFields.svelte'
  import { Analytics } from '@hcengineering/analytics'

  export let canSave: boolean = true
  export let onCreate: ((id: Ref<Employee>) => Promise<void>) | undefined = undefined

  let avatarEditor: EditableAvatar

  let firstName = ''
  let lastName = ''
  let email = ''
  let phone = ''
  let password = ''
  let position = ''
  let workspaceRole: AccountRole = AccountRole.User
  let formError: IntlString | undefined = undefined
  let inviteWarning: IntlString | undefined = undefined

  const id: Ref<Employee> = generateId()

  const guestWorkspaceRoles = [AccountRole.ReadOnlyGuest, AccountRole.DocGuest, AccountRole.Guest]

  export function canClose (): boolean {
    return firstName === '' && lastName === '' && email === '' && phone === '' && password === '' && position === ''
  }

  let saving: boolean = false

  const person: Data<Person> = {
    name: '',
    city: '',
    avatarType: AvatarType.COLOR
  }

  const dispatch = createEventDispatcher()
  const client = getClient()

  function employeeInfoRole (role: AccountRole): 'USER' | 'GUEST' {
    return guestWorkspaceRoles.includes(role) ? 'GUEST' : 'USER'
  }

  async function createEmployee (): Promise<void> {
    formError = undefined
    inviteWarning = undefined
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
          workspaceRole
        )
        uuid = provisioned.uuid
        socialId = provisioned.socialId
      } catch (err: any) {
        Analytics.handleError(err)
        void setPlatformStatus(unknownError(err))
        formError = contact.string.InviteEmailFailed
        return
      }

      const name = combineName(firstName, lastName)
      person.name = name
      person.personUuid = uuid
      const info = await avatarEditor.createAvatar()
      person.avatar = info.avatar
      person.avatarType = info.avatarType
      person.avatarProps = info.avatarProps

      const trimmedPosition = position.trim()
      const mixinData: { active: boolean, role: 'USER' | 'GUEST', position?: string | null } = {
        active: true,
        role: employeeInfoRole(workspaceRole)
      }
      if (trimmedPosition.length > 0) {
        mixinData.position = trimmedPosition
      }

      let employeeRef: Ref<Employee>

      if (existingEmployee !== undefined && !existingEmployee.active) {
        // Former member: reactivate + update profile (workspace membership restored by provision)
        await client.update(existingPerson as Person, person)
        await client.update(existingEmployee, mixinData)
        employeeRef = existingEmployee._id
      } else if (existingPerson === undefined) {
        await client.createDoc(contact.class.Person, contact.space.Contacts, person, id)
        employeeRef = id
        await client.createMixin(
          employeeRef,
          contact.class.Person,
          contact.space.Contacts,
          contact.mixin.Employee,
          mixinData
        )
      } else {
        await client.update(existingPerson, person)
        employeeRef = existingPerson._id as Ref<Employee>
        await client.createMixin(
          employeeRef,
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
          employeeRef,
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
          employeeRef,
          contact.class.Person,
          'channels',
          {
            value: channel.value,
            provider: channel.provider
          }
        )
      }
      if (onCreate != null) {
        await onCreate(employeeRef)
      }
      Analytics.handleEvent(ContactEvents.EmployeeCreated, { id: employeeRef, email: mail, role: workspaceRole })
      if (inviteWarning === undefined) {
        dispatch('close', employeeRef)
      }
    } finally {
      saving = false
    }
  }

  $: emailSocialString = buildSocialIdString({
    type: SocialIdType.EMAIL,
    value: email.trim().toLowerCase()
  })

  let channels: AttachedData<Channel>[] = []

  $: existingForEmail = $employeeBySocialKeyStore.get(emailSocialString)
  $: existsActive = existingForEmail !== undefined && existingForEmail.active
  $: existsInactive = existingForEmail !== undefined && !existingForEmail.active

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

  $: showError = (formError !== undefined || inviteWarning !== undefined) && !saving
  $: showDuplicateActive = existsActive && !saving && formError === undefined && inviteWarning === undefined
  $: showReactivateHint = existsInactive && !saving && formError === undefined && inviteWarning === undefined

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
  label={contact.string.AddEmployee}
  okLabel={contact.string.AddEmployee}
  okAction={createEmployee}
  canSave={canSubmit}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  <svelte:fragment slot="error">
    {#if showError}
      <div class="flex-row-center error-color">
        <IconInfo size={'small'} />
        <span class="text-sm overflow-label ml-2">
          {#if inviteWarning}
            <Label label={inviteWarning} />
          {:else if formError}
            <Label label={formError} />
          {/if}
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
    {#if showReactivateHint}
      <div class="flex-row-center text-sm ml-2 mt-1">
        <Label label={contact.string.EmployeeWillReactivate} />
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
        <LoginCredentialsFields
          bind:email
          bind:password
          bind:phone
          bind:workspaceRole
          showRole={true}
          onEmailBlur={changeEmail}
          onPhoneBlur={changePhone}
        />
      </div>
      <div class="mt-1">
        <EditBox
          placeholder={contact.string.Position}
          bind:value={position}
          kind={'small-style'}
        focusIndex={6}
      />
      </div>
      <slot name="extraControls" />
    </div>
    <div class="ml-4">
      <EditableAvatar
        {person}
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
