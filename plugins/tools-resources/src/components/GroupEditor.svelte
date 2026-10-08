<!--
// Copyright © 2026 AneeVerse
-->
<script lang="ts">
  import core, { type DocumentUpdate } from '@hcengineering/core'
  import { Card, getClient, MessageBox } from '@hcengineering/presentation'
  import type { Tool, ToolGroupDefinition } from '@hcengineering/tools'
  import { Button, EditBox, Label, showPopup } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'

  import tools from '../plugin'

  export let group: ToolGroupDefinition | undefined = undefined
  export let groupDoc: Tool | undefined = undefined

  const dispatch = createEventDispatcher()
  const client = getClient()

  let name = group?.name ?? groupDoc?.name ?? ''
  let hint = group?.hint ?? groupDoc?.description ?? ''
  let color = group?.color ?? groupDoc?.color ?? '#3b82f6'

  const presetColors = [
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Emerald', value: '#10b981' },
    { label: 'Purple', value: '#8b5cf6' },
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Rose', value: '#f43f5e' },
    { label: 'Cyan', value: '#06b6d4' },
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Slate', value: '#64748b' }
  ]

  function slugify (text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  }

  $: canSave = name.trim().length > 0

  async function save (): Promise<void> {
    if (!canSave) return
    const trimmedName = name.trim()
    const trimmedHint = hint.trim()
    const slug = group?.id ?? groupDoc?.host ?? slugify(trimmedName)
    const docId = `tools:group:${slug}` as any

    if (groupDoc !== undefined) {
      const update: DocumentUpdate<Tool> = {}
      if (trimmedName !== groupDoc.name) update.name = trimmedName
      if (trimmedHint !== groupDoc.description) update.description = trimmedHint
      if (color !== groupDoc.color) update.color = color
      if (Object.keys(update).length > 0) {
        await client.update(groupDoc, update)
      }
      dispatch('close')
      return
    }

    // Check if doc already exists
    const existing = await client.findOne(tools.class.Tool, { _id: docId })
    if (existing !== undefined) {
      await client.update(existing, {
        name: trimmedName,
        description: trimmedHint,
        color
      })
    } else {
      await client.createDoc(
        tools.class.Tool,
        core.space.Workspace,
        {
          name: trimmedName,
          description: trimmedHint,
          href: `group:${slug}`,
          host: slug,
          group: '__group__',
          https: true,
          color,
          order: Date.now()
        },
        docId
      )
    }

    dispatch('close')
  }

  function confirmDelete (): void {
    const slug = group?.id ?? groupDoc?.host
    showPopup(
      MessageBox,
      {
        label: tools.string.DeleteGroup,
        message: tools.string.DeleteGroupConfirm,
        dangerous: true,
        action: async () => {
          try {
            if (groupDoc !== undefined) {
              await client.remove(groupDoc)
            } else if (slug) {
              const existing = await client.findOne(tools.class.Tool, { _id: `tools:group:${slug}` as any })
              if (existing !== undefined) {
                await client.remove(existing)
              }
            }
            if (slug) {
              const inGroup = await client.findAll(tools.class.Tool, { group: slug as any })
              for (const t of inGroup) {
                if (t._id !== `tools:group:${slug}`) {
                  await client.update(t, { group: 'tools' })
                }
              }
            }
          } catch (err) {
            console.error('Failed to delete group:', err)
          }
          dispatch('close')
        }
      },
      'top'
    )
  }
</script>

<Card
  label={groupDoc === undefined && group === undefined ? tools.string.AddGroup : tools.string.EditGroup}
  okLabel={tools.string.SaveGroup}
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
      <span class="label"><Label label={tools.string.GroupName} /></span>
      <EditBox bind:value={name} placeholder={tools.string.GroupNamePlaceholder} autoFocus fullSize />
    </div>

    <div class="field">
      <span class="label"><Label label={tools.string.Description} /></span>
      <EditBox bind:value={hint} placeholder={tools.string.GroupHintPlaceholder} fullSize />
    </div>

    <div class="field">
      <span class="label"><Label label={tools.string.Color} /></span>
      <div class="colors-row">
        {#each presetColors as item}
          <button
            type="button"
            class="color-btn"
            class:selected={color === item.value}
            style:background-color={item.value}
            aria-label={item.label}
            on:click={() => {
              color = item.value
            }}
          ></button>
        {/each}
      </div>
    </div>
  </div>

  <svelte:fragment slot="footer">
    {#if groupDoc !== undefined || group !== undefined}
      <Button kind="dangerous" size="large" label={tools.string.DeleteGroup} on:click={confirmDelete} />
    {/if}
  </svelte:fragment>
</Card>

<style lang="scss">
  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--theme-dark-color);
  }
  .colors-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-top: 0.25rem;
  }
  .color-btn {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.12s ease, border-color 0.12s ease;
    padding: 0;

    &:hover {
      transform: scale(1.15);
    }
    &.selected {
      border-color: #ffffff;
      box-shadow: 0 0 0 2px var(--theme-button-border-hover);
      transform: scale(1.1);
    }
  }
</style>
