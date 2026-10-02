<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import core, { type DocumentUpdate } from '@hcengineering/core'
  import type { Asset } from '@hcengineering/platform'
  import { copyTextToClipboard, getClient, MessageBox } from '@hcengineering/presentation'
  import type { Tool, ToolGroup, ToolGroupDefinition } from '@hcengineering/tools'
  import {
    Button,
    Icon,
    IconClose,
    IconCopy,
    IconDelete,
    IconEdit,
    IconOpen,
    Label,
    showPopup
  } from '@hcengineering/ui'
  import view from '@hcengineering/view'
  import { createEventDispatcher } from 'svelte'

  import tools from '../plugin'
  import ToolEditor from './ToolEditor.svelte'

  export let site: Tool
  export let canEdit = false
  export let availableGroups: ToolGroupDefinition[] = []

  const dispatch = createEventDispatcher()
  const client = getClient()

  const defaultGroupIcons: Record<string, Asset> = {
    websites: tools.icon.Websites,
    studio: tools.icon.Studio,
    business: tools.icon.Business,
    tools: tools.icon.Tools
  }

  let loginCopied = false
  let passwordCopied = false
  let showPassword = false
  let loginCopyTimeout: ReturnType<typeof setTimeout> | undefined
  let passwordCopyTimeout: ReturnType<typeof setTimeout> | undefined
  let showMoveMenu = false

  $: login = site.login?.trim() ?? ''
  $: password = site.password?.trim() ?? ''
  $: hasCredentials = login !== '' || password !== ''

  $: currentGroupDef = availableGroups.find((g) => g.id === site.group)
  $: groupColor = currentGroupDef?.color ?? '#3b82f6'
  $: groupLabel = currentGroupDef?.name ?? site.group

  function onKey (event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      triggerOpen()
    }
  }

  function triggerOpen (event?: MouseEvent): void {
    if (event) event.stopPropagation()
    const mode = site.openMode ?? 'popup'
    dispatch('open', { site, mode })
  }

  function openPopup (event: MouseEvent): void {
    event.stopPropagation()
    dispatch('open', { site, mode: 'popup' })
  }

  function openTab (event: MouseEvent): void {
    event.stopPropagation()
    dispatch('open', { site, mode: 'tab' })
  }

  function openWindow (event: MouseEvent): void {
    event.stopPropagation()
    dispatch('open', { site, mode: 'window' })
  }

  function openEdit (event: MouseEvent): void {
    event.stopPropagation()
    showPopup(ToolEditor, { value: site, availableGroups }, 'top')
  }

  function confirmDelete (event: MouseEvent): void {
    event.stopPropagation()
    showPopup(
      MessageBox,
      {
        label: tools.string.DeleteTool,
        message: tools.string.DeleteToolConfirm,
        action: async () => {
          await client.remove(site)
        }
      },
      'top'
    )
  }

  async function moveToGroup (targetGroupId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation()
    showMoveMenu = false
    if (targetGroupId === site.group) return
    const update: DocumentUpdate<Tool> = {
      group: targetGroupId
    }
    await client.update(site, update)
  }

  function toggleMoveMenu (event: MouseEvent): void {
    event.stopPropagation()
    showMoveMenu = !showMoveMenu
  }

  async function copyLogin (event: MouseEvent): Promise<void> {
    event.stopPropagation()
    if (login === '') return
    await copyTextToClipboard(login)
    loginCopied = true
    clearTimeout(loginCopyTimeout)
    loginCopyTimeout = setTimeout(() => {
      loginCopied = false
    }, 2000)
  }

  async function copyPassword (event: MouseEvent): Promise<void> {
    event.stopPropagation()
    if (password === '') return
    await copyTextToClipboard(password)
    passwordCopied = true
    clearTimeout(passwordCopyTimeout)
    passwordCopyTimeout = setTimeout(() => {
      passwordCopied = false
    }, 2000)
  }

  function togglePassword (event: MouseEvent): void {
    event.stopPropagation()
    showPassword = !showPassword
  }
</script>

<article
  class="card"
  class:current={site.current === true}
  role="link"
  tabindex="0"
  aria-label={site.name}
  on:click={triggerOpen}
  on:keydown={onKey}
