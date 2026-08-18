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
  import contact, { Employee, Person } from '@hcengineering/contact'
  import core, { AccountUuid, AnyAttribute, DocumentQuery, notEmpty, Ref, Space, Class } from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import { IconSize } from '@hcengineering/ui'
  import { PersonLabelTooltip, employeeRefByAccountUuidStore } from '..'
  import AssigneeBox from './AssigneeBox.svelte'
  import PersonPresenter from './PersonPresenter.svelte'

  export let value: Ref<Person> | null | undefined
  export let _class: Ref<Class<Person>> = contact.class.Person
  export let inline = false
  export let enlargedText = false
  export let disabled = false
  export let accent: boolean = false
  export let shouldShowAvatar = true
  export let shouldShowName = true
  export let shouldShowPlaceholder = true
  export let defaultName: IntlString | undefined = undefined
  export let tooltipLabels: PersonLabelTooltip | undefined = undefined
  export let avatarSize: IconSize = 'x-small'
  export let onEdit: ((event: MouseEvent) => void) | undefined = undefined
  export let compact = false
  export let onChange: ((value: Ref<Person>) => void) | undefined = undefined
  export let attribute: AnyAttribute | undefined = undefined
  export let space: Ref<Space> | undefined = undefined
  export let readonly = false

  let person: Person | undefined
  const query = createQuery()
  $: value &&
    query.query(
      _class,
      { _id: value },
      (res) => {
        ;[person] = res
      },
      { limit: 1 }
    )

  function getValue (person: Person | undefined, value: Ref<Person> | null | undefined): Person | null | undefined {
    if (value === undefined || value === null) {
      return value
    }
    return person
  }

  let docQuery: DocumentQuery<Employee> = {
    active: true
  }

  const client = getClient()

  $: buildQuery(attribute, space)

  async function buildQuery (attribute: AnyAttribute | undefined, space: Ref<Space> | undefined): Promise<void> {
    const baseQuery = {
      active: true
    }
    if (attribute === undefined || space === undefined) {
      docQuery = baseQuery
      return
    }
    if (attribute.spaceMembersOnly === true || attribute.byRole !== undefined) {
      const _space = await client.findOne(core.class.Space, {
        _id: space
      })
      if (_space === undefined) {
        docQuery = baseQuery
        return
      }

      if (attribute.byRole === undefined) {
        const allMembers = _space.members ?? []
        const allPersonsSet = new Set(allMembers.map((p) => $employeeRefByAccountUuidStore.get(p)).filter(notEmpty))

        docQuery = {
          ...baseQuery,
          _id: { $in: Array.from(allPersonsSet) }
        }
      } else {
        const asMixin = client.getHierarchy().as(_space, core.mixin.SpacesTypeData)
        const roleMembers = ((asMixin as any)[attribute.byRole] ?? []) as AccountUuid[]
        const rolePersons = new Set(roleMembers.map((p) => $employeeRefByAccountUuidStore.get(p)).filter(notEmpty))
        docQuery = {
          ...baseQuery,
          _id: { $in: Array.from(rolePersons) }
        }
      }
    }
  }
</script>

{#if onChange !== undefined}
  <AssigneeBox
    label={contact.string.Employee}
    readonly={readonly || disabled}
    {value}
    size={'medium'}
    kind={'link'}
    {docQuery}
    showNavigate={false}
    justify={'left'}
    shouldShowName={shouldShowName}
    {avatarSize}
    on:change={({ detail }) => onChange?.(detail)}
    on:accent-color
  />
{:else}
  <PersonPresenter
    value={getValue(person, value)}
    {onEdit}
    {avatarSize}
    {tooltipLabels}
    {defaultName}
    {shouldShowAvatar}
    {shouldShowName}
    {shouldShowPlaceholder}
    {enlargedText}
    {disabled}
    {inline}
    {accent}
    {compact}
    on:accent-color
  />
{/if}
