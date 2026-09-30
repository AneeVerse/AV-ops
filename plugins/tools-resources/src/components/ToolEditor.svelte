<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import core, { type DocumentUpdate } from '@hcengineering/core'
  import { Card, getClient, MessageBox } from '@hcengineering/presentation'
  import {
    hostFromHref,
    isValidToolHref,
    TOOL_GROUPS,
    type Tool,
    type ToolGroup
  } from '@hcengineering/tools'
  import {
    Button,
    DropdownLabelsIntl,
    EditBox,
    Label,
    showPopup,
    type DropdownIntlItem
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'

  import tools from '../plugin'

  export let value: Tool | undefined = undefined

  const dispatch = createEventDispatcher()
  const client = getClient()

  let name = value?.name ?? ''
  let href = value?.href ?? ''
  let description = value?.description ?? ''
  let group: ToolGroup = value?.group ?? 'tools'
  let login = value?.login ?? ''
  let password = value?.password ?? ''
  let showPassword = false

  const groupItems: DropdownIntlItem[] = [
    { id: 'websites', label: tools.string.Websites },
    { id: 'studio', label: tools.string.Studio },
    { id: 'business', label: tools.string.BusinessApps },
    { id: 'tools', label: tools.string.BotsAndTools }
  ]

  $: canSave = name.trim().length > 0 && isValidToolHref(href)

  async function save (): Promise<void> {
    const derived = hostFromHref(href)
    const data = {
      name: name.trim(),
      description: description.trim(),
      href: href.trim(),
      host: derived.host,
      group,
      https: derived.https,
      login: login.trim(),
      password: password.trim()
    }
    if (value === undefined) {
      await client.createDoc(tools.class.Tool, core.space.Workspace, {
        ...data,
        order: Date.now()
      })
      return
    }
    const documentUpdate: DocumentUpdate<Tool> = {}
    if (data.name !== value.name) documentUpdate.name = data.name
    if (data.description !== value.description) documentUpdate.description = data.description
    if (data.href !== value.href) documentUpdate.href = data.href
    if (data.host !== value.host) documentUpdate.host = data.host
    if (data.group !== value.group) documentUpdate.group = data.group
    if (data.https !== value.https) documentUpdate.https = data.https
    if (data.login !== value.login) documentUpdate.login = data.login
    if (data.password !== value.password) documentUpdate.password = data.password
    if (Object.keys(documentUpdate).length > 0) {
      await client.update(value, documentUpdate)
    }
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
    if (TOOL_GROUPS.includes(id as ToolGroup)) {
      group = id as ToolGroup
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
      <span class="label"><Label label={tools.string.Url} /></span>
      <EditBox bind:value={href} placeholder={tools.string.UrlPlaceholder} fullSize />
    </div>
    <div class="field">
      <span class="label"><Label label={tools.string.Description} /></span>
      <EditBox bind:value={description} placeholder={tools.string.Description} fullSize />
    </div>
    <div class="field">
      <span class="label"><Label label={tools.string.Group} /></span>
      <DropdownLabelsIntl
        kind="regular"
        size="medium"
        items={groupItems}
        selected={group}
        on:selected={selectGroup}
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
  .label {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
  .password-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
