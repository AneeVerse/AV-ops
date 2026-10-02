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

  function close (): void {
    dispatch('close')
  }

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

  function onIframeLoad (): void {
    loading = false
  }
</script>

<div class="modal-overlay" on:click|self={close} on:keydown={(e) => e.key === 'Escape' && close()} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal-window">
    <header class="modal-header">
      <div class="tool-meta">
        <span class="tool-icon">
          <Icon icon={tools.icon.Application} size="small" />
        </span>
        <div class="tool-title-col">
          <div class="tool-title-row">
            <span class="tool-name">{site.name}</span>
            <span class="badge in-huly">Inside Huly</span>
          </div>
          <span class="tool-host">{site.host}</span>
        </div>
      </div>

      <div class="header-actions">
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
          showTooltip={{ label: tools.string.OpenExternal }}
          on:click={openExternal}
        />
        <div class="divider-v"></div>
        <Button
          icon={IconClose}
          kind="ghost"
          size="small"
          showTooltip={{ label: tools.string.Close }}
          on:click={close}
        />
      </div>
    </header>

    <div class="modal-body">
      {#if loading}
        <div class="loading-overlay">
          <Spinner size="large" />
          <span class="loading-text">Loading {site.name}...</span>
        </div>
      {/if}

      {#key reloadKey}
        <iframe
          src={site.href}
          title={site.name}
          class="viewer-frame"
          allow="clipboard-read; clipboard-write; microphone; camera; fullscreen"
          on:load={onIframeLoad}
        ></iframe>
      {/key}
    </div>

    <footer class="modal-footer">
      <span class="notice-text"><Label label={tools.string.EmbedNotice} /></span>
      <Button
        kind="primary"
        size="small"
        label={tools.string.OpenExternal}
        icon={IconOpen}
        on:click={openExternal}
      />
    </footer>
  </div>
</div>

<style lang="scss">
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-window {
    display: flex;
    flex-direction: column;
    width: 92vw;
    max-width: 1280px;
    height: 88vh;
    max-height: 920px;
    background-color: var(--theme-navpanel-color);
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.875rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    background-color: var(--theme-comp-header-color);
    border-bottom: 1px solid var(--theme-divider-color);
    flex-shrink: 0;
  }

  .tool-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .tool-icon {
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

  .tool-title-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .tool-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tool-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--theme-caption-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge.in-huly {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--primary-button-color, #fff);
    background-color: var(--primary-button-default);
  }

  .tool-host {
    font-family: var(--mono-font, ui-monospace, monospace);
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .divider-v {
    width: 1px;
    height: 1.25rem;
    background-color: var(--theme-divider-color);
    margin: 0 0.25rem;
  }

  .modal-body {
    position: relative;
    flex-grow: 1;
    min-height: 0;
    background-color: #0b0f14;
    overflow: hidden;
  }

  .viewer-frame {
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
    background-color: rgba(15, 23, 42, 0.75);
    z-index: 2;
  }

  .loading-text {
    font-size: 0.8125rem;
    color: var(--theme-caption-color);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1.25rem;
    background-color: var(--theme-comp-header-color);
    border-top: 1px solid var(--theme-divider-color);
    flex-shrink: 0;
  }

  .notice-text {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
</style>
