'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { sb } from '@/lib/supabase'
import { uploadMedia } from '@/lib/media-upload'
import { useLightbox } from '@/lib/lightbox'

// ─── CITY DATABASE [longitude, latitude] ─────────────────────────
const CITIES: Record<string, [number, number]> = {
  'Laredo, TX': [-99.5075, 27.5064],
  'Chicago, IL': [-87.6298, 41.8781],
  'Houston, TX': [-95.3698, 29.7604],
  'Dallas, TX': [-96.797, 32.7767],
  'Fort Worth, TX': [-97.3308, 32.7555],
  'San Antonio, TX': [-98.4936, 29.4241],
  'El Paso, TX': [-106.485, 31.7619],
  'Atlanta, GA': [-84.388, 33.749],
  'North Metro Atlanta, GA': [-84.2, 34.05],
  'Savannah, GA': [-81.0998, 32.0835],
  'Birmingham, AL': [-86.8025, 33.5186],
  'Memphis, TN': [-90.049, 35.1495],
  'Nashville, TN': [-86.7816, 36.1627],
  'Knoxville, TN': [-83.9207, 35.9606],
  'Chattanooga, TN': [-85.3097, 35.0456],
  'Los Angeles, CA': [-118.2437, 34.0522],
  'Long Beach, CA': [-118.1937, 33.7701],
  'San Diego, CA': [-117.1611, 32.7157],
  'San Francisco, CA': [-122.4194, 37.7749],
  'Sacramento, CA': [-121.4944, 38.5816],
  'Fresno, CA': [-119.7871, 36.7378],
  'Seattle, WA': [-122.3321, 47.6062],
  'Portland, OR': [-122.675, 45.5051],
  'Phoenix, AZ': [-112.074, 33.4484],
  'Tucson, AZ': [-110.9742, 32.2226],
  'Las Vegas, NV': [-115.1398, 36.1699],
  'Salt Lake City, UT': [-111.891, 40.7608],
  'Denver, CO': [-104.9903, 39.7392],
  'Albuquerque, NM': [-106.6504, 35.0844],
  'Kansas City, MO': [-94.5786, 39.0997],
  'St. Louis, MO': [-90.1994, 38.627],
  'Minneapolis, MN': [-93.265, 44.9778],
  'Detroit, MI': [-83.0458, 42.3314],
  'Columbus, OH': [-82.9988, 39.9612],
  'Cleveland, OH': [-81.6944, 41.4993],
  'Cincinnati, OH': [-84.512, 39.1031],
  'Indianapolis, IN': [-86.1581, 39.7684],
  'Louisville, KY': [-85.7585, 38.2527],
  'Charlotte, NC': [-80.8431, 35.2271],
  'Rocky Mount, NC': [-77.7941, 35.9382],
  'Raleigh, NC': [-78.6382, 35.7796],
  'Greensboro, NC': [-79.791, 36.0726],
  'Charlottesville, VA': [-78.4767, 38.0293],
  'Richmond, VA': [-77.4605, 37.5407],
  'Norfolk, VA': [-76.2859, 36.8508],
  'Baltimore, MD': [-76.6122, 39.2904],
  'Philadelphia, PA': [-75.1652, 39.9526],
  'Pittsburgh, PA': [-79.9959, 40.4406],
  'New York, NY': [-74.006, 40.7128],
  'Brooklyn, NY': [-73.9442, 40.6782],
  'Newark, NJ': [-74.1724, 40.7357],
  'Buffalo, NY': [-78.8784, 42.8864],
  'Boston, MA': [-71.0589, 42.3601],
  'Miami, FL': [-80.1918, 25.7617],
  'Tampa, FL': [-82.4572, 27.9506],
  'Jacksonville, FL': [-81.6557, 30.3322],
  'Orlando, FL': [-81.3792, 28.5383],
  'New Orleans, LA': [-90.0715, 29.9511],
  'Little Rock, AR': [-92.2896, 34.7465],
  'Tulsa, OK': [-95.9928, 36.154],
  'Oklahoma City, OK': [-97.5164, 35.4676],
  'Omaha, NE': [-95.9345, 41.2565],
  'Des Moines, IA': [-93.6091, 41.5868],
  'Milwaukee, WI': [-87.9065, 43.0389],
  'Charleston, SC': [-79.9311, 32.7765],
  'Columbia, SC': [-81.0348, 33.9969],
  'Greenville, SC': [-82.3940, 34.8526],
  'Wichita, KS': [-97.3375, 37.6872],
  'Harrisburg, PA': [-76.8844, 40.2732],
  'Wilkes-Barre, PA': [-75.8817, 41.2465],
  'Albany, NY': [-73.7562, 42.6526],
  'Tyler, TX': [-95.3011, 32.3513],
}

const MODES = ['Dry Van', 'Reefer', 'Flatbed', 'Specialized', 'Hot Shot', 'Box Truck', 'Sprinter Van', 'Step Deck', 'Power Only']
const cityLookupCache = new Map<string, [number, number] | null>()

function cityKey(city: string) {
  return city.trim().replace(/\s+/g, ' ').toLowerCase()
}

function findCityCoords(city: string): [number, number] | undefined {
  if (!city.trim()) return undefined
  const direct = CITIES[city]
  if (direct) return direct
  const key = cityKey(city)
  const knownName = Object.keys(CITIES).find(name => cityKey(name) === key)
  return knownName ? CITIES[knownName] : cityLookupCache.get(key) ?? undefined
}

async function ensureCityCoords(city: string): Promise<[number, number] | null> {
  const value = city.trim()
  if (!value) return null
  const known = findCityCoords(value)
  if (known) {
    CITIES[value] = known
    return known
  }

  const key = cityKey(value)
  if (cityLookupCache.has(key)) return cityLookupCache.get(key) ?? null

  const response = await fetch(`/api/geocode-city?q=${encodeURIComponent(value)}`)
  if (!response.ok) return null
  const data = await response.json() as { coordinates?: [number, number] | null }
  const coordinates = data.coordinates ?? null
  cityLookupCache.set(key, coordinates)
  if (coordinates) CITIES[value] = coordinates
  return coordinates
}

// ─── TYPES ───────────────────────────────────────────────────────
type Template = 'hot_lane' | 'outbound' | 'hot_cold'
type Theme = 'dark' | 'light'

interface HotLaneForm {
  originCity: string
  destCity: string
  mode: string
  avgRate: string
  loadsAvailable: string
  pctChange30d: string
  pctChange7d: string
  truckLoadIndex: string
  weekOf: string
}

interface OutboundForm {
  cityName: string
  spotlightDest: string
  mode: string
  avgRatePerMile: string
  loadsAvailable: string
  pctIncreaseVs30d: string
  spotlightRate: string
  weekOf: string
}

interface HotColdForm {
  hotCity: string
  hotDest: string
  hotRate: string
  hotPct: string
  hotMode: string
  hotDirection: string
  coldCity: string
  coldDest: string
  coldRate: string
  coldPct: string
  coldMode: string
  coldDirection: string
  weekOf: string
}

// ─── MAP LIBS (lazy loaded once) ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let geoMod: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let topoMod: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let usTopoData: any = null

// ─── TRUCKMARK PATTERN (lazy loaded once) ────────────────────────
let truckmarkImg: HTMLImageElement | null = null
async function ensureTruckmarkImg(): Promise<HTMLImageElement | null> {
  if (truckmarkImg?.complete && truckmarkImg.naturalWidth > 0) return truckmarkImg
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => { truckmarkImg = img; resolve(img) }
    img.onerror = () => resolve(null)
    img.src = '/truckmark-pattern.jpg'
  })
}

let whitePatternImg: HTMLImageElement | null = null
async function ensureWhitePatternImg(): Promise<HTMLImageElement | null> {
  if (whitePatternImg?.complete && whitePatternImg.naturalWidth > 0) return whitePatternImg
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => { whitePatternImg = img; resolve(img) }
    img.onerror = () => resolve(null)
    img.src = '/white-pattern.jpg'
  })
}

async function ensureMapLibs() {
  if (!geoMod) geoMod = await import('d3-geo')
  if (!topoMod) topoMod = await import('topojson-client')
  if (!usTopoData) {
    const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
    usTopoData = await res.json()
  }
  return { geo: geoMod, topo: topoMod, data: usTopoData }
}

// ─── DRIVING ROUTE (OSRM — free, no API key) ─────────────────────
// Fetches the actual highway route between two coords from OSRM's public API.
// Results are cached in-memory so re-renders don't re-fetch.
const routeCache = new Map<string, [number, number][]>()

