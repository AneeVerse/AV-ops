<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import type { Asset } from '@hcengineering/platform'
  import type { ToolGroup, ToolSite } from '@hcengineering/tools'
  import { Icon, Label } from '@hcengineering/ui'

  import tools from '../plugin'

  export let site: ToolSite

  const groupIcon: Record<ToolGroup, Asset> = {
    websites: tools.icon.Websites,
    studio: tools.icon.Studio,
    business: tools.icon.Business,
    tools: tools.icon.Tools
  }

  function onKey (event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  }
</script>

<article
  class="card"
  class:current={site.current === true}
  role="link"
  tabindex="0"
  aria-label={site.name}
  on:click
  on:keydown={onKey}
>
  <div class="card-top">
    <div class="icon">
      <Icon icon={groupIcon[site.group]} size={'small'} />
    </div>
    <div class="badges">
      {#if site.current}
        <span class="badge here"><Label label={tools.string.ThisApp} /></span>
      {/if}
      <span class="badge" class:warn={!site.https}>
        <Label label={site.https ? tools.string.Https : tools.string.Http} />
      </span>
    </div>
  </div>
  <div class="name overflow-label">{site.name}</div>
  <p class="desc">{site.description}</p>
  <div class="host overflow-label">{site.host}</div>
</article>

<style lang="scss">
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    min-height: 9.5rem;
    background-color: var(--theme-button-default);
    border: 1px solid var(--theme-button-border);
    border-radius: 0.75rem;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;

    &:hover,
    &:focus-visible {
      border-color: var(--theme-button-border-hover);
      background-color: var(--theme-button-hovered);
      box-shadow: var(--theme-button-shadow);
    }
    &:focus-visible {
      box-shadow: 0 0 0 2px var(--primary-button-outline);
    }
  }
  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    background-color: var(--theme-button-hovered);
    color: var(--theme-caption-color);
    flex-shrink: 0;
  }
  .badges {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .badge {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-dark-color);
    background-color: var(--theme-bg-accent-color);
    border: 1px solid var(--theme-button-border);
    &.here {
      color: var(--primary-button-color, #fff);
      background-color: var(--primary-button-default);
      border-color: transparent;
    }
    &.warn {
      color: var(--theme-warning-color);
      border-color: var(--theme-warning-color);
    }
  }
  .name {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--theme-caption-color);
  }
  .desc {
    margin: 0;
    flex-grow: 1;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--theme-content-color);
  }
  .host {
    font-family: var(--mono-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
</style>
