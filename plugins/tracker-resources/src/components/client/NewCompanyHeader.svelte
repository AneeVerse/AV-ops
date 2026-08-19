<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import { showPopup, HeaderButton } from '@hcengineering/ui'
  import { AccountRole } from '@hcengineering/core'
  import { getClient } from '@hcengineering/presentation'
  import tracker from '../../plugin'
  import CreateCompany from './CreateCompany.svelte'

  const client = getClient()

  async function newCompany (): Promise<void> {
    showPopup(CreateCompany, {}, 'top')
  }
</script>

<HeaderButton
  {client}
  mainActionId={tracker.string.NewCompany}
  visibleActions={[tracker.string.NewCompany]}
  actions={[
    {
      id: tracker.string.NewCompany,
      label: tracker.string.NewCompany,
      accountRole: AccountRole.User,
      callback: newCompany
    }
  ]}
/>
