// Bar search on real OpenStreetMap data (Overpass API) and place search (Nominatim).
// Both are free and need no API key. Sample data is only used when the data source
// cannot be reached and is always marked as such in the UI.
import { Platform } from 'react-native';
import type { BarCandidate } from './types';

export type Origin = { lat: number; lng: number; label: string };

const USER_AGENT = 'ShishaConnect/1.0 (private group app)';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function addressFromTags(tags: Record<string, string>): string | null {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const full = [street, city].filter(Boolean).join(', ');
  return full || tags['addr:full'] || null;
}

async function fetchWithTimeout(input: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Shisha / hookah bars from OpenStreetMap around a point. Throws if no endpoint is reachable. */
export async function searchOsmBars(origin: Origin, radiusKm: number): Promise<BarCandidate[]> {
  const r = Math.round(radiusKm * 1000);
  const around = `(around:${r},${origin.lat},${origin.lng})`;
  const query = `[out:json][timeout:25];
(
  nwr["amenity"="hookah_lounge"]${around};
  nwr["shisha"~"^(yes|only)$"]${around};
  nwr["smoking"="hookah"]${around};
  nwr["name"~"shisha|hookah|nargile|narghile",i]["amenity"~"^(bar|pub|cafe|restaurant|nightclub|lounge)$"]${around};
);
out center tags 100;`;

  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
          body: `data=${encodeURIComponent(query)}`,
        },
        20000,
      );
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const data = (await response.json()) as { elements: OverpassElement[] };
      const bars: BarCandidate[] = [];
      for (const el of data.elements) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const tags = el.tags ?? {};
        if (lat == null || lng == null || !tags.name) continue;
        const externalId = `osm:${el.type}/${el.id}`;
        bars.push({
          key: externalId,
          external_id: externalId,
          name: tags.name,
          address: addressFromTags(tags),
          lat,
          lng,
          opening_hours: tags.opening_hours ?? null,
          website: tags.website ?? tags['contact:website'] ?? null,
          phone: tags.phone ?? tags['contact:phone'] ?? null,
          source: 'osm',
          distanceKm: distanceKm(origin, { lat, lng }),
        });
      }
      return bars.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Keine Datenquelle erreichbar');
}

/** Turns a typed place ("Zürich HB", "8004") into coordinates. */
export async function geocode(query: string): Promise<Origin | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=de&q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } }, 15000);
  if (!response.ok) throw new Error(`Ortssuche fehlgeschlagen (${response.status})`);
  const results = (await response.json()) as { lat: string; lon: string; display_name: string; name?: string }[];
  const first = results[0];
  if (!first) return null;
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    label: first.name || first.display_name.split(',')[0] || query,
  };
}

/** Clearly labelled sample bars – only used when no real data source is reachable. */
export function sampleBars(origin: Origin): BarCandidate[] {
  const samples = [
    { name: 'Beispiel-Lounge Amber', dLat: 0.004, dLng: 0.006, hours: 'Mo-Su 17:00-02:00' },
    { name: 'Beispiel-Bar Wolke 7', dLat: -0.007, dLng: 0.002, hours: 'Th-Sa 19:00-03:00' },
    { name: 'Beispiel-Café Nargile', dLat: 0.011, dLng: -0.009, hours: null },
  ];
  return samples.map((s, i) => {
    const lat = origin.lat + s.dLat;
    const lng = origin.lng + s.dLng;
    return {
      key: `sample:${i}`,
      external_id: `sample:${i}`,
      name: s.name,
      address: 'Beispieldaten – keine echte Adresse',
      lat,
      lng,
      opening_hours: s.hours,
      source: 'sample' as const,
      distanceKm: distanceKm(origin, { lat, lng }),
    };
  });
}

const DAY_NAMES: Record<string, string> = { Mo: 'Mo', Tu: 'Di', We: 'Mi', Th: 'Do', Fr: 'Fr', Sa: 'Sa', Su: 'So', PH: 'Feiertage' };

/** OSM opening_hours in German day abbreviations, one rule per line. */
export function formatOpeningHours(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAY_NAMES[d] ?? d)
    .replace(/\boff\b/g, 'geschlossen')
    .split(/\s*;\s*/)
    .join('\n');
}

export function navigationUrl(bar: Pick<BarCandidate, 'lat' | 'lng' | 'name' | 'address'>): string {
  const hasCoords = bar.lat != null && bar.lng != null;
  const destination = hasCoords ? `${bar.lat},${bar.lng}` : `${bar.name} ${bar.address ?? ''}`.trim();
  if (Platform.OS === 'ios') {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&q=${encodeURIComponent(bar.name)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function barKey(bar: { id?: string; external_id?: string | null }): string {
  return bar.external_id || `bar:${bar.id}`;
}