async function fetchDrivingRoute(
  origin: [number, number],
  dest: [number, number],
): Promise<[number, number][] | null> {
  const key = `${origin}-${dest}`
  if (routeCache.has(key)) return routeCache.get(key)!
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin[0]},${origin[1]};${dest[0]},${dest[1]}` +
      `?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const coords: [number, number][] | undefined = json?.routes?.[0]?.geometry?.coordinates
    if (coords?.length) { routeCache.set(key, coords); return coords }
  } catch { /* fall through to geodesic */ }
  return null
}

// ─── HELPERS ─────────────────────────────────────────────────────

function drawCityLabel(
  ctx: CanvasRenderingContext2D,
  cityStr: string,
  cx: number, cy: number,
  fillColor: string,
  mapLeft: number, mapRight: number,
  offsetY = -18,
) {
  const parts = cityStr.split(',')
  const label = `${parts[0].toUpperCase()}${parts[1] ? ', ' + parts[1].trim() : ''}`
  ctx.font = '700 13px Arial, sans-serif'
  ctx.textAlign = 'center'
  const half = ctx.measureText(label).width / 2 + 6
  const lx = Math.max(mapLeft + half, Math.min(mapRight - half, cx))
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.lineJoin = 'round'
  ctx.strokeText(label, lx, cy + offsetY)
  ctx.fillStyle = fillColor
  ctx.fillText(label, lx, cy + offsetY)
}

// Draws the actual driving route (highway geometry from OSRM) projected onto
// the canvas via d3-geo. Falls back to a great-circle arc if the API is down.
async function drawRoute(
  ctx: CanvasRenderingContext2D,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geo: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projection: any,
  originCoords: [number, number],
  destCoords: [number, number],
  color: string,
  lineWidth = 3,
  headSize = 20,
  dashed: number[] = [],
  isCurrent: () => boolean = () => true,
) {
  const pathGen = geo.geoPath().projection(projection).context(ctx)

  // Try real driving route first; fall back to geodesic arc
  const roadCoords = await fetchDrivingRoute(originCoords, destCoords)
  if (!isCurrent()) return   // a newer render started while we awaited OSRM
  const lineCoords: [number, number][] = roadCoords ?? [originCoords, destCoords]

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (dashed.length) ctx.setLineDash(dashed)

  ctx.beginPath()
  pathGen({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: lineCoords },
    properties: null,
  })
  ctx.stroke()
  ctx.setLineDash([])

  // Arrowhead — angle from the second-to-last projected point to the last
  if (headSize > 0 && lineCoords.length >= 2) {
    const pNear = projection(lineCoords[lineCoords.length - 2])
    const pDest = projection(lineCoords[lineCoords.length - 1])
    if (pNear && pDest) {
      const [nx, ny] = pNear
      const [dx, dy] = pDest
      const angle = Math.atan2(dy - ny, dx - nx)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(dx, dy)
      ctx.lineTo(dx - headSize * Math.cos(angle - Math.PI / 7), dy - headSize * Math.sin(angle - Math.PI / 7))
      ctx.lineTo(dx - headSize * Math.cos(angle + Math.PI / 7), dy - headSize * Math.sin(angle + Math.PI / 7))
      ctx.closePath()
      ctx.fill()
    }
  }

  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawUSMapStates(
  ctx: CanvasRenderingContext2D,
  geo: any, topo: any, data: any,
  extent: [[number, number], [number, number]],
  stateFill: string,
  stateStroke: string,
  strokeWidth = 0.8,
  customProjection: any = null,
) {
  const projection = customProjection ?? (() => {
    const p = geo.geoAlbersUsa()
    p.fitExtent(extent, topo.feature(data, data.objects.nation))
    return p
  })()
  const pathGen = geo.geoPath().projection(projection).context(ctx)
  const states = topo.feature(data, data.objects.states)
  ctx.save()
  for (const f of states.features) {
    if (f.id === '02' || f.id === 2) continue  // exclude Alaska
    ctx.beginPath()
    pathGen(f)
    ctx.fillStyle = stateFill
    ctx.fill()
    ctx.strokeStyle = stateStroke
    ctx.lineWidth = strokeWidth
    ctx.stroke()
  }
  ctx.restore()
  return projection
}


function pctColor(pct: string, dark = true): string {
  const n = parseFloat(pct)
  if (isNaN(n)) return dark ? '#FFFFFF' : '#333333'
  return n < 0 ? '#00BCD4' : '#E53935'
}

function formatPct(raw: string): string {
  const s = raw.trim().replace('%', '')
  const n = parseFloat(s)
  if (isNaN(n)) return raw
  return n >= 0 ? `+${n}%` : `${n}%`
}

type LogoPos = 'top-left' | 'top-center' | 'top-right'

function drawLogoOnCanvas(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  canvasW: number,
  position: LogoPos,
  yOffset = 20,
  maxW = 180,
  maxH = 52,
) {
  if (!logoImg || !logoImg.complete || logoImg.naturalWidth === 0) return
  const ratio = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight)
  const lw = logoImg.naturalWidth * ratio
  const lh = logoImg.naturalHeight * ratio
  const PAD = 54
  const x = position === 'top-left' ? PAD
    : position === 'top-right' ? canvasW - PAD - lw
    : (canvasW - lw) / 2
  ctx.drawImage(logoImg, x, yOffset, lw, lh)
}

// Returns how many px to push top-section content down so the logo doesn't cover it.
// firstVisualY = approximate visual top (not baseline) of the first content element.
function computeTopShift(logoImg: HTMLImageElement | null, firstVisualY: number, maxW = 180, maxH = 52): number {
  if (!logoImg || !logoImg.complete || logoImg.naturalWidth === 0) return 0
  const ratio = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight)
  const lh = logoImg.naturalHeight * ratio
  return Math.max(0, Math.ceil(44 + lh + 52) - firstVisualY)
}

