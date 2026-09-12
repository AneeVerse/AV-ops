import { NextRequest, NextResponse } from 'next/server'
import { normalizePlace, type UsPlace, usPlaces } from '@/lib/us-places'

export async function GET(request: NextRequest) {
  const query = normalizePlace(request.nextUrl.searchParams.get('q') ?? '')
  if (query.length < 2) return NextResponse.json({ places: [] })

  const matches: Array<{ place: UsPlace; score: number }> = []
  for (const place of usPlaces) {
    const label = normalizePlace(place[0])
    const cityName = label.split(',')[0]
    const score = label === query ? 0
      : cityName === query ? 1
        : label.startsWith(query) ? 2
          : label.includes(query) ? 3
            : -1
    if (score >= 0) matches.push({ place, score })
  }

  matches.sort((a, b) => a.score - b.score || a.place[0].localeCompare(b.place[0]))
  return NextResponse.json({ places: matches.slice(0, 12).map(match => match.place) })
}
