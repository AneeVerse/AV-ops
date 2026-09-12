import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { publicUrlFromFilePath } from '@/lib/imagekit'
import { recreateScreen } from '@/lib/ui-walkthrough/recreate-screen'
import type { WalkthroughScene } from '@/lib/ui-walkthrough/types'

export const maxDuration = 180

const MAX_SCREENS = 10

interface ScreenInputBody {
  storagePath: string
  order: number
  narration: string
}

/**
 * Analysis-only step, before the user commits to building the final animation. One AI
 * call per screen — recreateScreen() both recreates the UI structure as HTML/CSS/JS AND
 * marks interactive elements inline (data-uiw attributes), so there's no separate
 * element-locator call. Doesn't write anything to the DB — nothing is final yet. Used
 * both for the initial "analyze all screens" pass and "regenerate this one screen" (same
 * shape, one-item array).
 */
export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = await req.json() as { screens?: ScreenInputBody[] }
    const { screens } = body

    if (!Array.isArray(screens) || screens.length === 0) {
      return NextResponse.json({ error: 'At least one screen is required' }, { status: 400 })
    }
    if (screens.length > MAX_SCREENS) {
      return NextResponse.json({ error: `At most ${MAX_SCREENS} screens are supported` }, { status: 400 })
    }

    const scenes: WalkthroughScene[] = await Promise.all(
      screens.map(async screen => {
        const imageUrl = publicUrlFromFilePath(screen.storagePath)
        const narration = screen.narration || ''
        const recreatedHtml = await recreateScreen(imageUrl, narration)
        return { order: screen.order, imageUrl, recreatedHtml, narration }
      })
    )

    return NextResponse.json({ scenes })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
