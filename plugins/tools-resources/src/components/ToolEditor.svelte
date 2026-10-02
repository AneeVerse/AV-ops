<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import core, { type DocumentUpdate } from '@hcengineering/core'
  import { Card, getClient, MessageBox } from '@hcengineering/presentation'
  import {
    DEFAULT_GROUPS,
    hostFromHref,
    isValidToolHref,
    type Tool,
    type ToolGroup,
    type ToolGroupDefinition
  } from '@hcengineering/tools'
  import {
    Button,
    DropdownLabels,
    EditBox,
    Label,
    showPopup,
    type DropdownTextItem
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'

  import tools from '../plugin'
  import GroupEditor from './GroupEditor.svelte'

  export let value: Tool | undefined = undefined
  export let availableGroups: ToolGroupDefinition[] = DEFAULT_GROUPS
  export let defaultGroup: string = 'tools'

  const dispatch = createEventDispatcher()
  const client = getClient()

  let name = value?.name ?? ''
  let href = value?.href ?? ''
  let description = value?.description ?? ''
  let group: ToolGroup = value?.group ?? defaultGroup
  let openMode: 'popup' | 'tab' | 'window' = value?.openMode ?? 'popup'
  let login = value?.login ?? ''
  let password = value?.password ?? ''
  let showPassword = false

  $: groupItems = [
    ...availableGroups.map((g) => ({
      id: g.id,
      label: g.name
    })),
    { id: '__new_group__', label: '+ Create new group...' }
  ] as DropdownTextItem[]

  const openModeItems: DropdownTextItem[] = [
    { id: 'popup', label: 'Huly popup modal (Inside Huly)' },
    { id: 'tab', label: 'Huly embedded tab' },
    { id: 'window', label: 'New browser window (External)' }
  ]

  $: canSave = name.trim().length > 0 && isValidToolHref(href)
  $: isValidUrl = href.trim() === '' || isValidToolHref(href)

  async function save (): Promise<void> {
    const derived = hostFromHref(href)
    const data = {
      name: name.trim(),
      description: description.trim(),
      href: href.trim(),
      host: derived.host,
      group,
      https: derived.https,
      openMode,
      login: login.trim(),
      password: password.trim()
    }

    if (value === undefined) {
      await client.createDoc(tools.class.Tool, core.space.Workspace, {
        ...data,
        order: Date.now()
      })
      dispatch('close')
      return
    }

    const documentUpdate: DocumentUpdate<Tool> = {}
    if (data.name !== value.name) documentUpdate.name = data.name
    if (data.description !== value.description) documentUpdate.description = data.description
    if (data.href !== value.href) documentUpdate.href = data.href
    if (data.host !== value.host) documentUpdate.host = data.host
    if (data.group !== value.group) documentUpdate.group = data.group
    if (data.https !== value.https) documentUpdate.https = data.https
    if (data.openMode !== value.openMode) (documentUpdate as any).openMode = data.openMode
    if (data.login !== value.login) documentUpdate.login = data.login
    if (data.password !== value.password) documentUpdate.password = data.password

    if (Object.keys(documentUpdate).length > 0) {
      await client.update(value, documentUpdate)
    }
    dispatch('close')
  }

  function confirmDelete (): void {
    if (value === undefined) return
    const target = value
    showPopup(
      MessageBox,
      {
        label: tools.string.DeleteTool,
        message: tools.string.DeleteToolConfirm,
        action: async () => {
          await client.remove(target)
          dispatch('close')
        }
      },
      'top'
    )
  }

  function selectGroup (event: CustomEvent<string | number | Array<string | number>>): void {
    const id = String(event.detail)
    if (id === '__new_group__') {
      showPopup(GroupEditor, {}, 'top', () => {
        // GroupEditor closed
      })
      return
    }
    group = id
  }

  function selectOpenMode (event: CustomEvent<string | number | Array<string | number>>): void {
    const id = String(event.detail)
    if (id === 'popup' || id === 'tab' || id === 'window') {
      openMode = id
    }
  }
</script>

<Card
  label={value === undefined ? tools.string.AddTool : tools.string.EditTool}
  okLabel={tools.string.SaveTool}
  okAction={save}
  {canSave}
  width={'small'}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  <div class="form">
    <div class="field">
      <span class="label"><Label label={tools.string.Name} /></span>
      <EditBox bind:value={name} placeholder={tools.string.ToolNamePlaceholder} autoFocus fullSize />
    </div>

    <div class="field">
      <div class="field-header">
        <span class="label"><Label label={tools.string.Url} /></span>
        {#if !isValidUrl}
          <span class="error-hint">Must start with http:// or https://</span>
        {/if}
      </div>
      <EditBox bind:value={href} placeholder={tools.string.UrlPlaceholder} fullSize />
    </div>

    <div class="field">
      <span class="label"><Label label={tools.string.Description} /></span>
      <EditBox bind:value={description} placeholder={tools.string.Description} fullSize />
    </div>

    <div class="field">
      <span class="label"><Label label={tools.string.Group} /></span>
      <DropdownLabels
        kind="regular"
        size="medium"
        items={groupItems}
        selected={group}
        on:selected={selectGroup}
      />
    </div>

    <div class="field">
      <span class="label"><Label label={tools.string.OpenMode} /></span>
      <DropdownLabels
        kind="regular"
        size="medium"
        items={openModeItems}
        selected={openMode}
        on:selected={selectOpenMode}
      />
    </div>

    <div class="field">
      <span class="label"><Label label={tools.string.Login} /></span>
      <EditBox bind:value={login} placeholder={tools.string.LoginPlaceholder} fullSize />
    </div>

    <div class="field">
      <span class="label"><Label label={tools.string.Password} /></span>
      <div class="password-row">
        <EditBox
          bind:value={password}
          placeholder={tools.string.PasswordPlaceholder}
          format={showPassword ? 'text' : 'password'}
          fullSize
        />
        <Button
          kind="ghost"
          size="small"
          label={showPassword ? tools.string.HidePassword : tools.string.ShowPassword}
          on:click={() => {
            showPassword = !showPassword
          }}
        />
      </div>
    </div>
  </div>

  <svelte:fragment slot="footer">
    {#if value !== undefined}
      <Button kind="dangerous" size="large" label={tools.string.DeleteTool} on:click={confirmDelete} />
    {/if}
  </svelte:fragment>
</Card>

<style lang="scss">
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .field-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--theme-dark-color);
  }
  .error-hint {
    font-size: 0.6875rem;
    color: var(--theme-warning-color, #f43f5e);
  }
  .password-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
