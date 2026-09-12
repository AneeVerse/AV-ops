/** Central n8n base URL. Per-path env vars override individual webhooks. */
export const N8N_BASE_URL = (
  process.env.N8N_BASE_URL ||
  process.env.N8N_API_URL ||
  'https://n8n.aneeverse.com'
).replace(/\/$/, '')

export function n8nWebhook(path: string, envOverride?: string | null): string {
  if (envOverride) return envOverride
  const cleaned = path.replace(/^\/+/, '').replace(/^webhook\//, '')
  return `${N8N_BASE_URL}/webhook/${cleaned}`
}
