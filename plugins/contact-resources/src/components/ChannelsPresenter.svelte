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
  import type { Channel } from '@hcengineering/contact'
  import contact from '@hcengineering/contact'
  import {
    type AttachedDoc,
    type Class,
    type Doc,
    type Ref,
    type WithLookup
  } from '@hcengineering/core'
  import { getResource } from '@hcengineering/platform'
  import { getClient } from '@hcengineering/presentation'
  import type { ButtonKind, ButtonSize } from '@hcengineering/ui'
  import { showPopup } from '@hcengineering/ui'
  import { ViewAction } from '@hcengineering/view'
  import ChannelsDropdown from './ChannelsDropdown.svelte'
  import ChannelsEditor from './ChannelsEditor.svelte'

  export let value: Channel[] | Channel | null
  /** Row document (Lead, Customer, …) — used to persist channels when empty. */
  export let object: Doc | undefined = undefined

  export let editable: boolean | undefined = undefined
  export let kind: ButtonKind = 'link-bordered'
  export let size: ButtonSize = 'small'
  export let length: 'tiny' | 'short' | 'full' = 'short'
  export let shape: 'circle' | undefined = 'circle'

  const client = getClient()
  const hierarchy = client.getHierarchy()

  function resolveOwner (
    doc: Doc | undefined
  ): { attachedTo: Ref<Doc>, attachedClass: Ref<Class<Doc>> } | undefined {
    if (doc == null) return undefined
    if (hierarchy.isDerived(doc._class, contact.class.Contact)) {
      return { attachedTo: doc._id, attachedClass: doc._class }
    }
    const lookupContact = (doc as WithLookup<AttachedDoc>).$lookup?.attachedTo as Doc | undefined
    if (lookupContact != null && hierarchy.isDerived(lookupContact._class, contact.class.Contact)) {
      return { attachedTo: lookupContact._id, attachedClass: lookupContact._class }
    }
    if ('attachedTo' in doc && 'attachedToClass' in doc) {
      const ad = doc as AttachedDoc
      if (hierarchy.isDerived(ad.attachedToClass, contact.class.Contact)) {
        return { attachedTo: ad.attachedTo, attachedClass: ad.attachedToClass }
      }
    }
    return undefined
  }

  $: owner = resolveOwner(object)
  // Table passes editable explicitly; List omits it — allow edit whenever we can persist.
  $: canEdit = editable !== false && owner != null

  async function _open (ev: CustomEvent): Promise<void> {
    const channels = Array.isArray(value) ? value : value != null ? [value] : []
    if (ev.detail.presenter !== undefined) {
      showPopup(ev.detail.presenter, { channel: ev.detail.channel }, 'float')
    }
    if (ev.detail.action !== undefined) {
      const action = await getResource(ev.detail.action as ViewAction)
      const channel = channels.find((it) => it.value === ev.detail.value)
      if (action != null && channel != null) {
        action(channel, ev)
      }
    }
  }
</script>

{#if owner}
  <ChannelsEditor
    attachedTo={owner.attachedTo}
    attachedClass={owner.attachedClass}
    {length}
    {kind}
    {size}
    {shape}
    editable={canEdit}
  />
{:else}
  <ChannelsDropdown
    value={value ?? []}
    {length}
    {kind}
    {size}
    {shape}
    editable={editable === true}
    on:open={_open}
  />
{/if}
