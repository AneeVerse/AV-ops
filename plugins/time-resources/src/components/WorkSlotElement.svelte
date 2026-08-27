<!--
// Copyright © 2023 Hardcore Engineering Inc.
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
  import { createQuery } from '@hcengineering/presentation'
  import { Label } from '@hcengineering/ui'
  import { ToDo, WorkSlot } from '@hcengineering/time'
  import ToDoPresenter from './ToDoPresenter.svelte'
  import calendar, { getMeetingJoinUrl } from '@hcengineering/calendar'

  export let event: WorkSlot
  export let oneRow: boolean = false
  export let hideDetails: boolean = false

  $: hasMeet = getMeetingJoinUrl(event.location, event.description) != null

  let todo: ToDo

  const query = createQuery()
  $: !hideDetails
    ? query.query(event.attachedToClass, { _id: event.attachedTo }, (res) => {
      todo = res[0]
    })
    : query.unsubscribe()
</script>

{#if hideDetails}
  <Label label={calendar.string.Busy} />
{:else if todo}
  <div class="flex-row-center overflow-label">
    {#if hasMeet}<span class="meet-dot" title="Meeting"></span>{/if}
    <ToDoPresenter value={todo} withoutSpace={oneRow} />
  </div>
{/if}

<style lang="scss">
  .meet-dot {
    display: inline-block;
    width: 0.45rem;
    height: 0.45rem;
    margin-right: 0.3rem;
    border-radius: 50%;
    background: var(--theme-link-color, #4d7cff);
    vertical-align: middle;
  }
</style>
