<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
-->
<script lang="ts">
  import contact, { type Organization, type Person } from '@hcengineering/contact'
  import { getContactLink, UserBox } from '@hcengineering/contact-resources'
  import { type Ref } from '@hcengineering/core'
  import type { Lead } from '@hcengineering/lead'
  import { getClient } from '@hcengineering/presentation'
  import tracker, { trackerId, type Project } from '@hcengineering/tracker'
  import { EditBox, Grid, getCurrentResolvedLocation, navigate } from '@hcengineering/ui'
  import { restrictionStore } from '@hcengineering/view-resources'
  import { createEventDispatcher, onMount } from 'svelte'
  import { organizationsMatching, uniqueProjectIdentifier } from '../companyMatch'
  import lead from '../plugin'
  import { createProjectForCompany, leadIsWon, linkPersonToCompany } from '../wonCompany'

  export let object: Lead
  export let readonly: boolean = false

  const dispatch = createEventDispatcher()
  const client = getClient()

  let won = false
  let busy = false
  let message = ''
  let showDialog = false
  let orgCustomer = false
  let companyName = ''
  let projectName = ''
  let identifier = ''
  let companies: Organization[] = []
  let chosenId: Ref<Organization> | undefined = undefined

  $: matches = orgCustomer ? [] : organizationsMatching(companies, companyName).filter((org) => org._id !== chosenId)

  async function refreshWon (): Promise<void> {
    won = await leadIsWon(client, object.status)
  }

  function openProject (projectId: Ref<Project>): void {
    const loc = getCurrentResolvedLocation()
    loc.path[2] = trackerId
    loc.path[3] = projectId
    loc.path[4] = 'issues'
    loc.path.length = 5
    loc.fragment = undefined
    loc.query = undefined
    navigate(loc)
  }

  async function openCompany (companyId: Ref<Organization>): Promise<void> {
    const company = await client.findOne(contact.class.Organization, { _id: companyId })
    if (company === undefined) return
    navigate(await getContactLink(company))
  }

  async function nextIdentifier (name: string): Promise<string> {
    const projects = await client.findAll(tracker.class.Project, {})
    return uniqueProjectIdentifier(name, projects.map((project) => project.identifier))
  }

  async function start (): Promise<void> {
    if (busy || !won) return
    message = ''
    const customer = await client.findOne(contact.class.Contact, { _id: object.attachedTo })
    if (customer === undefined) {
      message = 'This lead has no customer yet.'
      return
    }
    if (client.getHierarchy().isDerived(customer._class, contact.class.Organization)) {
      orgCustomer = true
      chosenId = customer._id as Ref<Organization>
      companyName = customer.name
      projectName = customer.name
      identifier = await nextIdentifier(customer.name)
      companies = []
      showDialog = true
      return
    }
    const person = customer as Person
    if (person.promotedTo != null) {
      await openCompany(person.promotedTo)
      return
    }
    orgCustomer = false
    companies = await client.findAll(contact.class.Organization, {})
    companyName = person.name
    projectName = person.name
    chosenId = undefined
    identifier = await nextIdentifier(person.name)
    showDialog = true
  }

  async function confirm (reuse: boolean): Promise<void> {
    if (busy) return
    if (!orgCustomer && reuse && chosenId === undefined) {
      message = 'Choose a company, or create a new one.'
      return
    }
    if (projectName.trim() === '' || (!orgCustomer && !reuse && companyName.trim() === '')) {
      message = 'Company and project names are required.'
      return
    }
    busy = true
    message = ''
    try {
      const customer = await client.findOne(contact.class.Contact, { _id: object.attachedTo })
      if (customer === undefined) throw new Error('Customer was not found')
      if (client.getHierarchy().isDerived(customer._class, contact.class.Organization)) {
        const project = await createProjectForCompany(client, customer._id as Ref<Organization>, projectName, identifier)
        showDialog = false
        message = project.created
          ? 'Project created. The lead was left as it is.'
          : 'That project is already on the company.'
        openProject(project.id)
        return
      }
      const person = customer as Person
      if (person.promotedTo != null) {
        showDialog = false
        await openCompany(person.promotedTo)
        return
      }
      const linked = await linkPersonToCompany(
        client,
        person,
        companyName,
        projectName,
        identifier,
        reuse ? chosenId : undefined
      )
      showDialog = false
      message = linked.createdCompany
        ? 'Company and project created. The lead still points at the person.'
        : 'Using the existing company. The lead still points at the person.'
      openProject(linked.projectId)
    } catch (err) {
      message = err instanceof Error ? err.message : 'Could not create the company project'
    } finally {
      busy = false
    }
  }

  let oldTitle: string = ''
  let rawTitle: string = ''
  $: if (oldTitle !== object.title) {
    oldTitle = object.title
    rawTitle = object.title
  }
  $: if (object.status !== undefined) {
    void refreshWon()
  }

  function change (field: string, value: any) {
    client.updateDoc(object._class, object.space, object._id, { [field]: value })
  }

  onMount(() => {
    dispatch('open', { ignoreKeys: ['comments', 'number', 'title', 'customer', 'identifier'] })
    void refreshWon()
  })
</script>

{#if object !== undefined}
  <Grid column={2} rowGap={1}>
    <EditBox
      bind:value={rawTitle}
      placeholder={lead.string.LeadPlaceholder}
      kind={'large-style'}
      disabled={readonly}
      focusable
      on:blur={() => {
        if (rawTitle !== object.title) change('title', rawTitle)
      }}
    />
    <UserBox
      _class={contact.class.Contact}
      label={lead.string.Customer}
      placeholder={lead.string.SelectCustomer}
      showNavigate={!$restrictionStore.disableNavigation}
      {readonly}
      kind={'link'}
      size={'x-large'}
      justify={'left'}
      width={'100%'}
      bind:value={object.attachedTo}
      on:change={() => {
        change('attachedTo', object.attachedTo)
      }}
    />
    {#if won && !readonly}
      <button type="button" disabled={busy} on:click={start}>Create company project</button>
    {/if}
    {#if message !== ''}
      <span>{message}</span>
    {/if}
  </Grid>
  {#if showDialog}
    <div class="company-project">
      {#if !orgCustomer}
        <label>
          Company
          <input bind:value={companyName} />
        </label>
      {/if}
      <label>
        Project
        <input bind:value={projectName} />
      </label>
      <label>
        Identifier
        <input bind:value={identifier} maxlength="5" />
      </label>
      {#if matches.length > 0}
        <p>Similar companies. Pick one, or create a new company. Nothing is deleted.</p>
        {#each matches as match (match._id)}
          <button type="button" on:click={() => (chosenId = match._id)}>{match.name}</button>
        {/each}
      {:else if chosenId !== undefined && !orgCustomer}
        <p>Selected an existing company. Nothing is deleted.</p>
      {/if}
      {#if orgCustomer}
        <button type="button" disabled={busy || projectName.trim() === ''} on:click={() => confirm(true)}>Create project</button>
      {:else}
        <button type="button" disabled={busy || chosenId === undefined} on:click={() => confirm(true)}>Use this company</button>
        <button type="button" disabled={busy || companyName.trim() === '' || projectName.trim() === ''} on:click={() => confirm(false)}>Create new</button>
      {/if}
      <button type="button" on:click={() => (showDialog = false)}>Cancel</button>
    </div>
  {/if}
{/if}

<style>
  .company-project {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  input {
    padding: 0.35rem 0.5rem;
  }
</style>
