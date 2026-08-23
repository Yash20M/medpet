import { LatLng, AMRAVATI_BOUNDS, AMRAVATI_CENTER } from '../config/amravati';

export interface RouteResult {
  polyline: LatLng[];      // ordered [{lat,lng}, ...]
  distanceKm: number;
  estimatedMinutes: number;
}

// Free public endpoints — no API key, no signup.
const OSRM_BASE = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
const NOMINATIM_BASE = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';
// Nominatim's usage policy requires an identifying User-Agent.
const USER_AGENT = process.env.GEO_USER_AGENT ?? 'MedPet-Delivery/1.0 (Amravati)';

interface OsrmResponse {
  code: string;
  routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[];
}

/**
 * Fetch a driving route from OSRM. Call this ONCE at dispatch and cache the
 * result on the order — never on a GPS ping.
 *
 * OSRM returns GeoJSON coordinates as [lng, lat]; we flip to {lat, lng}.
 */
export const fetchRoute = async (pickup: LatLng, drop: LatLng): Promise<RouteResult> => {
  const url =
    `${OSRM_BASE}/route/v1/driving/` +
    `${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const data = (await res.json()) as OsrmResponse;
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM returned no route (code=${data.code})`);
  }

  const route = data.routes[0];
  const polyline: LatLng[] = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));

  return {
    polyline,
    distanceKm: Number((route.distance / 1000).toFixed(2)),
    estimatedMinutes: Math.max(1, Math.round(route.duration / 60)),
  };
};

interface NominatimHit {
  lat: string;
  lon: string;
}

/**
 * Geocode a free-text address to coordinates, biased to the Amravati bounding
 * box. Used only as a fallback when an order has no stored drop lat/lng.
 * Returns null when nothing sensible is found.
 */
export const geocodeAmravati = async (address: string): Promise<LatLng | null> => {
  if (!address?.trim()) return null;

  const { minLng, minLat, maxLng, maxLat } = AMRAVATI_BOUNDS;
  const params = new URLSearchParams({
    q: `${address}, Amravati, Maharashtra, India`,
    format: 'json',
    limit: '1',
    countrycodes: 'in',
    // viewbox is left,top,right,bottom = minLng,maxLat,maxLng,minLat
    viewbox: `${minLng},${maxLat},${maxLng},${minLat}`,
    bounded: '1',
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const hits = (await res.json()) as NominatimHit[];
    if (!hits.length) return null;
    return { lat: Number(hits[0].lat), lng: Number(hits[0].lon) };
  } catch {
    return null;
  }
};

/** Amravati centre — last-resort drop when geocoding also fails. */
export const fallbackDrop = (): LatLng => ({ ...AMRAVATI_CENTER });
