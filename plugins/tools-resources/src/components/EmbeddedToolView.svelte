<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import { copyTextToClipboard } from '@hcengineering/presentation'
  import type { Tool } from '@hcengineering/tools'
  import {
    Button,
    Icon,
    IconClose,
    IconCopy,
    IconOpen,
    IconUndo,
    Label,
    Spinner
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'

  import tools from '../plugin'

  export let site: Tool

  const dispatch = createEventDispatcher()

  let loading = true
  let reloadKey = 0
  let copied = false
  let copyTimeout: ReturnType<typeof setTimeout> | undefined

  function reload (): void {
    loading = true
    reloadKey += 1
  }

  async function copyUrl (): Promise<void> {
    await copyTextToClipboard(site.href)
    copied = true
    clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copied = false
    }, 2000)
  }

  function openExternal (): void {
    window.open(site.href, '_blank', 'noopener,noreferrer')
  }

  function closeTab (): void {
    dispatch('close')
  }

  function onIframeLoad (): void {
    loading = false
  }
</script>

<div class="embedded-view-container">
  <div class="tab-toolbar">
    <div class="tab-meta">
      <span class="tab-icon">
        <Icon icon={tools.icon.Application} size="small" />
      </span>
      <span class="tab-title">{site.name}</span>
      <span class="tab-url">{site.host}</span>
    </div>

    <div class="toolbar-actions">
      <span class="embed-hint"><Label label={tools.string.EmbedNotice} /></span>
      <Button
        icon={IconUndo}
        kind="ghost"
        size="small"
        showTooltip={{ label: tools.string.Reload }}
        on:click={reload}
      />
      <Button
        icon={IconCopy}
        kind="ghost"
        size="small"
        showTooltip={{ label: copied ? tools.string.Copied : tools.string.Copy }}
        on:click={copyUrl}
      />
      <Button
        icon={IconOpen}
        kind="ghost"
        size="small"
        label={tools.string.OpenExternal}
        showTooltip={{ label: tools.string.OpenExternal }}
        on:click={openExternal}
      />
      <Button
        icon={IconClose}
        kind="ghost"
        size="small"
        showTooltip={{ label: tools.string.Close }}
        on:click={closeTab}
      />
    </div>
  </div>

  <div class="tab-frame-wrap">
    {#if loading}
      <div class="loading-overlay">
        <Spinner size="large" />
        <span class="loading-label">Loading {site.name}...</span>
      </div>
    {/if}

    {#key reloadKey}
      <iframe
        src={site.href}
        title={site.name}
        class="embedded-iframe"
        allow="clipboard-read; clipboard-write; microphone; camera; fullscreen"
        on:load={onIframeLoad}
      ></iframe>
    {/key}
  </div>
</div>

<style lang="scss">
  .embedded-view-container {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    height: 100%;
    background-color: var(--theme-navpanel-color);
  }

  .tab-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1.25rem;
    background-color: var(--theme-comp-header-color);
    border-bottom: 1px solid var(--theme-divider-color);
    flex-shrink: 0;
    gap: 1rem;
  }

  .tab-meta {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .tab-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    background-color: var(--theme-button-hovered);
    color: var(--theme-caption-color);
    flex-shrink: 0;
  }

  .tab-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-caption-color);
    white-space: nowrap;
  }

  .tab-url {
    font-family: var(--mono-font, ui-monospace, monospace);
    font-size: 0.75rem;
    color: var(--theme-dark-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .embed-hint {
    font-size: 0.6875rem;
    color: var(--theme-dark-color);
    margin-right: 0.5rem;
  }

  .tab-frame-wrap {
    position: relative;
    flex-grow: 1;
    min-height: 0;
    background-color: #0d1117;
  }

  .embedded-iframe {
    width: 100%;
    height: 100%;
    border: none;
    background-color: #ffffff;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: rgba(15, 23, 42, 0.8);
    z-index: 2;
  }

  .loading-label {
    font-size: 0.8125rem;
    color: var(--theme-caption-color);
  }
</style>
