<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import contact, { Channel, findContacts, Organization } from '@hcengineering/contact'
  import { ChannelsDropdown, OrganizationPresenter } from '@hcengineering/contact-resources'
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
  import { OK, Status } from '@hcengineering/platform'
  import {
    Card,
    createQuery,
    getClient,
    InlineAttributeBar,
    InlineAttributeBarEditor,
    SpaceSelector
  } from '@hcengineering/presentation'
  import task, { getStates, TaskType } from '@hcengineering/task'
  import { TaskKindSelector, typeStore } from '@hcengineering/task-resources'
  import { Button, createFocusManager, EditBox, FocusHandler, IconInfo, Label, Status as StatusControl } from '@hcengineering/ui'
  import { statusStore } from '@hcengineering/view-resources'
  import { createEventDispatcher } from 'svelte'
  import { type Client, type ClientFunnel } from '@hcengineering/tracker'
  import tracker from '../../plugin'
  import { createDefaultChannels, findOrCreateOrganization, normalizeChannels } from '../../clientUtils'

  export let space: Ref<ClientFunnel> | undefined = undefined

  let _space = space
  const status: Status = OK
  const object: Partial<Client> = {}
  let companyName = ''
  let channels: AttachedData<Channel>[] = createDefaultChannels()

  const dispatch = createEventDispatcher()
  const client = getClient()
  const clientId: Ref<AttachedDoc> = generateId()

  export function canClose (): boolean {
    return companyName === ''
  }

  let funnels: ClientFunnel[] = []
  const funnelQuery = createQuery()
  funnelQuery.query(tracker.class.ClientFunnel, {}, (res) => {
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

  $: lookupChannels = normalizeChannels(channels)
  $: canSave = companyName.trim().length > 0

  let matches: WithLookup<Organization>[] = []
  let matchedChannels: AttachedData<Channel>[] = []
  $: void findContacts(client, contact.class.Organization, companyName.trim(), lookupChannels).then((p) => {
    matches = p.contacts as Organization[]
    matchedChannels = p.channels
  })

  async function createClient () {
    const name = companyName.trim()
    const organization = await findOrCreateOrganization(client, name, channels)
    const sequence = await client.findOne(core.class.Sequence, { attachedTo: tracker.class.Client })
    if (sequence === undefined || _space === undefined) {
      throw new Error('Client creation failed')
    }
    if (kind === undefined) {
      throw new Error('kind is not specified')
    }

    const incResult = await client.update(sequence, { $inc: { sequence: 1 } }, true)
    const number = (incResult as any).object.sequence

    const value: AttachedData<Client> = {
      status: state,
      number,
      identifier: `CLIENT-${number}`,
      title: name,
      kind,
      rank: '',
      assignee: null,
      startDate: null,
      dueDate: null,
      ...object
    }

    await client.addCollection(
      tracker.class.Client,
      _space,
      organization,
      contact.class.Organization,
      'clients',
      value,
      clientId
    )
    dispatch('close')
  }

  const manager = createFocusManager()

  $: object.space = _space
</script>

<FocusHandler {manager} />

<Card
  label={tracker.string.CreateClient}
  okAction={createClient}
  {canSave}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  <svelte:fragment slot="header">
    <SpaceSelector
      _class={tracker.class.ClientFunnel}
      label={tracker.string.FunnelName}
      kind={'regular'}
      size={'large'}
      bind:space={_space}
      create={hasAccountRole(getCurrentAccount(), AccountRole.User)
        ? {
            component: tracker.component.CreateClientFunnel,
            label: tracker.string.CreateFunnel
          }
        : undefined}
    />
    <TaskKindSelector projectType={funnel?.type} bind:value={kind} baseClass={tracker.class.Client} />
  </svelte:fragment>

  <StatusControl slot="error" {status} />

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
    <InlineAttributeBar
      _class={tracker.class.Client}
      {object}
      toClass={task.class.Task}
      ignoreKeys={['title', 'attachedTo', 'startDate']}
      on:update
      extraProps={{ showNavigate: false }}
    />
    <InlineAttributeBarEditor
      key="startDate"
      _class={tracker.class.Client}
      {object}
      draft
      extraProps={{ showNavigate: false }}
      on:update
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
