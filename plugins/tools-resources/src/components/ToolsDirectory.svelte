<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { TOOL_GROUPS, TOOL_SITES, type ToolGroup, type ToolSite } from '@hcengineering/tools'
  import {
    Breadcrumb,
    Header,
    Label,
    Scroller,
    SearchInput,
    Switcher,
    type TabItem
  } from '@hcengineering/ui'
  import type { IntlString } from '@hcengineering/platform'

  import tools from '../plugin'
  import ToolCard from './ToolCard.svelte'

  let query = ''
  let group: ToolGroup | 'all' = 'all'

  const groupLabel: Record<ToolGroup, IntlString> = {
    websites: tools.string.Websites,
    studio: tools.string.Studio,
    business: tools.string.BusinessApps,
    tools: tools.string.BotsAndTools
  }

  const groupHint: Record<ToolGroup, IntlString> = {
    websites: tools.string.WebsitesHint,
    studio: tools.string.StudioHint,
    business: tools.string.BusinessHint,
    tools: tools.string.ToolsHint
  }

  const filters: TabItem[] = [
    { id: 'all', labelIntl: tools.string.All },
    { id: 'websites', labelIntl: tools.string.Websites },
    { id: 'studio', labelIntl: tools.string.Studio },
    { id: 'business', labelIntl: tools.string.BusinessApps },
    { id: 'tools', labelIntl: tools.string.BotsAndTools }
  ]

  $: filtered = TOOL_SITES.filter((site) => {
    if (group !== 'all' && site.group !== group) return false
    const q = query.trim().toLowerCase()
    if (q === '') return true
    return [site.name, site.host, site.description].join(' ').toLowerCase().includes(q)
  })

  $: grouped = TOOL_GROUPS.map((key) => ({
    key,
    sites: filtered.filter((site) => site.group === key)
  })).filter((section) => section.sites.length > 0)

  function openSite (site: ToolSite): void {
    window.open(site.href, '_blank', 'noopener,noreferrer')
  }
</script>

<div class="hulyComponent">
  <Header adaptive={'disabled'}>
    <Breadcrumb icon={tools.icon.Application} label={tools.string.Application} size={'large'} isCurrent />
  </Header>
  <div class="antiPanel-component">
    <p class="subtitle"><Label label={tools.string.Subtitle} /></p>
    <div class="toolbar">
      <SearchInput
        bind:value={query}
        placeholder={tools.string.SearchPlaceholder}
        delay={150}
        width={'100%'}
        on:change={(e) => {
          query = e.detail ?? ''
        }}
      />
      <Switcher
        name={'tools-group-filter'}
        items={filters}
        kind={'subtle'}
        selected={group}
        on:select={(result) => {
          if (result.detail !== undefined) {
            group = String(result.detail.id) as ToolGroup | 'all'
          }
        }}
      />
    </div>
    <Scroller padding={'0 1.5rem 1.5rem'}>
      {#if grouped.length === 0}
        <div class="empty"><Label label={tools.string.Empty} /></div>
      {:else}
        {#each grouped as section (section.key)}
          <section class="section">
            <div class="section-head">
              <h2 class="section-title"><Label label={groupLabel[section.key]} /></h2>
              <span class="section-hint"><Label label={groupHint[section.key]} /></span>
            </div>
            <div class="cards_grid">
              {#each section.sites as site (site.id)}
                <ToolCard {site} on:click={() => openSite(site)} />
              {/each}
            </div>
          </section>
        {/each}
      {/if}
    </Scroller>
  </div>
</div>

<style lang="scss">
  .antiPanel-component {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    overflow: hidden;
  }
  .subtitle {
    margin: 0;
    padding: 0 1.5rem 0.75rem;
    color: var(--theme-dark-color);
    font-size: 0.8125rem;
  }
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0 1.5rem 1.25rem;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.75rem;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  .section-title {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-caption-color);
  }
  .section-hint {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
  .cards_grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr));
    gap: 1rem;
  }
  .empty {
    padding: 3rem 0;
    text-align: center;
    color: var(--theme-dark-color);
  }
</style>
