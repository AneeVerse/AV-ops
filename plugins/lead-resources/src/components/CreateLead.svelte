<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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
  import { Analytics } from '@hcengineering/analytics'
  import { Channel, combineName, Contact, findContacts } from '@hcengineering/contact'
  import { ChannelsDropdown, EditableAvatar, PersonPresenter, UserBox } from '@hcengineering/contact-resources'
  import contact from '@hcengineering/contact-resources/src/plugin'
  import core, {
    AccountRole,
    AttachedData,
    AttachedDoc,
    generateId,
    getCurrentAccount,
    hasAccountRole,
    Ref,
    Status as TaskStatus,
    WithLookup
  } from '@hcengineering/core'
  import { Customer, Funnel, Lead, LeadEvents } from '@hcengineering/lead'
  import { OK, Status } from '@hcengineering/platform'
  import presentation, {
    Card,
    createQuery,
    getClient,
    InlineAttributeBar,
    InlineAttributeBarEditor,
    SpaceSelector
  } from '@hcengineering/presentation'
  import task, { getStates, TaskType } from '@hcengineering/task'
  import { TaskKindSelector, typeStore } from '@hcengineering/task-resources'
  import { EmptyMarkup } from '@hcengineering/text'
  import { Button, createFocusManager, EditBox, FocusHandler, IconInfo, Label, Status as StatusControl } from '@hcengineering/ui'
  import { statusStore } from '@hcengineering/view-resources'
  import { createEventDispatcher } from 'svelte'
  import lead from '../plugin'
  import { createDefaultChannels, normalizeCustomerChannels, persistCustomer } from '../utils'

  export let space: Ref<Funnel> | undefined = undefined
  export let customer: Ref<Contact> | null = null
  export let candidate: Ref<Contact> | null = null
  export let preserveCustomer = false
  export let preserveCandidate = false

  $: if (customer == null && candidate != null) {
    customer = candidate
  }
  $: customerLocked = preserveCustomer || preserveCandidate
  let _space = space
  const status: Status = OK

  let title: string = ''
  const object: Partial<Lead> = {}

  let firstName = ''
  let lastName = ''
  const person: Customer = {
    _class: contact.class.Person,
    name: '',
    city: ''
  } as unknown as Customer
  let customerId = generateId()
  let channels: AttachedData<Channel>[] = createDefaultChannels()
  let avatar: File | undefined
  let avatarEditor: EditableAvatar

  const dispatch = createEventDispatcher()
  const client = getClient()
  const leadId: Ref<AttachedDoc> = generateId()

  export function canClose (): boolean {
    return title === '' && firstName === '' && lastName === '' && (customerLocked || customer == null)
  }

  let funnels: Funnel[] = []
  const funnelQuery = createQuery()
  funnelQuery.query(lead.class.Funnel, {}, (res) => {
    funnels = res
  })
  $: rawStates = getStates(funnel, $typeStore, $statusStore.byId)

  let state: Ref<TaskStatus>

  $: setStatus(rawStates, object.status)

  function setStatus (rawStates: TaskStatus[], nextStatus: Ref<TaskStatus> | undefined) {
    if (nextStatus === undefined || rawStates.findIndex((it) => it._id === nextStatus) === -1) {
      state = rawStates[0]?._id
      object.status = state
    }
  }

  $: if (_space === undefined) {
    if (funnels.find((it) => it._id === _space) === undefined) {
      _space = funnels[0]?._id
    }
  }

  $: funnel = funnels.find((it) => it._id === _space)

  let kind: Ref<TaskType> | undefined = undefined

  $: name = combineName(firstName.trim(), lastName.trim())
  $: lookupChannels = normalizeCustomerChannels(channels)
  $: canSave =
    title.trim().length > 0 && (customerLocked ? customer !== null : name.trim().length > 0)

  let matches: WithLookup<Contact>[] = []
  let matchedChannels: AttachedData<Channel>[] = []
  $: if (!customerLocked) {
    void findContacts(client, contact.class.Person, name, lookupChannels).then((p) => {
      matches = p.contacts
      matchedChannels = p.channels
    })
  }

  async function createLead () {
    if (customer == null) {
      customer = await persistCustomer(client, {
        customerId,
        targetClass: contact.class.Person,
        firstName,
        lastName,
        name,
        city: person.city ?? '',
        description: EmptyMarkup,
        channels: normalizeCustomerChannels(channels),
        extra: Object.fromEntries(Object.entries(person).filter(([key]) => key !== '_class')),
        avatar,
        avatarInfo: avatarEditor !== undefined ? await avatarEditor.createAvatar() : undefined
      })
    }
    const sequence = await client.findOne(core.class.Sequence, { attachedTo: lead.class.Lead })
    if (sequence === undefined || customer == null || _space === undefined) {
      throw new Error('Lead  creation failed')
    }
    if (kind === undefined) {
      throw new Error('kind is not specified')
    }

    const incResult = await client.update(sequence, { $inc: { sequence: 1 } }, true)
    const number = (incResult as any).object.sequence

    const value: AttachedData<Lead> = {
      status: state,
      number,
      identifier: `LEAD-${number}`,
      title,
      kind,
      rank: '',
      assignee: null,
      startDate: null,
      dueDate: null,
      ...object
    }

    const customerInstance = await client.findOne(contact.class.Contact, { _id: customer })
    if (customerInstance === undefined) {
      throw new Error('contact not found')
    }
    if (!client.getHierarchy().hasMixin(customerInstance, lead.mixin.Customer)) {
      await client.createMixin<Contact, Customer>(
        customerInstance._id,
        customerInstance._class,
        customerInstance.space,
        lead.mixin.Customer,
        { customerDescription: null }
      )
    }

    await client.addCollection(lead.class.Lead, _space, customer, lead.mixin.Customer, 'leads', value, leadId)
    Analytics.handleEvent(LeadEvents.LeadCreated, { id: `LEAD-${number}`, customer })
    dispatch('close')
  }

  const manager = createFocusManager()

  $: object.space = _space
