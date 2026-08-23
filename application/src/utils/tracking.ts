import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { LivePhase, LatLng, OrderStatus } from '../services/api';

// ─── Amravati geography (must match the backend constants) ──────────────────
export const AMRAVATI_BOUNDS = { minLat: 20.85, maxLat: 21.01, minLng: 77.65, maxLng: 77.85 };
export const AMRAVATI_CENTER: LatLng = { lat: 20.9320, lng: 77.7523 };

/** True when a coordinate falls inside the Amravati delivery service area. */
export const isWithinAmravati = (lat: number, lng: number): boolean =>
  lat >= AMRAVATI_BOUNDS.minLat && lat <= AMRAVATI_BOUNDS.maxLat &&
  lng >= AMRAVATI_BOUNDS.minLng && lng <= AMRAVATI_BOUNDS.maxLng;

// ─── Live-journey phases → UI config (label, icon, colour) ──────────────────
type IconName = keyof typeof Ionicons.glyphMap;

export interface PhaseMeta {
  key: LivePhase;
  label: string;
  sub: string;
  icon: IconName;
  color: string;
}

export const PHASES: PhaseMeta[] = [
  { key: 'preparing',  label: 'Preparing your order', sub: 'The store is packing your items', icon: 'cube-outline',      color: COLORS.warning },
  { key: 'picked',     label: 'Picked up',            sub: 'Rider has collected your order',  icon: 'bag-check-outline', color: COLORS.secondaryDark },
  { key: 'on_the_way', label: 'On the way',           sub: 'Your rider is heading to you',    icon: 'navigate-outline',  color: COLORS.purple },
  { key: 'nearby',     label: 'Almost there',         sub: 'Rider is arriving nearby',        icon: 'location-outline',  color: COLORS.accent },
  { key: 'delivered',  label: 'Delivered',            sub: 'Enjoy! Thanks for shopping',      icon: 'checkmark-done-circle-outline', color: COLORS.success },
];

export const phaseIndex = (phase: LivePhase | null): number => {
  const i = PHASES.findIndex((p) => p.key === phase);
  return i < 0 ? 0 : i;
};

export const phaseMeta = (phase: LivePhase | null): PhaseMeta => PHASES[phaseIndex(phase)];

/**
 * Derive a live phase from the canonical order status, for orders that were
 * placed before the tracking phase existed (or aren't dispatched yet).
 */
export const phaseFromStatus = (status: OrderStatus, phase: LivePhase | null): LivePhase | null => {
  if (phase) return phase;
  switch (status) {
    case 'pending':
    case 'confirmed': return 'preparing';
    case 'shipped':   return 'on_the_way';
    case 'delivered': return 'delivered';
    default:          return null;
  }
};

// ─── Projection: lat/lng → pixel coordinates inside a WxH canvas ────────────
export interface BBox { minLat: number; maxLat: number; minLng: number; maxLng: number; }

/** Bounding box around a set of points, padded by `pad` fraction (0..1). */
export const bboxOf = (points: LatLng[], pad = 0.18): BBox => {
  if (points.length === 0) return { ...AMRAVATI_BOUNDS };
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  // Guard against a zero-span box (single point) so projection never divides by 0.
  const latSpan = Math.max(maxLat - minLat, 0.004);
  const lngSpan = Math.max(maxLng - minLng, 0.004);
  return {
    minLat: minLat - latSpan * pad, maxLat: maxLat + latSpan * pad,
    minLng: minLng - lngSpan * pad, maxLng: maxLng + lngSpan * pad,
  };
};

export interface XY { x: number; y: number; }

/**
 * Build a projector that maps lat/lng into a WxH box, preserving aspect ratio
 * and centring the content (letterboxing) so the route isn't distorted.
 */
export const makeProjector = (bbox: BBox, W: number, H: number): ((p: LatLng) => XY) => {
  const lngSpan = bbox.maxLng - bbox.minLng;
  const latSpan = bbox.maxLat - bbox.minLat;
  const scale = Math.min(W / lngSpan, H / latSpan);
  const offsetX = (W - lngSpan * scale) / 2;
  const offsetY = (H - latSpan * scale) / 2;
  return (p: LatLng): XY => ({
    x: offsetX + (p.lng - bbox.minLng) * scale,
    // Latitude grows upward, screen y grows downward → invert.
    y: offsetY + (bbox.maxLat - p.lat) * scale,
  });
};

/** Split a projected route into completed (0..progress) and remaining segments. */
export const splitByProgress = (pts: XY[], progress: number): { done: XY[]; rest: XY[] } => {
  if (pts.length < 2) return { done: pts, rest: pts };
  const cut = Math.max(0, Math.min(1, progress)) * (pts.length - 1);
  const idx = Math.floor(cut);
  const done = pts.slice(0, idx + 1);
  const rest = pts.slice(idx);
  return { done, rest };
};
