<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { Person } from '@hcengineering/contact'
  import { Button, IconDelete, tooltip } from '@hcengineering/ui'
  import contact from '../plugin'
  import { deleteEmployee } from '../employeeActions'

  export let value: Person | undefined

  function handleDelete (e: MouseEvent): void {
    e.stopPropagation()
    e.preventDefault()
    if (value == null) return
    void deleteEmployee(value)
  }
</script>

{#if value != null}
  <div class="flex-row-center" use:tooltip={{ label: contact.string.DeleteEmployee }}>
    <Button
      icon={IconDelete}
      kind={'ghost'}
      size={'small'}
      dataId={'delete-employee'}
      on:click={handleDelete}
    />
  </div>
{/if}