// ─── DRAW: HOT LANE ──────────────────────────────────────────────
async function drawHotLane(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  form: HotLaneForm,
  theme: Theme,
  logoImg: HTMLImageElement | null = null,
  logoPos: LogoPos = 'top-left',
  logoScale = 1,
  isCurrent: () => boolean = () => true,
) {
  const { geo, topo, data } = await ensureMapLibs()
  if (!isCurrent()) return
  const isDark = theme === 'dark'
  const PAD = 54
  const maxLogoW = Math.round(180 * logoScale)
  const maxLogoH = Math.round(52 * logoScale)

  ctx.fillStyle = isDark ? '#000000' : '#FFFFFF'
  ctx.fillRect(0, 0, w, h)

  if (isDark) {
    const shift = computeTopShift(logoImg, 50, maxLogoW, maxLogoH)

    // Red accent bar — bottom
    ctx.fillStyle = '#CC0000'
    ctx.fillRect(0, h - 6, w, 6)

    // ── Title: "Hot Lane" (red) + "of the Week" (white) ──────────
    const titleY = 98 + shift
    ctx.font = `900 52px 'Arial Black', Arial, sans-serif`
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#CC0000'
    const redPart = 'Hot Lane '
    ctx.fillText(redPart, PAD, titleY)
    const redW = ctx.measureText(redPart).width
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText('of the Week', PAD + redW, titleY)

    // "WEEK OF …" — right-aligned, stacked above mode badge
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '400 14px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`WEEK OF ${form.weekOf.toUpperCase()}`, w - PAD, 44 + shift)

    // Mode badge
    const bw = 140, bh = 42, bx = w - PAD - bw, by = 62 + shift
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    roundRect(ctx, bx, by, bw, bh, 10)
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 20px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(form.mode.toUpperCase(), bx + bw / 2, by + 28)

    // Separator below header
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD, 122 + shift); ctx.lineTo(w - PAD, 122 + shift); ctx.stroke()

    // ── Route: CITY [circle→] CITY ────────────────────────────────
    const originLabel = form.originCity.toUpperCase()
    const destLabel = form.destCity.toUpperCase()
    const iconR = 24, gap = 48
    const maxRouteW = w - PAD * 2

    // Shrink font until the row fits
    let rfs = 36
    ctx.font = `400 ${rfs}px Arial, sans-serif`
    let oW = ctx.measureText(originLabel).width
    let dW = ctx.measureText(destLabel).width
    while ((oW + dW + gap * 2 + iconR * 2) > maxRouteW && rfs > 28) {
      rfs -= 4
      ctx.font = `400 ${rfs}px Arial, sans-serif`
      oW = ctx.measureText(originLabel).width
      dW = ctx.measureText(destLabel).width
    }

    const routeY = 196 + shift
    const totalRouteW = oW + gap + iconR * 2 + gap + dW
    const rowStartX = (w - totalRouteW) / 2

    // Origin city name
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    ctx.fillText(originLabel, rowStartX, routeY)

    // Circle arrow icon
    const iconCx = rowStartX + oW + gap + iconR
    const iconCy = routeY - Math.round(rfs * 0.38)
    ctx.strokeStyle = '#CC0000'
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2); ctx.stroke()
    // Arrow →
    const aw = 9, ah = 6
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(iconCx - aw, iconCy); ctx.lineTo(iconCx + aw, iconCy); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(iconCx + aw - ah, iconCy - ah)
    ctx.lineTo(iconCx + aw, iconCy)
    ctx.lineTo(iconCx + aw - ah, iconCy + ah)
    ctx.stroke()
    ctx.lineCap = 'butt'

    // Destination city name
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    ctx.font = `400 ${rfs}px Arial, sans-serif`
    ctx.fillText(destLabel, rowStartX + oW + gap + iconR * 2 + gap, routeY)

    // ── Map ───────────────────────────────────────────────────────
    const mapY = 228 + shift, mapH = 552 - shift
    const proj = drawUSMapStates(ctx, geo, topo, data, [[PAD, mapY], [w - PAD, mapY + mapH]], '#FFFFFF', '#999999', 0.7)

    // Route + markers
    const oc = CITIES[form.originCity], dc = CITIES[form.destCity]
    if (oc && dc) {
      await drawRoute(ctx, geo, proj, oc, dc, '#CC0000', 3.5, 22, [], isCurrent)
      if (!isCurrent()) return
      const [ox, oy] = proj(oc) ?? [0, 0]
      const [dx, dy] = proj(dc) ?? [0, 0]
      for (const [cx, cy, lbl] of [[ox, oy, form.originCity], [dx, dy, form.destCity]] as [number, number, string][]) {
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill()
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = '#CC0000'; ctx.fill()
        drawCityLabel(ctx, lbl, cx, cy, '#000000', PAD, w - PAD)
      }
    }

    // ── Stats bar ─────────────────────────────────────────────────
    const statsY = 800
    const useIndex = !!form.truckLoadIndex.trim()
    const cols = useIndex
      ? [
        { val: form.loadsAvailable,       lbl: 'LOADS AVAILABLE',   color: '#FFFFFF' },
        { val: formatPct(form.pctChange30d), lbl: '30-DAY CHANGE',  color: pctColor(form.pctChange30d) },
        { val: form.truckLoadIndex,         lbl: 'TRUCK/LOAD INDEX', color: '#FFC107' },
        { val: `$${form.avgRate}`,          lbl: 'AVG RATE/MILE',   color: '#FFFFFF' },
      ]
      : [
        { val: form.loadsAvailable,       lbl: 'LOADS AVAILABLE',   color: '#FFFFFF' },
        { val: formatPct(form.pctChange30d), lbl: '30-DAY CHANGE',  color: pctColor(form.pctChange30d) },
        { val: formatPct(form.pctChange7d),  lbl: '7-DAY CHANGE',   color: pctColor(form.pctChange7d) },
        { val: `$${form.avgRate}`,          lbl: 'AVG RATE/MILE',   color: '#FFFFFF' },
      ]

    // ── Stats bar: individual cards on dark bg with chevron pattern ─
    const outerPad = 20, innerGap = 14
    const numBoxes = cols.length
    const boxW = (w - outerPad * 2 - innerGap * (numBoxes - 1)) / numBoxes
    const boxH = 158
    const statsAreaH = h - statsY - 6  // leave 6px for red bar at bottom
    const boxTopY = statsY + 36

    // Dark background for full stats area
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, statsY, w, statsAreaH)

    // Truckmark JPEG pattern — lighten blend so only red chevrons show on pure black
    const pImg = await ensureTruckmarkImg()
    if (!isCurrent()) return
    if (pImg) {
      const tileH = statsAreaH
      const tileW = Math.round(pImg.naturalWidth * (tileH / pImg.naturalHeight))

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, statsY, w, statsAreaH)
      ctx.clip()
      ctx.globalCompositeOperation = 'lighten'

      const offsetX = -Math.round(tileW * 0.15)
      const offsetY = Math.round(statsAreaH * 0.28)
      for (let tx = offsetX; tx < w; tx += tileW) {
        ctx.drawImage(pImg, tx, statsY + offsetY, tileW, tileH)
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()
    }

    // Individual stat boxes drawn on top of the chevron field
    for (let i = 0; i < cols.length; i++) {
      const { val, lbl } = cols[i]
      const boxX = outerPad + i * (boxW + innerGap)

      ctx.fillStyle = '#000000'
      roundRect(ctx, boxX, boxTopY, boxW, boxH, 10)
      ctx.fill()
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 1
      roundRect(ctx, boxX, boxTopY, boxW, boxH, 10)
      ctx.stroke()

      const midX = boxX + boxW / 2
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `900 48px 'Arial Black', Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(val, midX, boxTopY + 78)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '600 18px Arial, sans-serif'
      ctx.fillText(lbl, midX, boxTopY + boxH - 18)
    }

    // Logo drawn last so it sits on top of everything
    drawLogoOnCanvas(ctx, logoImg, w, logoPos, 44, maxLogoW, maxLogoH)

  } else {
    // ── Light theme ──────────────────────────────────────────────
    const shift = computeTopShift(logoImg, 50, maxLogoW, maxLogoH)

    // Red accent bar — bottom
    ctx.fillStyle = '#CC0000'
    ctx.fillRect(0, h - 6, w, 6)

    // ── Title: centered "Hot Lane" (red) + "of the Week" (dark) ──
    const titleY = 98 + shift
    ctx.font = `900 52px 'Arial Black', Arial, sans-serif`
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    const redPartL = 'Hot Lane '
    const whitePart = 'of the Week'
    const redWL = ctx.measureText(redPartL).width
    const whiteWL = ctx.measureText(whitePart).width
    const titleStartX = (w - redWL - whiteWL) / 2
    ctx.fillStyle = '#CC0000'
    ctx.fillText(redPartL, titleStartX, titleY)
    ctx.fillStyle = '#111111'
    ctx.fillText(whitePart, titleStartX + redWL, titleY)

    // Separator below header
    ctx.strokeStyle = '#CCCCCC'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD, 122 + shift); ctx.lineTo(w - PAD, 122 + shift); ctx.stroke()

    // ── Route row: CITY [circle→] CITY (left) | DRY VAN badge (right) ──
    const originLabelL = form.originCity.toUpperCase()
    const destLabelL = form.destCity.toUpperCase()
    const iconRL = 24, gapL = 20

    // Mode badge (red rounded border, right side)
    const lbw = 130, lbh = 38, lbx = w - PAD - lbw
    const routeYL = 176 + shift
    const lby = routeYL - Math.round(36 * 0.75)
    ctx.strokeStyle = '#CC0000'
    ctx.lineWidth = 2
    roundRect(ctx, lbx, lby, lbw, lbh, 8)
    ctx.stroke()
    ctx.fillStyle = '#111111'
    ctx.font = '700 15px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(form.mode.toUpperCase(), lbx + lbw / 2, lby + 24)

    // City labels — left-aligned, fit within space left of badge
    const maxRouteWL = lbx - PAD - 20
    let rfsL = 26
    ctx.font = `700 ${rfsL}px Arial, sans-serif`
    let oWL = ctx.measureText(originLabelL).width
    let dWL = ctx.measureText(destLabelL).width
    while ((oWL + dWL + gapL * 2 + iconRL * 2) > maxRouteWL && rfsL > 18) {
      rfsL -= 2
      ctx.font = `700 ${rfsL}px Arial, sans-serif`
      oWL = ctx.measureText(originLabelL).width
      dWL = ctx.measureText(destLabelL).width
    }

    const rowStartXL = PAD

    ctx.fillStyle = '#111111'
    ctx.fillStyle = '#111111'
    ctx.font = `700 ${rfsL}px Arial, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(originLabelL, rowStartXL, routeYL)

    const iconCxL = rowStartXL + oWL + gapL + iconRL
    const iconCyL = routeYL - Math.round(rfsL * 0.38)
    ctx.strokeStyle = '#CC0000'
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(iconCxL, iconCyL, iconRL, 0, Math.PI * 2); ctx.stroke()
    const awL = 9, ahL = 6
    ctx.strokeStyle = '#111111'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(iconCxL - awL, iconCyL); ctx.lineTo(iconCxL + awL, iconCyL); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(iconCxL + awL - ahL, iconCyL - ahL)
    ctx.lineTo(iconCxL + awL, iconCyL)
    ctx.lineTo(iconCxL + awL - ahL, iconCyL + ahL)
    ctx.stroke()
    ctx.lineCap = 'butt'

    ctx.fillStyle = '#111111'
    ctx.textAlign = 'left'
    ctx.font = `700 ${rfsL}px Arial, sans-serif`
    ctx.fillText(destLabelL, rowStartXL + oWL + gapL + iconRL * 2 + gapL, routeYL)

    // ── Map ───────────────────────────────────────────────────────
    const mapYL = 228 + shift, mapHL = 552 - shift
    const projL = drawUSMapStates(ctx, geo, topo, data, [[PAD, mapYL], [w - PAD, mapYL + mapHL]], '#EBEBEB', '#CCCCCC', 0.8)

    const ocL = CITIES[form.originCity], dcL = CITIES[form.destCity]
    if (ocL && dcL) {
      await drawRoute(ctx, geo, projL, ocL, dcL, '#CC0000', 2.5, 0, [7, 5], isCurrent)
      if (!isCurrent()) return
      const [oxL, oyL] = projL(ocL) ?? [0, 0]
      const [dxL, dyL] = projL(dcL) ?? [0, 0]
      for (const [cxL, cyL, isOrig, lbl] of [[oxL, oyL, true, form.originCity], [dxL, dyL, false, form.destCity]] as [number, number, boolean, string][]) {
        ctx.fillStyle = isOrig ? '#1565C0' : '#CC0000'
        ctx.beginPath(); ctx.arc(cxL, cyL, 7, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(cxL, cyL, 7, 0, Math.PI * 2); ctx.stroke()
        drawCityLabel(ctx, lbl, cxL, cyL, '#111111', PAD, w - PAD, -14)
      }
    }

    // ── Stats bar ─────────────────────────────────────────────────
    const statsYL = 800
    const cols4 = form.mode === 'Flatbed'
      ? [
          { val: form.loadsAvailable, lbl: 'LOADS AVAILABLE' },
          { val: formatPct(form.pctChange30d), lbl: '30-DAY CHANGE' },
          { val: formatPct(form.pctChange7d), lbl: '7-DAY CHANGE' },
          { val: `$${form.avgRate}`, lbl: 'AVG RATE/MILE' },
        ]
      : [
          { val: form.loadsAvailable, lbl: 'LOADS AVAILABLE' },
          { val: formatPct(form.pctChange30d), lbl: '30-DAY CHANGE' },
          { val: form.truckLoadIndex, lbl: 'TRUCK/LOAD INDEX' },
          { val: `$${form.avgRate}`, lbl: 'AVG RATE/MILE' },
        ]

    const outerPadL = 20
    const statsAreaHL = h - statsYL - 6
    const bigBoxH = 158
    const bigBoxY = statsYL + Math.round((statsAreaHL - bigBoxH) / 2)

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, statsYL, w, statsAreaHL)

    // Pattern — invert to black chevrons, multiply onto white bg
    const wpImg = await ensureWhitePatternImg()
    if (!isCurrent()) return
    if (wpImg) {
      const tileHL = statsAreaHL
      const tileWL = Math.round(wpImg.naturalWidth * (tileHL / wpImg.naturalHeight))
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, statsYL, w, statsAreaHL)
      ctx.clip()
      ctx.filter = 'invert(1)'
      ctx.globalCompositeOperation = 'multiply'
      const offsetXL = -Math.round(tileWL * 0.15)
      const offsetYL = Math.round(statsAreaHL * 0.45)
      for (let tx = offsetXL; tx < w; tx += tileWL) {
        ctx.drawImage(wpImg, tx, statsYL + offsetYL, tileWL, tileHL)
      }
      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()
    }

    // Single grey container box
    const containerX = outerPadL, containerW = w - outerPadL * 2
    ctx.fillStyle = '#EBEBEB'
    roundRect(ctx, containerX, bigBoxY, containerW, bigBoxH, 12)
    ctx.fill()

    // 4 stats evenly across the container
    const colW = containerW / cols4.length
    for (let i = 0; i < cols4.length; i++) {
      const { val, lbl } = cols4[i]
      const midXL = containerX + colW * i + colW / 2
      ctx.fillStyle = '#CC0000'
      ctx.font = `900 48px 'Arial Black', Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(val, midXL, bigBoxY + 78)
      ctx.fillStyle = '#555555'
      ctx.font = '600 18px Arial, sans-serif'
      ctx.fillText(lbl, midXL, bigBoxY + bigBoxH - 18)
    }

    // Logo
    drawLogoOnCanvas(ctx, logoImg, w, logoPos, 44, maxLogoW, maxLogoH)
  }
}

// ─── DRAW: OUTBOUND MARKET ───────────────────────────────────────
async function drawOutbound(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  form: OutboundForm,
  logoImg: HTMLImageElement | null = null,
  logoPos: LogoPos = 'top-left',
  logoScale = 1,
  isCurrent: () => boolean = () => true,
) {
  const { geo, topo, data } = await ensureMapLibs()
  if (!isCurrent()) return
  const PAD = 52
  const maxLogoW = Math.round(180 * logoScale)
  const maxLogoH = Math.round(52 * logoScale)

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)

  const shift = computeTopShift(logoImg, 28, maxLogoW, maxLogoH)
  ctx.textBaseline = 'alphabetic'

  // "WEEK OF …" — top right, bold black
  ctx.fillStyle = '#111111'
  ctx.font = '700 20px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`WEEK OF ${form.weekOf.toUpperCase()}`, w - PAD, 72)

  // ── Title: "Outbound Market" (red) + "To Watch" (black) ─────────
  ctx.font = `900 54px 'Arial Black', Arial, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillStyle = '#CC0000'
  ctx.fillText('Outbound Market', PAD, 104 + shift)
  ctx.fillStyle = '#111111'
  ctx.fillText('To Watch', PAD, 168 + shift)

  // ── Right side: city name + mode badge ──────────────────────────
  const obw = 190, obh = 52, obx = w - PAD - obw, oby = 122 + shift
  ctx.fillStyle = '#111111'
  ctx.font = '700 22px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(form.cityName.toUpperCase(), obx + obw / 2, 90 + shift)

  ctx.strokeStyle = '#CC0000'
  ctx.lineWidth = 2
  roundRect(ctx, obx, oby, obw, obh, 8)
  ctx.stroke()
  ctx.fillStyle = '#111111'
  ctx.font = '700 20px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(form.mode.toUpperCase(), obx + obw / 2, oby + 32)

  // ── Separator with "MARKET DATA TO KNOW" ────────────────────────
  const sepY = 226 + shift
  ctx.strokeStyle = '#CCCCCC'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, sepY); ctx.lineTo(w - PAD, sepY); ctx.stroke()
  const mdtkLabel = 'MARKET DATA TO KNOW'
  ctx.font = '700 17px Arial, sans-serif'
  ctx.textAlign = 'center'
  const mdtkW = ctx.measureText(mdtkLabel).width + 24
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(w / 2 - mdtkW / 2, sepY - 11, mdtkW, 22)
  ctx.fillStyle = '#111111'
  ctx.fillText(mdtkLabel, w / 2, sepY + 6)

  // ── Stats bar (single grey rounded box, 4 cols) ──────────────────
  const spotDest = form.spotlightDest ? form.spotlightDest : '—'
  const obStats: { label: string; value: string }[] = [
    { label: 'AVG RATE/MILE',   value: `$${form.avgRatePerMile}` },
    { label: 'LOADS AVAILABLE', value: form.loadsAvailable },
    { label: '30-DAY CHANGE',   value: `+${form.pctIncreaseVs30d}%` },
    { label: 'SPOTLIGHT LANE',  value: spotDest },
  ]
  const sbY = sepY + 18, sbH = 120
  ctx.fillStyle = '#F0F0F0'
  roundRect(ctx, PAD, sbY, w - PAD * 2, sbH, 10)
  ctx.fill()
  const sbColW = (w - PAD * 2) / obStats.length
  const colPad = 16
  for (let i = 0; i < obStats.length; i++) {
    const mx = PAD + sbColW * i + sbColW / 2
    ctx.fillStyle = '#CC0000'
    ctx.textAlign = 'center'
    let fontSize = 40
    ctx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`
    while (ctx.measureText(obStats[i].value).width > sbColW - colPad * 2 && fontSize > 18) {
      fontSize -= 2
      ctx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`
    }
    ctx.fillText(obStats[i].value, mx, sbY + 58 + (40 - fontSize) / 2)
    ctx.fillStyle = '#111111'
    ctx.font = '600 17px Arial, sans-serif'
    ctx.fillText(obStats[i].label, mx, sbY + sbH - 14)
  }

  // ── Red pattern strip — drawn first so map box sits on top ──────
  const patternH = 220
  const patternY = h - patternH - 6
  const pImgOb = await ensureWhitePatternImg()
  if (!isCurrent()) return
  if (pImgOb) {
    const tileH = patternH
    const tileW = Math.round(pImgOb.naturalWidth * (tileH / pImgOb.naturalHeight))
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, patternY, w, patternH)
    ctx.clip()

    // Step 1: invert + multiply → black chevron shapes on white canvas
    ctx.filter = 'invert(1)'
    ctx.globalCompositeOperation = 'multiply'
    const offX = -Math.round(tileW * 0.05)
    for (let tx = offX; tx < w; tx += tileW) {
      ctx.drawImage(pImgOb, tx, patternY, tileW, tileH)
    }
    ctx.filter = 'none'

    // Step 2: screen red rect → black chevrons become red, white stays white
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = '#CC0000'
    ctx.fillRect(0, patternY, w, patternH)

    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
  }

  // ── Map box — overlaps pattern, leaving ~70px of pattern visible below
  const mapBoxY = sbY + sbH + 16
  const mapBoxH = h - mapBoxY - 76
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, PAD, mapBoxY, w - PAD * 2, mapBoxH, 10)
  ctx.fill()

  const mapExtent: [[number,number],[number,number]] = [[PAD + 10, mapBoxY + 10], [w - PAD - 10, mapBoxY + mapBoxH - 10]]
  const oc = CITIES[form.cityName], dc = CITIES[form.spotlightDest]
  const baseProj = geo.geoAlbersUsa()
  baseProj.fitExtent(mapExtent, topo.feature(data, data.objects.nation))

  const extCx = (mapExtent[0][0] + mapExtent[1][0]) / 2
  const extCy = (mapExtent[0][1] + mapExtent[1][1]) / 2
  let zf = 1, ztx = extCx, zty = extCy
  const extW = mapExtent[1][0] - mapExtent[0][0]
  const extH = mapExtent[1][1] - mapExtent[0][1]
  if (oc && dc) {
    const p1 = baseProj(oc), p2 = baseProj(dc)
    if (p1 && p2) {
      const spanPx = Math.max(Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1]), 1)
      const canvasSpan = Math.min(extW, extH)
      zf = Math.min(5, Math.max(1.5, canvasSpan * 0.6 / spanPx))
      ztx = (p1[0] + p2[0]) / 2
      zty = (p1[1] + p2[1]) / 2
      const pad60 = 60
      const maxZfX = (extW / 2 - pad60) / Math.max(Math.abs(p1[0] - ztx), Math.abs(p2[0] - ztx), 1)
      const maxZfY = (extH / 2 - pad60) / Math.max(Math.abs(p1[1] - zty), Math.abs(p2[1] - zty), 1)
      zf = Math.min(zf, maxZfX, maxZfY)
    }
  }

  ctx.save()
  ctx.beginPath()
  roundRect(ctx, PAD, mapBoxY, w - PAD * 2, mapBoxH, 10)
  ctx.clip()
  ctx.translate(extCx, extCy)
  ctx.scale(zf, zf)
  ctx.translate(-ztx, -zty)
  drawUSMapStates(ctx, geo, topo, data, mapExtent, '#EBEBEB', '#C8C8C8', 0.8 / zf, baseProj)
  if (oc) {
    if (dc) {
      await drawRoute(ctx, geo, baseProj, oc, dc, '#CC0000', 2.5 / zf, 0, [7 / zf, 5 / zf], isCurrent)
      if (!isCurrent()) return
      const [dx, dy] = baseProj(dc) ?? [0, 0]
      ctx.fillStyle = '#CC0000'
      ctx.beginPath(); ctx.arc(dx, dy, 7 / zf, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2 / zf
      ctx.beginPath(); ctx.arc(dx, dy, 7 / zf, 0, Math.PI * 2); ctx.stroke()
    }
    const [ox, oy] = baseProj(oc) ?? [0, 0]
    ctx.fillStyle = '#1565C0'
    ctx.beginPath(); ctx.arc(ox, oy, 7 / zf, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2 / zf
    ctx.beginPath(); ctx.arc(ox, oy, 7 / zf, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()

  // City labels — drawn after restore() in screen space
  if (oc || dc) {
    ctx.save()
    ctx.beginPath()
    roundRect(ctx, PAD, mapBoxY, w - PAD * 2, mapBoxH, 10)
    ctx.clip()
    const toScreen = (coords: [number, number]): [number, number] | null => {
      const p = baseProj(coords)
      if (!p) return null
      return [(p[0] - ztx) * zf + extCx, (p[1] - zty) * zf + extCy]
    }
    const pins: [string, [number, number] | undefined, boolean][] = [
      [form.cityName, oc, true],
      [form.spotlightDest, dc, false],
    ]
    for (const [cityStr, coords, isOrig] of pins) {
      if (!coords || !cityStr) continue
      const screen = toScreen(coords)
      if (!screen) continue
      const [sx, sy] = screen
      drawCityLabel(ctx, cityStr, sx, sy, isOrig ? '#1565C0' : '#CC0000', PAD + 10, w - PAD - 10, -14)
    }
    ctx.restore()
  }

  // Border drawn after map content so it's clean on all sides
  ctx.strokeStyle = '#555555'
  ctx.lineWidth = 2
  roundRect(ctx, PAD, mapBoxY, w - PAD * 2, mapBoxH, 10)
  ctx.stroke()

  // Red accent bar — very bottom
  ctx.fillStyle = '#CC0000'
  ctx.fillRect(0, h - 6, w, 6)

  // Logo
  drawLogoOnCanvas(ctx, logoImg, w, logoPos, 44, maxLogoW, maxLogoH)
}

// ─── DRAW: HOT & COLD ────────────────────────────────────────────
async function drawHotCold(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  form: HotColdForm,
  logoImg: HTMLImageElement | null = null,
  logoPos: LogoPos = 'top-left',
  logoScale = 1,
  theme: Theme = 'dark',
  isCurrent: () => boolean = () => true,
) {
  const PAD = 52
  const maxLogoW = Math.round(180 * logoScale)
  const maxLogoH = Math.round(52 * logoScale)
  const isDark = theme === 'dark'
  const shift = computeTopShift(logoImg, 48, maxLogoW, maxLogoH)
  const mode = form.hotMode || form.coldMode
  const hotColor = '#CC0000'
  const coldColor = '#00BCD4'

  if (isDark) {
    // ── Dark theme ───────────────────────────────────────────────
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    ctx.textBaseline = 'alphabetic'

    // "WEEK OF …" — top right bold white
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 24px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`WEEK OF ${form.weekOf.toUpperCase()}`, w - PAD, 44 + shift)

    // "MARKET COMPARISON" label
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 30px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('MARKET COMPARISON', PAD, 88 + shift)

    // "Flatbed - This Week" title
    ctx.font = `900 62px 'Arial Black', Arial, sans-serif`
    ctx.fillStyle = hotColor
    const modeW = ctx.measureText(mode + ' ').width
    ctx.fillText(mode + ' ', PAD, 164 + shift)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText('- This Week', PAD + modeW, 164 + shift)

    // ── Cards ────────────────────────────────────────────────────
    const patHC = 300
    const cardY = 240 + shift
    const cardH = 650
    const gap = 16
    const cardW = (w - PAD * 2 - gap) / 2
    const lx = PAD, rx = PAD + cardW + gap

    // ── Pattern strip behind cards (drawn first) ──────────────────
    const patY = h - patHC - 6
    const pImgHC = await ensureTruckmarkImg()
    if (!isCurrent()) return
    if (pImgHC) {
      const tH = patHC
      const tW = Math.round(pImgHC.naturalWidth * (tH / pImgHC.naturalHeight))
      ctx.save()
      ctx.beginPath(); ctx.rect(0, patY, w, patHC); ctx.clip()
      ctx.globalCompositeOperation = 'lighten'
      for (let tx = -Math.round(tW * 0.3); tx < w + tW; tx += tW) ctx.drawImage(pImgHC, tx, patY, tW, tH)
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()
    }

    const drawCard = (x: number, color: string, label: string, arrowUp: boolean,
      pct: string, vsLabel: string, route: string[], modeDir: string, rate: string) => {
      // Card background + border
      ctx.fillStyle = '#2A2A2A'
      roundRect(ctx, x, cardY, cardW, cardH, 12)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      roundRect(ctx, x, cardY, cardW, cardH, 12)
      ctx.stroke()

      const cp = x + PAD - 16

      // Label + triangle
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '700 19px Arial, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, cp, cardY + 48)
      const lw = ctx.measureText(label).width
      const triX = cp + lw + 24, triY = cardY + 30
      ctx.fillStyle = color
      ctx.beginPath()
      if (arrowUp) {
        ctx.moveTo(triX, triY); ctx.lineTo(triX + 12, triY + 18); ctx.lineTo(triX - 12, triY + 18)
      } else {
        ctx.moveTo(triX - 12, triY); ctx.lineTo(triX + 12, triY); ctx.lineTo(triX, triY + 18)
      }
      ctx.closePath(); ctx.fill()

      // Big pct
      ctx.fillStyle = color
      ctx.font = `900 48px 'Arial Black', Arial, sans-serif`
      ctx.fillText(pct, cp, cardY + 148)

      // VS label
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '400 17px Arial, sans-serif'
      ctx.fillText(vsLabel, cp, cardY + 178)

      // Separator 1
      ctx.strokeStyle = '#333333'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cp, cardY + 200); ctx.lineTo(x + cardW - 24, cardY + 200); ctx.stroke()

      // Route — auto-shrink to fit card width
      ctx.fillStyle = '#FFFFFF'
      const maxRouteW = x + cardW - 24 - cp
      const longestLine = route.reduce((a, b) => a.length > b.length ? a : b, '')
      let routeFs = 52
      ctx.font = `700 ${routeFs}px Arial, sans-serif`
      while (ctx.measureText(longestLine).width > maxRouteW && routeFs > 22) {
        routeFs -= 2
        ctx.font = `700 ${routeFs}px Arial, sans-serif`
      }
      route.forEach((l, i) => ctx.fillText(l, cp, cardY + 270 + i * (routeFs + 10)))

      // Separator 2 — fixed position so both cards align regardless of route length
      const sep2Y = cardY + 390
      ctx.strokeStyle = '#333333'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cp, sep2Y); ctx.lineTo(x + cardW - 24, sep2Y); ctx.stroke()

      // Mode/direction label
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '600 13px Arial, sans-serif'
      ctx.fillText(modeDir.toUpperCase(), cp, sep2Y + 32)

      // Rate
      ctx.fillStyle = color
      ctx.font = `700 38px 'Arial Black', Arial, sans-serif`
      ctx.fillText(rate, cp, sep2Y + 82)
    }

    const hotRoute = form.hotDest
      ? [form.hotCity, `→ ${form.hotDest}`]
      : [form.hotCity]
    const coldRoute = form.coldDest
      ? [form.coldCity, `→ ${form.coldDest}`]
      : [form.coldCity]
    const coldVal = form.coldPct.startsWith('-') ? form.coldPct + '%' : '-' + form.coldPct + '%'

    drawCard(lx, hotColor, 'HEATING UP', true, formatPct(form.hotPct), 'VS. 30 DAYS',
      hotRoute, `${form.hotMode} ${form.hotDirection}`, `$${form.hotRate}/Mile`)
    drawCard(rx, coldColor, 'COOLING DOWN', false, coldVal, 'VS. 30 DAYS',
      coldRoute, `${form.coldMode} ${form.coldDirection}`, `$${form.coldRate}/Mile`)

    // Red accent bar
    ctx.fillStyle = '#CC0000'
    ctx.fillRect(0, h - 6, w, 6)

    drawLogoOnCanvas(ctx, logoImg, w, logoPos, 44, maxLogoW, maxLogoH)
    return
  }

  // ── Light theme ──────────────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)

  // Red accent bar at bottom
  ctx.fillStyle = '#CC0000'
  ctx.fillRect(0, h - 6, w, 6)

  // "WEEK OF …" top right bold dark
  ctx.fillStyle = '#111111'
  ctx.font = '700 24px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`WEEK OF ${form.weekOf.toUpperCase()}`, w - PAD, 44 + shift)

  // "MARKET COMPARISON"
  ctx.fillStyle = '#111111'
  ctx.font = '700 30px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('MARKET COMPARISON', PAD, 88 + shift)

  // "Flatbed - This Week" title
  ctx.font = `900 62px 'Arial Black', Arial, sans-serif`
  ctx.fillStyle = hotColor
  const modeLW = ctx.measureText(mode + ' ').width
  ctx.fillText(mode + ' ', PAD, 164 + shift)
  ctx.fillStyle = '#111111'
  ctx.fillText('- This Week', PAD + modeLW, 164 + shift)

  // ── Cards ────────────────────────────────────────────────────
  const cardYL = 240 + shift
  const cardHL = 650
  const gapL = 16
  const cardWL = (w - PAD * 2 - gapL) / 2
  const lxL = PAD, rxL = PAD + cardWL + gapL

  const drawCardLight = (x: number, color: string, label: string, arrowUp: boolean,
    pct: string, vsLabel: string, route: string[], modeDir: string, rate: string,
    bodyBg: string) => {

    const inset = 18

    // Card: tinted bg + colored border
    ctx.fillStyle = bodyBg
    roundRect(ctx, x, cardYL, cardWL, cardHL, 12)
    ctx.fill()
    // Colored accent line at bottom of card (clipped to rounded corners)
    ctx.save()
    roundRect(ctx, x, cardYL, cardWL, cardHL, 12)
    ctx.clip()
    ctx.fillStyle = color
    ctx.fillRect(x, cardYL + cardHL - 8, cardWL, 8)
    ctx.restore()

    // Inset colored header block (sharp corners, floats inside card)
    const hbX = x + inset, hbY = cardYL + inset
    const hbW = cardWL - inset * 2, hbH = 200
    ctx.fillStyle = color
    ctx.fillRect(hbX, hbY, hbW, hbH)

    const cp = x + PAD - 4

    // Label + triangle (white, inside header block)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 19px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(label, cp, hbY + 44)
    const lw = ctx.measureText(label).width
    const triX = cp + lw + 24, triY = hbY + 28
    ctx.beginPath()
    if (arrowUp) {
      ctx.moveTo(triX, triY); ctx.lineTo(triX + 12, triY + 18); ctx.lineTo(triX - 12, triY + 18)
    } else {
      ctx.moveTo(triX - 12, triY); ctx.lineTo(triX + 12, triY); ctx.lineTo(triX, triY + 18)
    }
    ctx.closePath(); ctx.fill()

    // Big pct (white, inside header block)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `900 48px 'Arial Black', Arial, sans-serif`
    ctx.fillText(pct, cp, hbY + 148)

    // VS label — placed below header block bottom (cardYL + 218)
    ctx.fillStyle = '#111111'
    ctx.font = '400 20px Arial, sans-serif'
    ctx.fillText(vsLabel, cp, cardYL + 248)

    // Separator 1
    ctx.strokeStyle = '#333333'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cp, cardYL + 270); ctx.lineTo(x + cardWL - 24, cardYL + 270); ctx.stroke()

    // Route — auto-shrink to fit card width
    ctx.fillStyle = '#111111'
    const maxRouteWL = x + cardWL - 24 - cp
    const longestLineL = route.reduce((a, b) => a.length > b.length ? a : b, '')
    let routeFsL = 52
    ctx.font = `700 ${routeFsL}px Arial, sans-serif`
    while (ctx.measureText(longestLineL).width > maxRouteWL && routeFsL > 22) {
      routeFsL -= 2
      ctx.font = `700 ${routeFsL}px Arial, sans-serif`
    }
    route.forEach((l, i) => ctx.fillText(l, cp, cardYL + 338 + i * (routeFsL + 10)))

    // Separator 2 — fixed position
    const sep2YL = cardYL + 440
    ctx.strokeStyle = '#333333'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cp, sep2YL); ctx.lineTo(x + cardWL - 24, sep2YL); ctx.stroke()

    // Mode/direction
    ctx.fillStyle = '#111111'
    ctx.font = '600 16px Arial, sans-serif'
    ctx.fillText(modeDir.toUpperCase(), cp, sep2YL + 32)

    // Rate
    ctx.fillStyle = color
    ctx.font = `700 38px 'Arial Black', Arial, sans-serif`
    ctx.fillText(rate, cp, sep2YL + 82)
  }

  const hotRouteL = form.hotDest
    ? [form.hotCity, `→ ${form.hotDest}`]
    : [form.hotCity]
  const coldRouteL = form.coldDest
    ? [form.coldCity, `→ ${form.coldDest}`]
    : [form.coldCity]
  const coldValL = form.coldPct.startsWith('-') ? form.coldPct + '%' : '-' + form.coldPct + '%'

  drawCardLight(lxL, hotColor, 'HEATING UP', true, formatPct(form.hotPct), 'VS. 30 DAYS',
    hotRouteL, `${form.hotMode} ${form.hotDirection}`, `$${form.hotRate}/Mile`, '#FFF0F0')
  drawCardLight(rxL, coldColor, 'COOLING DOWN', false, coldValL, 'VS. 30 DAYS',
    coldRouteL, `${form.coldMode} ${form.coldDirection}`, `$${form.coldRate}/Mile`, '#E8F9FB')

  drawLogoOnCanvas(ctx, logoImg, w, logoPos, 44, maxLogoW, maxLogoH)
}

