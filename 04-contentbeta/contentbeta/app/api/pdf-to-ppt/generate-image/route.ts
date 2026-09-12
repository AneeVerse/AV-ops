import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { uploadBuffer } from '@/lib/imagekit'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const { prompt, slideId, brandId } = await req.json() as {
      prompt: string
      slideId: string
      brandId: string
    }

    if (!prompt || !slideId) {
      return NextResponse.json({ error: 'prompt and slideId required' }, { status: 400 })
    }

    // Fetch brand style and global image style suffix in parallel
    const [brandRow, styleRow] = await Promise.all([
      brandId
        ? supabase.from('brand_profiles').select('style_prompt,ppt_md').eq('brand_id', brandId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('ppt_system_prompts').select('content').eq('name', 'image_style').maybeSingle(),
    ])

    const brandStyle = (brandRow.data as { style_prompt?: string; ppt_md?: string } | null)
    const brandContext = brandStyle?.style_prompt?.trim() || ''
    const styleSuffix = (styleRow.data as { content?: string } | null)?.content?.trim() ?? ''

    // Build final prompt: brand style context → slide-specific prompt → global style suffix
    const parts = [
      brandContext ? `Brand visual style: ${brandContext}` : '',
      prompt,
      styleSuffix,
    ].filter(Boolean)
    // OpenAI gpt-image-2 max prompt length is 32000 chars — truncate to be safe
    const finalPrompt = parts.join('\n\n').slice(0, 31000)

    const callOpenAi = async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 130_000) // two attempts (260s) must fit inside maxDuration=300
      try {
        return await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-2',
            prompt: finalPrompt,
            n: 1,
            size: '1536x1024',
            quality: 'medium',
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
    }

    // Concurrent image requests routinely push OpenAI past a single attempt's
    // latency — retry once on abort/network/5xx/429 before giving up.
    let res: Response
    try {
      res = await callOpenAi()
      if (!res.ok && (res.status === 429 || res.status >= 500)) throw new Error(`retryable status ${res.status}`)
    } catch {
      res = await callOpenAi()
    }

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`OpenAI image error (${res.status}): ${err.slice(0, 300)}`)
    }

    const data = await res.json() as { data: { b64_json: string }[] }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('No image returned from OpenAI')

    const buf = Buffer.from(b64, 'base64')
    const fileName = `${slideId}_${Date.now()}.png`
    const uploaded = await uploadBuffer({
      buffer: buf,
      fileName,
      folder: 'generated-posts',
      contentType: 'image/png',
    })

    return NextResponse.json({ url: uploaded.url })
  } catch (err) {
    console.error('PPT image generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
