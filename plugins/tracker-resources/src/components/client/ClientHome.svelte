<!--
// Copyright © 2026 Hardcore Engineering Inc.
-->
<script lang="ts">
  import contact, { type Organization } from '@hcengineering/contact'
  import { Ref } from '@hcengineering/core'
  import { createQuery } from '@hcengineering/presentation'
  import { location as locationStore, Header, Breadcrumb } from '@hcengineering/ui'
  import { type Client as TrackerClient } from '@hcengineering/tracker'
  import CompanyRelated from '../company/CompanyRelated.svelte'
  import { selectedCompanyStore, setSelectedCompany } from '../../clientUtils'

  const orgQuery = createQuery()
  let organization: Organization | undefined

  $: companyId = ($locationStore.query?.company ?? $selectedCompanyStore) as Ref<Organization> | undefined
  $: clientId = $locationStore.query?.client as Ref<TrackerClient> | undefined

  $: if (companyId !== undefined) {
    setSelectedCompany(companyId, clientId)
    orgQuery.query(contact.class.Organization, { _id: companyId }, (res) => {
      organization = res[0]
    })
  } else {
    orgQuery.unsubscribe()
    organization = undefined
  }
</script>

{#if organization}
  <div class="client-home">
    <Header>
      <Breadcrumb icon={contact.icon.Company} title={organization.name} size={'large'} isCurrent />
    </Header>
    <div class="client-home__body">
      <CompanyRelated object={organization} />
    </div>
  </div>
{/if}

<style lang="scss">
  .client-home {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    height: 100%;
  }

  .client-home__body {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    padding: 0 1rem 1rem;
  }
</style>
