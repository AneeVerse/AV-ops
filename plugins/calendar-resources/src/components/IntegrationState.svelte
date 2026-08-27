<!--
// Copyright © 2025 Hardcore Engineering Inc.
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
  import { Calendar } from '@hcengineering/calendar'
  import { createQuery } from '@hcengineering/presentation'
  import type { Integration } from '@hcengineering/account-client'
  import { BaseIntegrationState, IntegrationStateRow } from '@hcengineering/setting-resources'
  import { OK } from '@hcengineering/platform'

  import calendar from '../plugin'

  export let integration: Integration

  let calendars: Calendar[] = []
  let extraCalendars: Calendar[] = []
  let isLoading = true
  const query = createQuery()
  query.query(
    calendar.class.ExternalCalendar,
    {
      externalUser: integration.data?.email
    },
    (res) => {
      calendars = res
      const email = (integration.data?.email ?? '').trim().toLowerCase()
      extraCalendars = calendars.filter((c) => {
        if (c.hidden) return false
        const name = (c.name ?? '').trim().toLowerCase()
        // Google names the primary calendar after the account email, which
        // BaseIntegrationState already shows — skip that duplicate row.
        return email === '' || name !== email
      })
      isLoading = false
    }
  )
</script>

<BaseIntegrationState {integration} status={OK} {isLoading} value={integration?.data?.email}>
  <svelte:fragment slot="content">
    {#if calendars.filter((c) => !c.hidden).length === 0}
      <IntegrationStateRow label={calendar.string.NoCalendars} />
    {:else}
      {#each extraCalendars as cal (cal._id)}
        <IntegrationStateRow rawLabel={cal.name} />
      {/each}
    {/if}
  </svelte:fragment>
</BaseIntegrationState>