</script>

<FocusHandler {manager} />

<Card
  label={lead.string.CreateLead}
  okAction={createLead}
  {canSave}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  <svelte:fragment slot="header">
    <SpaceSelector
      _class={lead.class.Funnel}
      label={lead.string.FunnelName}
      kind={'regular'}
      size={'large'}
      bind:space={_space}
      create={hasAccountRole(getCurrentAccount(), AccountRole.User)
        ? {
            component: lead.component.CreateFunnel,
            label: lead.string.CreateFunnel
          }
        : undefined}
    />
    <TaskKindSelector projectType={funnel?.type} bind:value={kind} baseClass={lead.class.Lead} />
  </svelte:fragment>

  <svelte:fragment slot="title">
    {#if customerLocked && customer != null}
      <div class="flex-row-center gap-2">
        <UserBox
          readonly
          _class={contact.class.Contact}
          options={{ sort: { modifiedOn: -1 } }}
          excluded={[]}
          label={lead.string.Leads}
          placeholder={lead.string.Leads}
          bind:value={customer}
          kind={'regular'}
          size={'large'}
        />
      </div>
    {/if}
  </svelte:fragment>

  <StatusControl slot="error" {status} />

  {#if !customerLocked}
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
            bind:value={person.city}
            kind={'small-style'}
            focusIndex={3}
          />
        </div>
      </div>
      <div class="ml-4 flex">
        <EditableAvatar
          person={person}
          size={'large'}
          {name}
          bind:this={avatarEditor}
          bind:direct={avatar}
        />
      </div>
    </div>
  {/if}

  <div class="flex-row-center clear-mins" class:mt-2={!customerLocked}>
    <div class="mr-3">
      <Button focusIndex={4} icon={lead.icon.Lead} size={'medium'} kind={'link-bordered'} noFocus />
    </div>
    <EditBox
      focusIndex={4}
      bind:value={title}
      placeholder={lead.string.LeadPlaceholder}
      kind={'large-style'}
      autoFocus={customerLocked}
    />
  </div>

  <svelte:fragment slot="pool">
    {#if !customerLocked}
      <ChannelsDropdown
        bind:value={channels}
        focusIndex={10}
        kind={'regular'}
        size={'large'}
        editable
        highlighted={matchedChannels.map((it) => it.provider)}
      />
    {/if}
    <InlineAttributeBar
      _class={lead.class.Lead}
      {object}
      toClass={task.class.Task}
      ignoreKeys={['title', 'attachedTo', 'startDate']}
      on:update
      extraProps={{ showNavigate: false }}
    />
    <InlineAttributeBarEditor
      key="startDate"
      _class={lead.class.Lead}
      {object}
      draft
      extraProps={{ showNavigate: false }}
      on:update
    />
  </svelte:fragment>
  <svelte:fragment slot="footer">
    {#if !customerLocked && matches.length > 0}
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
