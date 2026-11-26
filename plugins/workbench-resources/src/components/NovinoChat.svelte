<!--
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
-->
<script lang="ts">
  import { translateCB } from '@hcengineering/platform'
  import { Breadcrumbs, Button, Header, Label, Loading, Scroller, themeStore } from '@hcengineering/ui'
  import { onMount } from 'svelte'

  import {
    countNovinoAssistantReplies,
    createNovinoSession,
    loadNovinoHistory,
    readNovinoSessionKey,
    sendNovinoMessage,
    waitForNovinoHistory,
    writeNovinoSessionKey,
    type NovinoChatMessage,
    type NovinoHistoryResult
  } from '../novinoGateway'
  import workbench from '../plugin'

  let sessionKey = readNovinoSessionKey()
  let messages: NovinoChatMessage[] = []
  let draft = ''
  let loading = true
  let sending = false
  let error: string | null = null
  let errorStatus = ''
  let failedSend: string | null = null
  let placeholder = ''
  let scroller: { divScroll?: HTMLElement | null } | undefined
  let composer: HTMLTextAreaElement | undefined

  $: translateCB(workbench.string.MessageNovino, {}, $themeStore.language, (value) => {
    placeholder = value
  })

  $: visibleMessages = messages.filter(
    (message) =>
      (message.role === 'user' || message.role === 'assistant') && message.text.trim() !== ''
  )

  onMount(() => {
    void refreshHistory()
  })

  function scrollToBottom (): void {
    requestAnimationFrame(() => {
      const box = scroller?.divScroll
      if (box !== undefined && box !== null) {
        box.scrollTop = box.scrollHeight
      }
    })
  }

  function noteOffline (err: unknown, resend: string | null): void {
    const message = err instanceof Error ? err.message : String(err)
    errorStatus = message.match(/\((\d{3})\)/)?.[1] ?? ''
    error = 'The assistant is offline right now'
    failedSend = resend
    console.error('Novino assistant request failed', errorStatus === '' ? message : errorStatus)
  }

  async function retryAssistant (): Promise<void> {
    const resend = failedSend
    failedSend = null
    error = null
    errorStatus = ''
    if (resend != null) {
      draft = resend
      await handleSend()
      return
    }
    await refreshHistory()
  }

  async function refreshHistory (): Promise<void> {
    loading = true
    error = null
    try {
      const result = await loadNovinoHistory(sessionKey)
      sessionKey = result.sessionKey
      writeNovinoSessionKey(sessionKey)
      messages = result.messages
      scrollToBottom()
    } catch (err) {
      noteOffline(err, null)
    } finally {
      loading = false
    }
  }

  async function handleNewChat (): Promise<void> {
    if (sending) {
      return
    }
    loading = true
    error = null
    try {
      const result = await createNovinoSession()
      sessionKey = result.sessionKey
      writeNovinoSessionKey(sessionKey)
      messages = []
    } catch (err) {
      noteOffline(err, null)
    } finally {
      loading = false
      composer?.focus()
    }
  }

  async function handleSend (): Promise<void> {
    const text = draft.trim()
    if (text === '' || sending || loading) {
      return
    }
    const previousAssistantCount = countNovinoAssistantReplies(messages)
    sending = true
    error = null
    draft = ''
    const optimistic: NovinoChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now()
    }
    messages = [...messages, optimistic]
    scrollToBottom()
    try {
      const result = await sendNovinoMessage(sessionKey, text)
      sessionKey = result.sessionKey
      writeNovinoSessionKey(sessionKey)
      let history: NovinoHistoryResult
      let timedOut = false
      if (result.messages != null && countNovinoAssistantReplies(result.messages) > previousAssistantCount) {
        history = { sessionKey, sessionId: null, messages: result.messages }
      } else {
        const waited = await waitForNovinoHistory(sessionKey, previousAssistantCount)
        history = waited.history
        timedOut = waited.timedOut
      }
      messages = history.messages.length > 0 ? history.messages : [...messages, ...(result.messages ?? [])]
      if (timedOut) {
        noteOffline(new Error('Novino request failed (504)'), text)
      }
      scrollToBottom()
    } catch (err) {
      noteOffline(err, text)
      messages = messages.filter((message) => message.id !== optimistic.id)
      if (draft.trim() === '') {
        draft = text
      }
    } finally {
      sending = false
      composer?.focus()
    }
  }

  function onComposerKeydown (event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  function bubbleClass (role: string): string {
    return role === 'user' ? 'novino-bubble user' : 'novino-bubble assistant'
  }
</script>

<div class="novino-widget">
  <Header
    allowFullsize={false}
    type="type-aside"
    hideBefore={true}
    hideActions={false}
    hideDescription={true}
    hideExtra={false}
    adaptive="autoExtra"
    closeOnEscape={false}
    on:close
  >
    <Breadcrumbs items={[{ label: workbench.string.Novino }]} currentOnly />
    <svelte:fragment slot="extra">
      <Button
        label={workbench.string.NewChat}
        kind="ghost"
        size="small"
        disabled={loading || sending}
        on:click={() => {
          void handleNewChat()
        }}
      />
    </svelte:fragment>
  </Header>

  <div class="novino-body">
    {#if loading && messages.length === 0}
      <Loading />
    {:else}
      <Scroller bind:this={scroller} autoscroll bottomStart padding=".75rem .75rem .5rem">
        {#if visibleMessages.length === 0 && !sending}
          <div class="novino-empty">
            <Label label={workbench.string.NovinoEmpty} />
          </div>
        {/if}
        {#each visibleMessages as message (message.id)}
          <div class={bubbleClass(message.role)}>
            <div class="novino-text">{message.text}</div>
          </div>
        {/each}
        {#if sending}
          <div class="novino-bubble assistant pending">
            <Loading shrink size="small" />
          </div>
        {/if}
      </Scroller>
    {/if}
  </div>

  {#if error !== null}
    <div class="novino-error">
      <div>{error}</div>
      {#if errorStatus !== ''}
        <div class="novino-status">{errorStatus}</div>
      {/if}
      <button type="button" on:click={() => { void retryAssistant() }}>Retry</button>
    </div>
  {/if}

  <form
    class="novino-composer"
    on:submit|preventDefault={() => {
      void handleSend()
    }}
  >
    <textarea
      bind:this={composer}
      bind:value={draft}
      {placeholder}
      disabled={sending}
      rows="2"
      on:keydown={onComposerKeydown}
    />
    <Button
      label={workbench.string.Send}
      kind="primary"
      size="medium"
      disabled={sending || draft.trim() === ''}
      loading={sending}
      on:click={() => {
        void handleSend()
      }}
    />
  </form>
</div>

<style lang="scss">
  .novino-widget {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
    font-family: var(--font-family);
    background-color: var(--theme-panel-color);
    color: var(--theme-content-color);
  }

  .novino-body {
    display: flex;
    flex: 1;
    min-height: 0;
    background-color: var(--theme-bg-color);
  }

  .novino-empty {
    padding: 1.5rem 0.5rem;
    text-align: center;
    color: var(--theme-text-placeholder-color);
    font-size: 0.8125rem;
  }

  .novino-bubble {
    max-width: 92%;
    margin: 0.35rem 0;
    padding: 0.55rem 0.7rem;
    border-radius: 0.75rem;
    font-size: 0.8125rem;
    line-height: 1.45;
    word-break: break-word;

    &.user {
      margin-left: auto;
      background-color: var(--primary-button-default);
      color: var(--primary-button-color);
    }

    &.assistant {
      margin-right: auto;
      background-color: var(--theme-button-default);
      color: var(--theme-content-color);
      border: 1px solid var(--theme-button-border);
    }

    &.pending {
      display: flex;
      align-items: center;
      min-height: 2rem;
    }
  }

  .novino-text {
    white-space: pre-wrap;
  }

  .novino-error {
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
    color: var(--theme-error-color);
    background-color: var(--theme-bg-accent-color);
  }

  .novino-status {
    font-size: 0.7rem;
    opacity: 0.8;
  }

  .novino-composer {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    padding: 0.75rem;
    border-top: 1px solid var(--theme-divider-color);
    background-color: var(--theme-panel-color);

    textarea {
      flex: 1;
      min-height: 2.75rem;
      max-height: 8rem;
      resize: none;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--theme-button-border);
      border-radius: 0.5rem;
      background-color: var(--theme-bg-color);
      color: var(--theme-content-color);
      font-family: var(--font-family);
      font-size: 0.8125rem;
      line-height: 1.4;

      &::placeholder {
        color: var(--theme-text-placeholder-color);
      }

      &:focus {
        outline: none;
        border-color: var(--primary-button-default);
      }

      &:disabled {
        opacity: 0.7;
      }
    }
  }
</style>
