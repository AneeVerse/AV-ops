'use client'
import { sb } from './supabase'

export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await sb.auth.getSession()
  const token = session?.access_token
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
