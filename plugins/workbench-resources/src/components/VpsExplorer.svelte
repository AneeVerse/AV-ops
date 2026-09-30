<!--
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
-->
<script lang="ts">
  import { type Widget } from '@hcengineering/workbench'
  import { Breadcrumbs, Button, Header, IconFile, IconFolder, IconOpen, Label, Scroller } from '@hcengineering/ui'

  import workbench from '../plugin'
  import { sidebarStore, updateWidgetState } from '../sidebar'
  import { VPS_CATALOG, findVpsNode, vpsPathTo, type VpsNode } from '../vpsCatalog'

  export let widget: Widget | undefined = undefined

  let currentId: string | undefined = undefined
  let restored = false

  $: widgetState = widget !== undefined ? $sidebarStore.widgetsState.get(widget._id) : undefined
  $: if (!restored && widgetState?.data?.currentId !== undefined) {
    currentId = widgetState.data.currentId as string | undefined
    restored = true
  }

  $: trail = vpsPathTo(currentId)
  $: current = currentId === undefined ? undefined : findVpsNode(currentId)
  $: listing = current === undefined || current.kind === 'folder'
  $: children = current === undefined ? VPS_CATALOG : (current.children ?? [])
  $: crumbs = [
    { id: 'root', label: workbench.string.Vps },
    ...trail.map((node) => ({ id: node.id, title: node.name }))
  ]

  function setCurrent (id: string | undefined): void {
    currentId = id
    if (widget === undefined) return
    updateWidgetState(widget._id, {
      data: { ...(widgetState?.data ?? {}), currentId: id }
    })
  }

  function selectCrumb (index: number): void {
    if (index <= 0) {
      setCurrent(undefined)
      return
    }
    setCurrent(trail[index - 1]?.id)
  }

  function openHref (href: string): void {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
</script>

<div class="vps-widget">
  <Header
    allowFullsize={false}
    type="type-aside"
    hideBefore={true}
    hideActions={true}
    hideDescription={true}
    hideExtra={true}
    adaptive="autoExtra"
    closeOnEscape={false}
    on:close
  >
    <Breadcrumbs
      items={crumbs}
      size="small"
      selected={crumbs.length - 1}
      on:select={(event) => {
        selectCrumb(event.detail)
      }}
    />
  </Header>

  <div class="vps-body">
    <p class="vps-hint"><Label label={workbench.string.VpsHint} /></p>
    {#if listing}
      <Scroller padding="0 0.25rem 0.75rem">
        {#if children.length === 0}
          <div class="vps-empty"><Label label={workbench.string.VpsEmpty} /></div>
        {:else}
          <ul class="vps-list">
            {#each children as node (node.id)}
              <li>
                <button
                  type="button"
                  class="vps-row"
                  on:click={() => {
                    setCurrent(node.id)
                  }}
                >
                  <span class="vps-icon">
                    {#if node.kind === 'folder' || (node.children?.length ?? 0) > 0}
                      <IconFolder size="small" />
                    {:else}
                      <IconFile size="small" />
                    {/if}
                  </span>
                  <span class="vps-copy">
                    <span class="vps-name">{node.name}</span>
                    {#if node.note}
                      <span class="vps-note">{node.note}</span>
                    {/if}
                  </span>
                  <span class="vps-open">›</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </Scroller>
    {:else if current !== undefined}
      <div class="vps-detail">
        <div class="vps-name">{current.name}</div>
        {#if current.note}
          <div class="vps-note">{current.note}</div>
        {/if}
        {#if current.href}
          <div class="vps-actions">
            <Button
              icon={IconOpen}
              label={workbench.string.Open}
              kind="primary"
              size="small"
              on:click={() => {
                openHref(current.href ?? '')
              }}
            />
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .vps-widget {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
    height: 100%;
  }
  .vps-body {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-height: 0;
  }
  .vps-hint {
    flex-shrink: 0;
    margin: 0;
    padding: 0.5rem 0.85rem 0.35rem;
    color: var(--theme-dark-color);
    font-size: 0.75rem;
  }
  .vps-empty {
    padding: 2rem 0.85rem;
    color: var(--theme-dark-color);
    text-align: center;
  }
  .vps-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .vps-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    margin: 0;
    padding: 0.55rem 0.7rem;
    border: none;
    border-radius: 0.35rem;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--theme-button-hovered);
    }
  }
  .vps-icon {
    display: flex;
    flex-shrink: 0;
    color: var(--theme-dark-color);
  }
  .vps-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex-grow: 1;
  }
  .vps-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--theme-caption-color);
    font-size: 0.8125rem;
  }
  .vps-note {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--theme-dark-color);
    font-size: 0.6875rem;
  }
  .vps-open {
    flex-shrink: 0;
    color: var(--theme-dark-color);
    font-size: 1.1rem;
    line-height: 1;
  }
  .vps-detail {
    margin: 0.35rem 0.85rem 1rem;
    padding: 0.85rem 0.9rem;
    border-radius: 0.4rem;
    background: var(--theme-button-hovered);
  }
  .vps-actions {
    margin-top: 0.75rem;
  }
</style>
