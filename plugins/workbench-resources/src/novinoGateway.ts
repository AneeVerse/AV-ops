//
// Copyright © 2026 AneeVerse
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//

export const NOVINO_SESSION_STORAGE_KEY = 'aneeverse.novino.sessionKey'
export const NOVINO_DEFAULT_SESSION = 'agent:novino:main'

export interface NovinoChatMessage {
  id: string
  role: string
  text: string
  timestamp: string | number | null
}

export interface NovinoHistoryResult {
  sessionKey: string
  sessionId: string | null
  messages: NovinoChatMessage[]
}

export interface NovinoSendResult {
  sessionKey: string
  messages?: NovinoChatMessage[]
}

export interface NovinoNewResult {
  sessionKey: string
}

function isNovinoSessionKey (value: string): boolean {
  return value.startsWith('agent:novino:')
}

export function readNovinoSessionKey (): string {
  try {
    const stored = localStorage.getItem(NOVINO_SESSION_STORAGE_KEY)?.trim() ?? ''
    if (stored !== '' && isNovinoSessionKey(stored)) {
      return stored
    }
  } catch {
    // private mode / blocked storage
  }
  return NOVINO_DEFAULT_SESSION
}

export function writeNovinoSessionKey (sessionKey: string): void {
  if (!isNovinoSessionKey(sessionKey)) {
    return
  }
  try {
    localStorage.setItem(NOVINO_SESSION_STORAGE_KEY, sessionKey)
  } catch {
    // private mode / blocked storage
  }
}

async function postNovino<T> (path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/_novino/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data: { error?: string } = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' && data.error !== '' ? data.error : `Novino request failed (${response.status})`)
  }
  return data as T
}

export async function loadNovinoHistory (sessionKey: string): Promise<NovinoHistoryResult> {
  return await postNovino<NovinoHistoryResult>('history', { sessionKey })
}

export async function sendNovinoMessage (sessionKey: string, message: string): Promise<NovinoSendResult> {
  return await postNovino<NovinoSendResult>('send', { sessionKey, message })
}

export async function createNovinoSession (): Promise<NovinoNewResult> {
  return await postNovino<NovinoNewResult>('new', {})
}

function sleep (ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function countNovinoAssistantReplies (messages: NovinoChatMessage[]): number {
  return messages.filter((message) => message.role === 'assistant' && message.text.trim() !== '').length
}

export const NOVINO_ASSISTANT_WAIT_MS = 120000

/**
 * chat.send can ack (and history already includes the user bubble) before the
 * assistant finishes tool calls. Poll until a new non-empty assistant message
 * appears, or until timeoutMs.
 */
export async function waitForNovinoHistory (
  sessionKey: string,
  previousAssistantCount: number,
  timeoutMs = NOVINO_ASSISTANT_WAIT_MS
): Promise<{ history: NovinoHistoryResult, timedOut: boolean }> {
  const deadline = Date.now() + timeoutMs
  let last = await loadNovinoHistory(sessionKey)
  while (Date.now() < deadline) {
    if (countNovinoAssistantReplies(last.messages) > previousAssistantCount) {
      return { history: last, timedOut: false }
    }
    await sleep(1500)
    last = await loadNovinoHistory(sessionKey)
  }
  return { history: last, timedOut: true }
}