// ─── FORM FIELD HELPERS ───────────────────────────────────────────
function Fl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label style={{ fontSize: 13 }}>{label}</label>
      {children}
    </div>
  )
}

function CityPick({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listId = `${id ?? 'city'}-suggestions`

  useEffect(() => {
    const query = value.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/us-cities?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = await response.json() as { places?: [string, number, number][] }
        setSuggestions((data.places ?? []).map(place => place[0]))
        setActiveIndex(-1)
      } catch {
        // A newer keystroke aborts the previous request.
      }
    }, 120)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  const choose = (city: string) => {
    onChange(city)
    setOpen(false)
    setActiveIndex(-1)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (!suggestions.length) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActiveIndex(index => Math.min(index + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(index => Math.max(index - 1, 0))
          } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault()
            choose(suggestions[activeIndex])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        placeholder="Type any city, e.g. Greenville, SC"
      />
      {open && suggestions.length > 0 && (
        <div
          id={listId}
          role="listbox"
          style={{
            position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
            maxHeight: 240, overflowY: 'auto', padding: 4,
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
          }}
        >
          {suggestions.map((city, index) => (
            <button
              id={`${listId}-${index}`}
              key={city}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(city)}
              style={{
                display: 'block', width: '100%', padding: '9px 10px',
                border: 'none', borderRadius: 6, textAlign: 'left', cursor: 'pointer',
                background: index === activeIndex ? 'var(--bg)' : 'transparent',
                color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
              }}
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ModePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {MODES.map(m => <option key={m}>{m}</option>)}
    </select>
  )
}

// ─── FORM PANELS ─────────────────────────────────────────────────
function HotLanePanel({ form, set }: { form: HotLaneForm; set: (k: keyof HotLaneForm) => (v: string) => void }) {
  return (
    <>
      <Fl label="Origin City"><CityPick id="hl-origin" value={form.originCity} onChange={set('originCity')} /></Fl>
      <Fl label="Destination City"><CityPick id="hl-dest" value={form.destCity} onChange={set('destCity')} /></Fl>
      <Fl label="Mode"><ModePick value={form.mode} onChange={set('mode')} /></Fl>
      <Fl label="Week Of"><input type="text" value={form.weekOf} onChange={e => set('weekOf')(e.target.value)} placeholder="June 25" /></Fl>
      <Fl label="Avg Rate / Mile ($)"><input type="text" value={form.avgRate} onChange={e => set('avgRate')(e.target.value)} placeholder="2.84" /></Fl>
      <Fl label="Loads Available"><input type="text" value={form.loadsAvailable} onChange={e => set('loadsAvailable')(e.target.value)} placeholder="194" /></Fl>
      <Fl label="30-Day Rate Change (%)"><input type="text" value={form.pctChange30d} onChange={e => set('pctChange30d')(e.target.value)} placeholder="12.4" /></Fl>
      <Fl label="7-Day Rate Change (%)"><input type="text" value={form.pctChange7d} onChange={e => set('pctChange7d')(e.target.value)} placeholder="8.2" /></Fl>
      <Fl label="Truck/Load Index (optional)"><input type="text" value={form.truckLoadIndex} onChange={e => set('truckLoadIndex')(e.target.value)} placeholder="3.2:1 — replaces 7-day col" /></Fl>
    </>
  )
}

function OutboundPanel({ form, set }: { form: OutboundForm; set: (k: keyof OutboundForm) => (v: string) => void }) {
  return (
    <>
      <Fl label="Origin City"><CityPick id="ob-origin" value={form.cityName} onChange={set('cityName')} /></Fl>
      <Fl label="Mode"><ModePick value={form.mode} onChange={set('mode')} /></Fl>
      <Fl label="Week Of"><input type="text" value={form.weekOf} onChange={e => set('weekOf')(e.target.value)} placeholder="June 25" /></Fl>
      <Fl label="Avg Rate / Mile ($)"><input type="text" value={form.avgRatePerMile} onChange={e => set('avgRatePerMile')(e.target.value)} placeholder="6.44" /></Fl>
      <Fl label="Loads Available"><input type="text" value={form.loadsAvailable} onChange={e => set('loadsAvailable')(e.target.value)} placeholder="2,126" /></Fl>
      <Fl label="Rate Increase vs 30-Day Avg (%)"><input type="text" value={form.pctIncreaseVs30d} onChange={e => set('pctIncreaseVs30d')(e.target.value)} placeholder="18" /></Fl>
      <Fl label="Spotlight Destination"><CityPick id="ob-dest" value={form.spotlightDest} onChange={set('spotlightDest')} /></Fl>
      <Fl label="Spotlight Rate / Mile ($)"><input type="text" value={form.spotlightRate} onChange={e => set('spotlightRate')(e.target.value)} placeholder="8.56" /></Fl>
    </>
  )
}

function HotColdPanel({ form, set }: { form: HotColdForm; set: (k: keyof HotColdForm) => (v: string) => void }) {
  return (
    <>
      <Fl label="Week Of"><input type="text" value={form.weekOf} onChange={e => set('weekOf')(e.target.value)} placeholder="June 25" /></Fl>

      <div style={{ margin: '10px 0 4px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#E53935', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heating Up</span>
      </div>
      <Fl label="City"><CityPick id="hc-hot-city" value={form.hotCity} onChange={set('hotCity')} /></Fl>
      <Fl label="→ Destination (optional)"><CityPick id="hc-hot-dest" value={form.hotDest} onChange={set('hotDest')} /></Fl>
      <Fl label="Mode"><ModePick value={form.hotMode} onChange={set('hotMode')} /></Fl>
      <Fl label="Direction">
        <select value={form.hotDirection} onChange={e => set('hotDirection')(e.target.value)}>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
      </Fl>
      <Fl label="Rate / Mile ($)"><input type="text" value={form.hotRate} onChange={e => set('hotRate')(e.target.value)} placeholder="8.56" /></Fl>
      <Fl label="% Change vs 30 days"><input type="text" value={form.hotPct} onChange={e => set('hotPct')(e.target.value)} placeholder="26" /></Fl>

      <div style={{ margin: '10px 0 4px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#00BCD4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cooling Down</span>
      </div>
      <Fl label="City"><CityPick id="hc-cold-city" value={form.coldCity} onChange={set('coldCity')} /></Fl>
      <Fl label="→ Destination (optional)"><CityPick id="hc-cold-dest" value={form.coldDest} onChange={set('coldDest')} /></Fl>
      <Fl label="Mode"><ModePick value={form.coldMode} onChange={set('coldMode')} /></Fl>
      <Fl label="Direction">
        <select value={form.coldDirection} onChange={e => set('coldDirection')(e.target.value)}>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
      </Fl>
      <Fl label="Rate / Mile ($)"><input type="text" value={form.coldRate} onChange={e => set('coldRate')(e.target.value)} placeholder="4.68" /></Fl>
      <Fl label="% Change"><input type="text" value={form.coldPct} onChange={e => set('coldPct')(e.target.value)} placeholder="-11" /></Fl>
    </>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────
export default function MapGraphicsPage() {
  const { userRole, userAllowedPages, user } = useAuth()
  const { openLightbox } = useLightbox()
  const router = useRouter()

  useEffect(() => {
    if (userRole === null) return
    const allowed = userRole === 'admin' || userAllowedPages.includes('map-graphics')
    if (!allowed) router.replace('/generate')
  }, [userRole, userAllowedPages, router])

  const logoLightRef = useRef<HTMLImageElement | null>(null)
  const logoDarkRef = useRef<HTMLImageElement | null>(null)
  const [logoReady, setLogoReady] = useState(0)
  const renderGenRef = useRef(0)
  const [logoPos, setLogoPos] = useState<LogoPos>('top-left')
  const [logoScale, setLogoScale] = useState(1)
  const brandIdRef = useRef<string | null>(null)

  const [template, setTemplate] = useState<Template>('hot_lane')
  const [theme, setTheme] = useState<Theme>('dark')
  const [hotColdTheme, setHotColdTheme] = useState<Theme>('dark')
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Auto-load Truckstop brand logos on mount
  useEffect(() => {
    sb.from('brands').select('id').ilike('name', 'truckstop').single().then(({ data: brand }) => {
      if (!brand?.id) return
      brandIdRef.current = brand.id
      sb.from('brand_profiles')
        .select('infographic_logo_light_url,infographic_logo_dark_url')
        .eq('brand_id', brand.id)
        .single()
        .then(({ data }) => {
          const load = (url: string | null, ref: React.MutableRefObject<HTMLImageElement | null>) => {
            if (!url) return
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => { ref.current = img; setLogoReady(n => n + 1) }
            img.src = url
          }
          load(data?.infographic_logo_light_url ?? null, logoLightRef)
          load(data?.infographic_logo_dark_url ?? null, logoDarkRef)
        })
    })
  }, [])

  const [hotLane, setHotLane] = useState<HotLaneForm>({
    originCity: 'Laredo, TX',
    destCity: 'Chicago, IL',
    mode: 'Dry Van',
    avgRate: '2.84',
    loadsAvailable: '194',
    pctChange30d: '12.4',
    pctChange7d: '8.2',
    truckLoadIndex: '3.2:1',
    weekOf: 'June 25',
  })

  const [outbound, setOutbound] = useState<OutboundForm>({
    cityName: 'Rocky Mount, NC',
    spotlightDest: 'Brooklyn, NY',
    mode: 'Flatbed',
    avgRatePerMile: '6.44',
    loadsAvailable: '2,126',
    pctIncreaseVs30d: '18',
    spotlightRate: '8.56',
    weekOf: 'June 25',
  })

  const [hotCold, setHotCold] = useState<HotColdForm>({
    hotCity: 'Rocky Mount, NC',
    hotDest: 'Brooklyn, NY',
    hotRate: '8.56',
    hotPct: '26',
    hotMode: 'Flatbed',
    hotDirection: 'outbound',
    coldCity: 'Charlottesville, VA',
    coldDest: '',
    coldRate: '4.68',
    coldPct: '-11',
    coldMode: 'Flatbed',
    coldDirection: 'outbound',
    weekOf: 'June 25',
  })

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gen = ++renderGenRef.current
    const isCurrent = () => gen === renderGenRef.current
    setRendering(true)
    setError(null)
    try {
      const cities = template === 'hot_lane'
        ? [hotLane.originCity, hotLane.destCity]
        : template === 'outbound'
          ? [outbound.cityName, outbound.spotlightDest]
          : [hotCold.hotCity, hotCold.hotDest, hotCold.coldCity, hotCold.coldDest]
      const unknownCities = Array.from(new Set(
        cities.filter(city => city.trim() && !findCityCoords(city)),
      ))
      if (unknownCities.length) {
        // Avoid turning the city field into an autocomplete geocoder: only look
        // up the value after the user has paused typing.
        await new Promise(resolve => setTimeout(resolve, 650))
        if (!isCurrent()) return
        const resolved = await Promise.all(unknownCities.map(ensureCityCoords))
        if (!isCurrent()) return
        const notFound = unknownCities.filter((_, index) => !resolved[index])
        if (notFound.length) {
          setError(`Could not find: ${notFound.join(', ')}. Use the format City, ST.`)
        }
      }

      ctx.clearRect(0, 0, 1080, 1080)
      // Dark templates use the dark logo; light templates use the light logo
      const darkLogo = logoDarkRef.current
      const lightLogo = logoLightRef.current
      if (template === 'hot_lane') await drawHotLane(ctx, 1080, 1080, hotLane, theme, theme === 'dark' ? darkLogo : lightLogo, logoPos, logoScale, isCurrent)
      else if (template === 'outbound') await drawOutbound(ctx, 1080, 1080, outbound, lightLogo, logoPos, logoScale, isCurrent)
      else await drawHotCold(ctx, 1080, 1080, hotCold, hotColdTheme === 'dark' ? darkLogo : lightLogo, logoPos, logoScale, hotColdTheme, isCurrent)
    } catch (e) {
      if (isCurrent()) setError((e as Error).message)
    } finally {
      if (isCurrent()) setRendering(false)
    }
  }, [template, theme, hotColdTheme, hotLane, outbound, hotCold, logoPos, logoScale, logoReady])

  useEffect(() => { render() }, [render])

  function mkSet<T>(setter: React.Dispatch<React.SetStateAction<T>>, form: T) {
    return (k: keyof T) => (v: string) => setter({ ...form, [k]: v })
  }

  async function downloadJpeg() {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `${template}_${Date.now()}.jpg`
    a.href = canvas.toDataURL('image/jpeg', 0.95)
    a.click()

    // Save to history
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.95)
      )
      const brandId = brandIdRef.current
      if (!brandId) return
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const uploaded = await uploadMedia(blob, { folder: `generated-posts/${brandId}`, fileName })
      const publicUrl = uploaded.url
      const label = template === 'hot_lane' ? 'Hot Lane Map' : template === 'outbound' ? 'Outbound Market Map' : 'Hot & Cold Map'
      await sb.from('generated_posts').insert({
        brand_id: brandId,
        output_url: publicUrl,
        headline: label,
        is_map_graphic: true,
        ...(user?.email ? { created_by_email: user.email } : {}),
      })
    } catch {
      // silent — download already succeeded
    }
  }

  if (userRole !== 'admin' && !userAllowedPages.includes('map-graphics')) return null

  const TABS: { key: Template; label: string }[] = [
    { key: 'hot_lane', label: 'Hot Lane' },
    { key: 'outbound', label: 'Outbound Market' },
    { key: 'hot_cold', label: 'Hot & Cold' },
  ]

  return (
    <>
      <h1>Map Graphics</h1>
      <p className="subtitle">Data-led freight map content for social. Exports as 1080 × 1080 JPEG.</p>

      {/* Template tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTemplate(t.key)}
            style={{
              padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
              border: `1px solid ${template === t.key ? 'var(--primary,#6366f1)' : 'var(--border)'}`,
              background: template === t.key ? 'var(--primary,#6366f1)' : 'transparent',
              color: template === t.key ? '#fff' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="generate-layout" style={{ alignItems: 'flex-start' }}>
        {/* Left: form inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300 }}>

          {/* Logo position + size */}
          <div className="form-card">
            <h2 style={{ marginBottom: 14 }}>Logo</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['top-left', 'top-center', 'top-right'] as LogoPos[]).map(pos => (
                <button
                  key={pos}
                  onClick={() => setLogoPos(pos)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    border: `1px solid ${logoPos === pos ? 'var(--primary,#6366f1)' : 'var(--border)'}`,
                    background: logoPos === pos ? 'var(--primary,#6366f1)' : 'transparent',
                    color: logoPos === pos ? '#fff' : 'var(--muted)',
                  }}
                >
                  {pos === 'top-left' ? '↖ Left' : pos === 'top-center' ? '↑ Centre' : '↗ Right'}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Size</label>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{Math.round(logoScale * 100)}%</span>
              </div>
              <input
                type="range" min="50" max="200" step="5"
                value={Math.round(logoScale * 100)}
                onChange={e => setLogoScale(Number(e.target.value) / 100)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-card">
            <h2 style={{ marginBottom: 16 }}>
              {template === 'hot_lane' ? 'Hot Lane' : template === 'outbound' ? 'Outbound Market' : 'Hot & Cold'}
            </h2>
            {template === 'hot_lane' && <HotLanePanel form={hotLane} set={mkSet(setHotLane, hotLane)} />}
            {template === 'outbound' && <OutboundPanel form={outbound} set={mkSet(setOutbound, outbound)} />}
            {template === 'hot_cold' && <HotColdPanel form={hotCold} set={mkSet(setHotCold, hotCold)} />}
          </div>
        </div>

        {/* Right: canvas preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ margin: 0 }}>Preview</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {template === 'hot_lane' && (
                  <div style={{ display: 'flex', gap: 2, background: 'var(--border)', borderRadius: 6, padding: 2 }}>
                    {(['dark', 'light'] as Theme[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        style={{
                          padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          background: theme === t ? 'var(--bg)' : 'transparent',
                          color: theme === t ? 'var(--text, #fff)' : 'var(--muted)',
                          fontSize: 11, fontWeight: theme === t ? 600 : 400, textTransform: 'capitalize',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {template === 'hot_cold' && (
                  <div style={{ display: 'flex', gap: 2, background: 'var(--border)', borderRadius: 6, padding: 2 }}>
                    {(['dark', 'light'] as Theme[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setHotColdTheme(t)}
                        style={{
                          padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          background: hotColdTheme === t ? 'var(--bg)' : 'transparent',
                          color: hotColdTheme === t ? 'var(--text, #fff)' : 'var(--muted)',
                          fontSize: 11, fontWeight: hotColdTheme === t ? 600 : 400, textTransform: 'capitalize',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <button className="btn btn-secondary btn-sm" onClick={downloadJpeg} disabled={rendering}>
                  Download JPEG
                </button>
              </div>
            </div>

            <div style={{ padding: 18 }}>
              {error && (
                <div style={{ padding: 12, marginBottom: 12, background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, fontSize: 13, color: '#e74c3c' }}>
                  {error}
                </div>
              )}
              <div
                style={{
                  aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden',
                  maxWidth: 540, margin: '0 auto', position: 'relative',
                  background: template === 'outbound' ? '#fff' : '#141414',
                  cursor: rendering ? 'default' : 'zoom-in',
                }}
                onClick={() => {
                  if (rendering || !canvasRef.current) return
                  openLightbox(canvasRef.current.toDataURL('image/png'))
                }}
              >
                {rendering && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 1 }}>
                    <span style={{ color: '#fff', fontSize: 13 }}>Rendering…</span>
                  </div>
                )}
                <canvas ref={canvasRef} width={1080} height={1080} style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                Click to see preview &nbsp;·&nbsp; Download is full 1080 × 1080 px
              </p>
              <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                Location search © OpenStreetMap contributors
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
