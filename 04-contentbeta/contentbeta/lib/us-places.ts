import placesJson from '@/data/us-places.json'

export type UsPlace = [label: string, longitude: number, latitude: number]

export const usPlaces = placesJson as UsPlace[]

export function normalizePlace(value: string) {
  return value.trim().replace(/[-']/g, ' ').replace(/\s+/g, ' ').toLowerCase()
}

export function findLocalPlace(value: string): UsPlace | undefined {
  const query = normalizePlace(value)
  return usPlaces.find(place => normalizePlace(place[0]) === query)
}
