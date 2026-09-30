<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import type { Asset } from '@hcengineering/platform'
  import { copyTextToClipboard } from '@hcengineering/presentation'
  import type { Tool, ToolGroup } from '@hcengineering/tools'
  import { Button, Icon, IconCopy, IconEdit, Label, showPopup } from '@hcengineering/ui'
  import view from '@hcengineering/view'

  import tools from '../plugin'
  import ToolEditor from './ToolEditor.svelte'

  export let site: Tool
  export let canEdit = false

  const groupIcon: Record<ToolGroup, Asset> = {
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

  $: login = site.login?.trim() ?? ''
  $: password = site.password?.trim() ?? ''
  $: hasCredentials = login !== '' || password !== ''

  function onKey (event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  }

  function openEdit (event: MouseEvent): void {
    event.stopPropagation()
    showPopup(ToolEditor, { value: site }, 'top')
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
  on:click
  on:keydown={onKey}
>
  <div class="card-top">
    <div class="icon">
      <Icon icon={groupIcon[site.group]} size={'small'} />
    </div>
    <div class="badges">
      {#if canEdit}
        <Button
          icon={IconEdit}
          kind="ghost"
          size="small"
          showTooltip={{ label: tools.string.EditTool }}
          on:click={openEdit}
        />
      {/if}
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
  .creds {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-top: 0.375rem;
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
</style>