>
  <div class="card-top">
    <div class="icon-wrap" style:border-color={groupColor} style:background-color={`${groupColor}15`}>
      <Icon icon={defaultGroupIcons[site.group] ?? tools.icon.Application} size={'small'} />
    </div>

    <div class="badges">
      <span class="group-pill" style:color={groupColor} style:border-color={`${groupColor}40`}>
        {groupLabel}
      </span>

      {#if site.current}
        <span class="badge here"><Label label={tools.string.ThisApp} /></span>
      {/if}

      <span class="badge" class:warn={!site.https}>
        <Label label={site.https ? tools.string.Https : tools.string.Http} />
      </span>

      {#if canEdit}
        <div class="card-mgmt-actions">
          <Button
            icon={IconEdit}
            kind="ghost"
            size="small"
            showTooltip={{ label: tools.string.EditTool }}
            on:click={openEdit}
          />
          <Button
            icon={IconDelete}
            kind="ghost"
            size="small"
            showTooltip={{ label: tools.string.DeleteTool }}
            on:click={confirmDelete}
          />
        </div>
      {/if}
    </div>
  </div>

  <div class="card-body">
    <div class="name overflow-label">{site.name}</div>
    <p class="desc">{site.description}</p>
    <div class="host-row">
      <span class="host overflow-label">{site.host}</span>
    </div>
  </div>

  {#if hasCredentials}
    <div class="creds">
      {#if login !== ''}
        <div class="cred-row">
          <span class="cred-label"><Label label={tools.string.Login} /></span>
          <span class="cred-value overflow-label">{login}</span>
          <Button
            icon={IconCopy}
            kind="ghost"
            size="small"
            showTooltip={{ label: loginCopied ? tools.string.Copied : tools.string.Copy }}
            on:click={copyLogin}
          />
        </div>
      {/if}
      {#if password !== ''}
        <div class="cred-row">
          <span class="cred-label"><Label label={tools.string.Password} /></span>
          <span class="cred-value overflow-label">{showPassword ? password : '••••••••'}</span>
          <Button
            icon={showPassword ? view.icon.EyeCrossed : view.icon.Eye}
            kind="ghost"
            size="small"
            showTooltip={{ label: showPassword ? tools.string.HidePassword : tools.string.ShowPassword }}
            on:click={togglePassword}
          />
          <Button
            icon={IconCopy}
            kind="ghost"
            size="small"
            showTooltip={{ label: passwordCopied ? tools.string.Copied : tools.string.Copy }}
            on:click={copyPassword}
          />
        </div>
      {/if}
    </div>
  {/if}

  <div class="card-footer">
    <div class="open-buttons">
      <button class="open-primary-btn" on:click|stopPropagation={triggerOpen}>
        <span>Open</span>
        {#if (site.openMode ?? 'popup') === 'popup'}
          <span class="mode-tag">Popup</span>
        {:else if site.openMode === 'tab'}
          <span class="mode-tag">Tab</span>
        {:else}
          <span class="mode-tag">Window</span>
        {/if}
      </button>

      <div class="mode-shortcuts">
        <button
          type="button"
          class="shortcut-btn"
          title="Open inside Huly Popup"
          on:click={openPopup}
        >
          🗖
        </button>
        <button
          type="button"
          class="shortcut-btn"
          title="Open in Huly Tab"
          on:click={openTab}
        >
          ⧉
        </button>
        <button
          type="button"
          class="shortcut-btn"
          title="Open in New Window"
          on:click={openWindow}
        >
          ↗
        </button>
      </div>
    </div>

    {#if canEdit}
      <div class="move-group-wrap">
        <button
          type="button"
          class="move-btn"
          title="Swift / Move to group"
          on:click={toggleMoveMenu}
        >
          ⇄ Group
        </button>

        {#if showMoveMenu}
          <div class="move-menu" on:click|stopPropagation>
            <div class="move-menu-header">Move to group:</div>
            {#each availableGroups as g}
              <button
                type="button"
                class="move-item"
                class:active={g.id === site.group}
                on:click={(e) => moveToGroup(g.id, e)}
              >
                <span class="dot" style:background-color={g.color ?? '#3b82f6'}></span>
                <span>{g.name}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</article>

<style lang="scss">
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1.125rem;
    min-height: 11.5rem;
    background-color: var(--theme-button-default);
    border: 1px solid var(--theme-button-border);
    border-radius: 0.875rem;
    cursor: pointer;
    outline: none;
    transition: all 0.16s ease;

    &:hover,
    &:focus-visible {
      border-color: var(--theme-button-border-hover);
      background-color: var(--theme-button-hovered);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      transform: translateY(-2px);
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

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.625rem;
    border: 1px solid transparent;
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

  .group-pill {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background-color: var(--theme-bg-accent-color);
    border: 1px solid;
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

  .card-mgmt-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex-grow: 1;
  }

  .name {
    font-weight: 600;
    font-size: 1rem;
    color: var(--theme-caption-color);
  }

  .desc {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--theme-content-color);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .host-row {
    margin-top: 0.125rem;
  }

  .host {
    font-family: var(--mono-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }

  .creds {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--theme-button-border);
  }

  .cred-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  .cred-label {
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--theme-dark-color);
    min-width: 4.25rem;
  }

  .cred-value {
    flex-grow: 1;
    min-width: 0;
    font-family: var(--mono-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    font-size: 0.75rem;
    color: var(--theme-caption-color);
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--theme-button-border);
  }

  .open-buttons {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .open-primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    border: none;
    background-color: var(--primary-button-default);
    color: var(--primary-button-color, #fff);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.12s ease;

    &:hover {
      background-color: var(--primary-button-hover);
    }
  }

  .mode-tag {
    font-size: 0.625rem;
    opacity: 0.85;
    background: rgba(0, 0, 0, 0.2);
    padding: 0.0625rem 0.25rem;
    border-radius: 0.25rem;
  }

  .mode-shortcuts {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .shortcut-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    border: 1px solid transparent;
    background: transparent;
    color: var(--theme-dark-color);
    cursor: pointer;
    font-size: 0.8125rem;
    transition: all 0.12s ease;

    &:hover {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
      border-color: var(--theme-button-border);
    }
  }

  .move-group-wrap {
    position: relative;
  }

  .move-btn {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--theme-button-border);
    background-color: var(--theme-button-default);
    color: var(--theme-dark-color);
    font-size: 0.6875rem;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
    }
  }

  .move-menu {
    position: absolute;
    bottom: calc(100% + 0.25rem);
    right: 0;
    min-width: 10rem;
    background-color: var(--theme-navpanel-color);
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.5rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    padding: 0.375rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .move-menu-header {
    font-size: 0.625rem;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--theme-dark-color);
    padding: 0.25rem 0.5rem;
  }

  .move-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    border-radius: 0.25rem;
    border: none;
    background: transparent;
    color: var(--theme-content-color);
    font-size: 0.75rem;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s ease;

    &:hover {
      background-color: var(--theme-button-hovered);
      color: var(--theme-caption-color);
    }
    &.active {
      font-weight: 600;
      color: var(--theme-caption-color);
    }
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    flex-shrink: 0;
  }
</style>
