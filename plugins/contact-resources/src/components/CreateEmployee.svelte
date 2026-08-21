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
    Ref,
    SocialIdType
  } from '@hcengineering/core'
  import login from '@hcengineering/login'
  import { getResource } from '@hcengineering/platform'
  import type { IntlString } from '@hcengineering/platform'
  import { Card, getClient } from '@hcengineering/presentation'
  import setting from '@hcengineering/setting'
  import {
    createFocusManager,
    DropdownIntlItem,
    DropdownLabelsIntl,
    EditBox,
    FocusHandler,
    IconInfo,
    Label
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import { ChannelsDropdown } from '..'
  import contact from '../plugin'
  import { employeeBySocialKeyStore, getAccountClient } from '../utils'
  import EditableAvatar from './EditableAvatar.svelte'
  import { Analytics } from '@hcengineering/analytics'

  export let canSave: boolean = true
  export let onCreate: ((id: Ref<Employee>) => Promise<void>) | undefined = undefined

  let avatarEditor: EditableAvatar

  let firstName = ''
  let lastName = ''
  let email = ''
  let position = ''
  let workspaceRole: AccountRole = AccountRole.User
  let formError: IntlString | undefined = undefined
  let inviteWarning: IntlString | undefined = undefined

  const id: Ref<Employee> = generateId()

  const roleItems: DropdownIntlItem[] = [
    { id: AccountRole.Guest, label: setting.string.Guest },
    { id: AccountRole.User, label: setting.string.User },
    { id: AccountRole.Maintainer, label: setting.string.Maintainer }
  ]

  const guestWorkspaceRoles = [AccountRole.ReadOnlyGuest, AccountRole.DocGuest, AccountRole.Guest]

  export function canClose (): boolean {
    return firstName === '' && lastName === '' && email === '' && position === ''
  }

  let saving: boolean = false

  const person: Data<Person> = {
    name: '',
    city: '',
    avatarType: AvatarType.COLOR
  }

  const dispatch = createEventDispatcher()
  const client = getClient()
  const accountClient = getAccountClient()

  function employeeInfoRole (role: AccountRole): 'USER' | 'GUEST' {
    return guestWorkspaceRoles.includes(role) ? 'GUEST' : 'USER'
  }

  async function createEmployee (): Promise<void> {
    formError = undefined
    inviteWarning = undefined
    try {
      saving = true
      changeEmail()
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

      const { uuid, socialId } = await accountClient.ensurePerson(SocialIdType.EMAIL, mail, firstName, lastName)

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
        // Former member: reactivate + update profile, then re-invite
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

      try {
        if (existingEmployee !== undefined && !existingEmployee.active) {
          const resendInvite = await getResource(login.function.ResendInvite)
          await resendInvite(mail, workspaceRole)
        } else {
          const sendInvite = await getResource(login.function.SendInvite)
          await sendInvite(mail, workspaceRole)
        }
      } catch (inviteErr: any) {
        Analytics.handleError(inviteErr)
        inviteWarning = contact.string.InviteEmailFailed
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
  function onRoleSelected (e: CustomEvent<AccountRole | string | number>): void {
    workspaceRole = e.detail as AccountRole
  }

  $: showError = (existsActive || formError !== undefined || inviteWarning !== undefined) && !saving
  $: showReactivateHint = existsInactive && !saving && formError === undefined && inviteWarning === undefined

  $: canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    !existsActive &&
    !saving &&
    canSave
</script>

<FocusHandler {manager} />

<Card
  label={contact.string.AddEmployee}
  okLabel={contact.string.SendInviteAddEmployee}
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
          {:else}
            <Label label={contact.string.EmployeeAlreadyActive} />
          {/if}
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
        <EditBox
          placeholder={contact.string.Email}
          bind:value={email}
          kind={'small-style'}
          focusIndex={3}
          on:blur={changeEmail}
        />
      </div>
      <div class="mt-1">
        <EditBox
          placeholder={contact.string.Position}
          bind:value={position}
          kind={'small-style'}
          focusIndex={4}
        />
      </div>
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
      restricted={[contact.channelProvider.Email]}
    />
  </svelte:fragment>
</Card>
