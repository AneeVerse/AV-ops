<!--
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
-->
<script lang="ts">
  import { IconClose } from '@hcengineering/ui'

  const chatUrl = 'https://chat.aneeverse.com/?agent=novino&embed=1'
  const openChatUrl = 'https://chat.aneeverse.com/?agent=novino'
  const storageKey = 'aneeverse.novinoChat.open'

  let open = false
  try {
    open = globalThis.localStorage?.getItem(storageKey) === '1'
  } catch {
    open = false
  }

  function toggle (): void {
    open = !open
    try {
      globalThis.localStorage?.setItem(storageKey, open ? '1' : '0')
    } catch {
      // ignore
    }
  }
</script>

<div class="novino-root">
  {#if open}
    <div class="novino-panel">
      <div class="novino-header">
        <div class="novino-title">
          <span class="novino-dot" />
          Novino
        </div>
        <div class="novino-actions">
          <a class="novino-link" href={openChatUrl} target="_blank" rel="noreferrer">Open</a>
          <button class="novino-icon" type="button" on:click={toggle} aria-label="Close Novino">
            <IconClose size={'small'} />
          </button>
        </div>
      </div>
      <iframe class="novino-frame" title="Novino" src={chatUrl} />
    </div>
  {:else}
    <button class="novino-fab" type="button" on:click={toggle} aria-label="Chat with Novino">
      <svg class="novino-fab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4 4h16a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H9.2L5 21.2V17.5H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 1.5A.5.5 0 0 0 3.5 6v9.5a.5.5 0 0 0 .5.5h2.5V19l3.2-2.4H20a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5H4Z"
        />
        <circle fill="currentColor" cx="8" cy="10.5" r="1.15" />
        <circle fill="currentColor" cx="12" cy="10.5" r="1.15" />
        <circle fill="currentColor" cx="16" cy="10.5" r="1.15" />
      </svg>
    </button>
  {/if}
</div>

<style lang="scss">
  .novino-root {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 500;
    pointer-events: none;
  }

  .novino-fab,
  .novino-panel,
  .novino-icon,
  .novino-link {
    pointer-events: auto;
  }

  .novino-fab {
    width: 3rem;
    height: 3rem;
    border: none;
    border-radius: 50%;
    background: var(--primary-button-default, #3370dc);
    color: var(--primary-button-color, #fff);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .novino-fab-icon {
    width: 1.45rem;
    height: 1.45rem;
  }

  .novino-panel {
    width: min(420px, calc(100vw - 2rem));
    height: min(560px, calc(100vh - 6rem));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 0.75rem;
    background: var(--theme-popup-color, #1b1b1f);
    border: 1px solid var(--theme-divider-color, #333);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  }

  .novino-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    border-bottom: 1px solid var(--theme-divider-color, #333);
  }

  .novino-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 600;
    color: var(--theme-caption-color, #fff);
  }

  .novino-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #3dd68c;
  }

  .novino-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .novino-link {
    font-size: 0.75rem;
    color: var(--theme-link-color, #7aa7ff);
    text-decoration: none;
  }

  .novino-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--theme-content-color, #ccc);
    cursor: pointer;
  }

  .novino-frame {
    flex: 1;
    width: 100%;
    border: 0;
    background: var(--theme-bg-color, #111);
  }
</style>
