<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { AttachmentsPresenter } from '@hcengineering/attachment-resources'
  import { ChatMessagesPresenter } from '@hcengineering/chunter-resources'
  import contact from '@hcengineering/contact'
  import { ContactPresenter } from '@hcengineering/contact-resources'
  import type { WithLookup } from '@hcengineering/core'
  import notification from '@hcengineering/notification'
  import { getClient } from '@hcengineering/presentation'
  import task from '@hcengineering/task'
  import { AssigneePresenter, StateRefPresenter } from '@hcengineering/task-resources'
  import { ActionIcon, Component, DueDatePresenter, IconMoreH } from '@hcengineering/ui'
  import { BuildModelKey } from '@hcengineering/view'
  import { enabledConfig, openDoc, showMenu, statusStore } from '@hcengineering/view-resources'
  import { type Client } from '@hcengineering/tracker'
  import tracker from '../../plugin'
  import ClientPresenter from './ClientPresenter.svelte'

  export let object: WithLookup<Client>
  export let config: (string | BuildModelKey)[]
  export let groupByKey: string

  const client = getClient()
  const assigneeAttribute = client.getHierarchy().getAttribute(tracker.class.Client, 'assignee')

  function showClient () {
    void openDoc(client.getHierarchy(), object)
  }

  $: status = $statusStore.byId.get(object.status)

  $: isDone = status?.category === task.statusCategory.Lost || status?.category === task.statusCategory.Won
</script>

<div class="flex-col pt-3 pb-3 pr-4 pl-4">
  <div class="flex-between mb-3">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="fs-title cursor-pointer" on:click={showClient}>{object.title}</div>
    <div class="flex-row-center">
      <div class="mr-2">
        <Component is={notification.component.NotificationPresenter} props={{ value: object }} />
      </div>
      <ActionIcon
        label={tracker.string.More}
        action={(evt) => {
          showMenu(evt, { object })
        }}
        icon={IconMoreH}
        size={'small'}
      />
    </div>
  </div>
  <div class="flex-between mb-2">
    {#if enabledConfig(config, 'attachedTo') && object.$lookup?.attachedTo}
      <ContactPresenter value={object.$lookup.attachedTo} avatarSize={'small'} />
    {/if}
  </div>
  <div class="card-labels mb-2">
    {#if groupByKey !== 'status' && enabledConfig(config, 'status')}
      <StateRefPresenter
        size={'small'}
        kind={'link-bordered'}
        space={object.space}
        shrink={1}
        value={object.status}
        onChange={(status) => {
          client.update(object, { status })
        }}
      />
    {/if}
    {#if enabledConfig(config, 'dueDate')}
      <DueDatePresenter
        size={'small'}
        kind={'link-bordered'}
        width={'fit-content'}
        value={object.dueDate}
        shouldRender={object.dueDate !== null && object.dueDate !== undefined}
        shouldIgnoreOverdue={isDone}
        onChange={async (e) => {
          await client.update(object, { dueDate: e })
        }}
      />
    {/if}
  </div>
  <div class="flex-between">
    <div class="flex-row-center gap-3 reverse mr-4">
      <ClientPresenter value={object} />
      {#if enabledConfig(config, 'attachments') && (object.attachments ?? 0) > 0}
        <AttachmentsPresenter value={object.attachments} {object} />
      {/if}
      {#if enabledConfig(config, 'comments')}
        <ChatMessagesPresenter value={object.comments} {object} />
      {/if}
    </div>
    {#if enabledConfig(config, 'assignee')}
      <AssigneePresenter
        value={object.assignee}
        issueId={object._id}
        defaultClass={contact.mixin.Employee}
        currentSpace={object.space}
        placeholderLabel={assigneeAttribute.label}
      />
    {/if}
  </div>
</div>

<style lang="scss">
  .card-labels {
    display: flex;
    flex-wrap: nowrap;
    min-width: 0;
  }
</style>
