import { NextRequest, NextResponse } from 'next/server'
import { findLocalPlace } from '@/lib/us-places'

type Coordinates = [number, number]

const cache = new Map<string, Coordinates | null>()
let requestQueue = Promise.resolve()
let lastRequestAt = 0

function parseCity(value: string): { city: string; state: string } | null {
  const match = value.trim().match(/^(.+?),\s*([A-Za-z]{2})$/)
  if (!match) return null
  return { city: match[1].trim(), state: match[2].toUpperCase() }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function lookupCity(city: string, state: string): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    city,
    state,
    country: 'United States',
    countrycodes: 'us',
    format: 'jsonv2',
    limit: '1',
  })

  // The public Nominatim service permits at most one request per second.
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < 1000) await wait(1000 - elapsed)
  lastRequestAt = Date.now()

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'User-Agent': 'ContentBeta-MapGraphics/1.0',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`)

  const results = await response.json() as Array<{ lon?: string; lat?: string }>
  const longitude = Number(results[0]?.lon)
  const latitude = Number(results[0]?.lat)
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    ? [longitude, latitude]
    : null
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? ''
  const parsed = parseCity(query)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Enter a city and two-letter state, for example: Tyler, TX' },
      { status: 400 },
    )
  }

  const key = `${parsed.city.toLowerCase()}, ${parsed.state}`
  if (cache.has(key)) {
    return NextResponse.json({ coordinates: cache.get(key) })
  }

  const localPlace = findLocalPlace(`${parsed.city}, ${parsed.state}`)
  if (localPlace) {
    const coordinates: Coordinates = [localPlace[1], localPlace[2]]
    cache.set(key, coordinates)
    return NextResponse.json({ coordinates })
  }

  try {
    let coordinates: Coordinates | null = null
    const queuedLookup = requestQueue.then(async () => {
      coordinates = await lookupCity(parsed.city, parsed.state)
    })
    requestQueue = queuedLookup.catch(() => undefined)
    await queuedLookup
    cache.set(key, coordinates)
    return NextResponse.json({ coordinates })
  } catch {
    return NextResponse.json({ error: 'City lookup is temporarily unavailable' }, { status: 503 })
  }
}
