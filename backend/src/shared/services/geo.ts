import { LatLng } from '../config/amravati';

/** A route point as stored in JSONB: [lat, lng]. */
export type LatLngTuple = [number, number];

export const toTuple = (p: LatLng): LatLngTuple => [p.lat, p.lng];
export const fromTuple = ([lat, lng]: LatLngTuple): LatLng => ({ lat, lng });

const R_EARTH_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Great-circle distance between two points, in kilometres. */
export const haversineKm = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Compass bearing (0–360°, 0 = north) from `a` to `b`. */
export const bearingDeg = (a: LatLng, b: LatLng): number => {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/**
 * Project point `p` onto the segment a→b using a local equirectangular
 * approximation (fine for intra-city distances). Returns the closest point on
 * the segment, the clamped parameter t∈[0,1], and the perpendicular distance.
 */
export const projectPointToSegment = (
  p: LatLng,
  a: LatLng,
  b: LatLng
): { point: LatLng; t: number; distanceKm: number } => {
  // Work in a flat metric plane centred near the segment.
  const latRef = toRad((a.lat + b.lat) / 2);
  const x = (ll: LatLng): number => toRad(ll.lng) * Math.cos(latRef) * R_EARTH_KM;
  const y = (ll: LatLng): number => toRad(ll.lat) * R_EARTH_KM;

  const ax = x(a), ay = y(a);
  const bx = x(b), by = y(b);
  const px = x(p), py = y(p);

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const point: LatLng = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
  return { point, t, distanceKm: haversineKm(p, point) };
};

/** Total length of a polyline in km. */
export const polylineLengthKm = (poly: LatLng[]): number => {
  let sum = 0;
  for (let i = 1; i < poly.length; i++) sum += haversineKm(poly[i - 1], poly[i]);
  return sum;
};

/**
 * Linearly interpolate a position that is `fraction` (0..1) of the way along a
 * polyline — used by the simulator to walk a fake driver down the route.
 */
export const interpolateAlong = (poly: LatLng[], fraction: number): LatLng => {
  if (poly.length === 0) throw new Error('empty polyline');
  if (poly.length === 1) return poly[0];
  const total = polylineLengthKm(poly);
  const target = Math.max(0, Math.min(1, fraction)) * total;

  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const seg = haversineKm(poly[i - 1], poly[i]);
    if (acc + seg >= target) {
      const t = seg === 0 ? 0 : (target - acc) / seg;
      return {
        lat: poly[i - 1].lat + t * (poly[i].lat - poly[i - 1].lat),
        lng: poly[i - 1].lng + t * (poly[i].lng - poly[i - 1].lng),
      };
    }
    acc += seg;
  }
  return poly[poly.length - 1];
};
