import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { LivePhase, LatLng, OrderStatus } from '../services/api';

// ─── Map defaults (delivery is not restricted to any single city/region) ────
/** Fallback pin position before the user has picked a location or granted GPS
 *  — roughly the geographic centre of India, not a service-area boundary. */
export const DEFAULT_MAP_CENTER: LatLng = { lat: 22.9734, lng: 78.6569 };

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

/** Order statuses for which live tracking is meaningful (dispatched, not yet delivered/cancelled). */
export const TRACKABLE_STATUSES = new Set<OrderStatus>(['pending', 'confirmed', 'shipped']);

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

/** Small placeholder box around the default centre, used only when there are no points to frame. */
const EMPTY_BBOX: BBox = {
  minLat: DEFAULT_MAP_CENTER.lat - 0.05, maxLat: DEFAULT_MAP_CENTER.lat + 0.05,
  minLng: DEFAULT_MAP_CENTER.lng - 0.05, maxLng: DEFAULT_MAP_CENTER.lng + 0.05,
};

/** Bounding box around a set of points, padded by `pad` fraction (0..1). */
export const bboxOf = (points: LatLng[], pad = 0.18): BBox => {
  if (points.length === 0) return { ...EMPTY_BBOX };
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
