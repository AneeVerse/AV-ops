<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import contact, { type Organization } from '@hcengineering/contact'
  import { Ref } from '@hcengineering/core'
  import { createQuery } from '@hcengineering/presentation'
  import { location as locationStore } from '@hcengineering/ui'
  import tracker from '../../plugin'
  import CompanyDriveFiles from '../company/CompanyDriveFiles.svelte'
  import { selectedCompanyStore } from '../../clientUtils'

  const orgQuery = createQuery()
  let organization: Organization | undefined

  $: companyId = ($locationStore.query?.company ?? $selectedCompanyStore) as Ref<Organization> | undefined

  $: if (companyId !== undefined) {
    orgQuery.query(contact.class.Organization, { _id: companyId }, (res) => {
      organization = res[0]
    })
  } else {
    orgQuery.unsubscribe()
    organization = undefined
  }
</script>

{#if organization}
  <CompanyDriveFiles object={organization} />
{/if}
