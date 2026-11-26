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
  import { Organization, type Person } from '@hcengineering/contact'
  import { getCurrentAccount, isOwnerOrMaintainer, Ref } from '@hcengineering/core'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import setting, { IntegrationType } from '@hcengineering/setting'
  import { createFocusManager, EditBox, FocusHandler, Scroller } from '@hcengineering/ui'
  import { createEventDispatcher, onMount } from 'svelte'
  import contact from '../plugin'
  import ChannelsEditor from './ChannelsEditor.svelte'
  import EmployeeBox from './EmployeeBox.svelte'
  import Company from './icons/Company.svelte'

  export let object: Organization
  export let readonly: boolean = false

  const client = getClient()

  const dispatch = createEventDispatcher()

  function nameChange () {
    client.updateDoc(object._class, object.space, object._id, { name: object.name })
  }

  let integrations: Set<Ref<IntegrationType>> = new Set<Ref<IntegrationType>>()
  const settingsQuery = createQuery()
  $: settingsQuery.query(
    setting.class.Integration,
    { createdBy: { $in: getCurrentAccount().socialIds }, disabled: false },
    (res) => {
      integrations = new Set(res.map((p) => p.type))
    }
  )

  onMount(() => {
    dispatch('open', {
      ignoreKeys: [
        'comments',
        'name',
        'channels',
        'billingAddress',
        'gstin',
        'pan',
        'billingPhone',
        'placeOfSupply',
        'manager',
        'chatSpace',
        'chatSpaceName',
        'chatSpaceRequested',
        'lastRollupOn'
      ]
    })
  })

  const manager = createFocusManager()
  let teammate: Ref<Person> | undefined
  $: teammate = (object?.manager ?? undefined) as Ref<Person> | undefined

  function saveTeammate (ev: CustomEvent<Ref<Person> | null>): void {
    const next = (ev.detail ?? null) as Organization['manager']
    object.manager = next
    void client.updateDoc(object._class, object.space, object._id, { manager: next })
  }

  function requestStaffChat (): void {
    object.chatSpaceRequested = true
    void client.updateDoc(object._class, object.space, object._id, { chatSpaceRequested: true })
  }
</script>

<FocusHandler {manager} />

{#if object !== undefined}
  <div class="flex-row-center">
    <div class="mr-8 flex-center flex-no-shrink logo">
      <Company size={'large'} />
    </div>
    <div class="flex-grow flex-col">
      <div class="name">
        <EditBox
          disabled={readonly}
          placeholder={contact.string.PersonFirstNamePlaceholder}
          bind:value={object.name}
          on:change={nameChange}
          focusIndex={1}
        />
      </div>
      <div class="separator" />
      <div class="billing-row">
        <span>Teammate</span>
        <EmployeeBox
          label={contact.string.Teammate}
          value={teammate}
          allowDeselect
          readonly={readonly}
          kind={'link'}
          size={'small'}
          justify={'left'}
          width={'100%'}
          showNavigate={false}
          on:change={saveTeammate}
        />
      </div>
      {#if isOwnerOrMaintainer()}
        <div class="billing-row">
          <span>Staff Chat</span>
          {#if object.chatSpace}
            <span>{object.chatSpaceName || object.chatSpace}</span>
          {:else if object.chatSpaceRequested}
            <span>Requested. The space is created after the Chat app is approved. Clients are not added.</span>
          {:else if !readonly}
            <button type="button" on:click={requestStaffChat}>Create staff Chat</button>
          {/if}
        </div>
      {/if}
      <Scroller contentDirection={'horizontal'} padding={'.125rem .125rem .5rem'} stickedScrollBars thinScrollBars>
        <ChannelsEditor
          editable={!readonly}
          attachedTo={object._id}
          attachedClass={object._class}
          {integrations}
          focusIndex={10}
          on:click
        />
      </Scroller>
      <div class="billing">
        <div class="billing-title">Billing</div>
        <div class="billing-row">
          <span>GSTIN</span>
          <EditBox
            disabled={readonly}
            bind:value={object.gstin}
            placeholder={contact.string.GSTIN}
            on:change={() => {
              client.updateDoc(object._class, object.space, object._id, { gstin: object.gstin ?? '' })
            }}
          />
        </div>
        <div class="billing-row">
          <span>PAN</span>
          <EditBox
            disabled={readonly}
            bind:value={object.pan}
            placeholder={contact.string.PAN}
            on:change={() => {
              client.updateDoc(object._class, object.space, object._id, { pan: object.pan ?? '' })
            }}
          />
        </div>
        <div class="billing-row">
          <span>Phone</span>
          <EditBox
            disabled={readonly}
            bind:value={object.billingPhone}
            placeholder={contact.string.BillingPhone}
            on:change={() => {
              client.updateDoc(object._class, object.space, object._id, { billingPhone: object.billingPhone ?? '' })
            }}
          />
        </div>
        <div class="billing-row">
          <span>Place of supply</span>
          <EditBox
            disabled={readonly}
            bind:value={object.placeOfSupply}
            placeholder={contact.string.PlaceOfSupply}
            on:change={() => {
              client.updateDoc(object._class, object.space, object._id, {
                placeOfSupply: object.placeOfSupply ?? ''
              })
            }}
          />
        </div>
        <div class="billing-row">
          <span>Address</span>
          <EditBox
            disabled={readonly}
            bind:value={object.billingAddress}
            placeholder={contact.string.BillingAddress}
            on:change={() => {
              client.updateDoc(object._class, object.space, object._id, {
                billingAddress: object.billingAddress ?? ''
              })
            }}
          />
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .logo {
    width: 5rem;
    height: 5rem;
    color: var(--primary-button-color);
    background-color: var(--primary-button-default);
    border-radius: 50%;
  }
  .name {
    font-weight: 500;
    font-size: 1.25rem;
    color: var(--caption-color);
  }
  .separator {
    margin: 1rem 0;
    height: 1px;
    background-color: var(--divider-color);
  }
  .billing {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .billing-title {
    font-weight: 600;
    color: var(--caption-color);
  }
  .billing-row {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 0.5rem;
    align-items: center;
    span {
      font-size: 0.75rem;
      color: var(--theme-dark-color);
    }
  }
</style>
