import { LatLng } from '../config/amravati';
import { haversineKm, projectPointToSegment } from './geo';

export interface SnapResult {
  /** Closest point on the route to the raw GPS. */
  snapped: LatLng;
  /** Index of the polyline segment (i) the snap landed on, between point i and i+1. */
  segmentIndex: number;
  /** Perpendicular distance from raw GPS to the route (km). */
  distanceToRouteKm: number;
  /** Distance travelled along the route from its start to the snapped point (km). */
  distanceAlongKm: number;
  /** Total route length (km). */
  totalKm: number;
  /** Remaining distance to the route end (km). */
  distanceRemainingKm: number;
  /** Progress fraction 0..1 along the route. */
  progress: number;
}

/**
 * Snap a raw GPS point onto the cached route polyline.
 *
 * Pure geometry over the already-fetched polyline — never calls OSRM. Finds the
 * nearest segment (smallest perpendicular distance), then measures how far along
 * the route that snapped point sits so ETA/remaining distance can be derived.
 */
export const snapToRoute = (polyline: LatLng[], raw: LatLng): SnapResult => {
  if (polyline.length === 0) {
    return {
      snapped: raw, segmentIndex: 0, distanceToRouteKm: 0,
      distanceAlongKm: 0, totalKm: 0, distanceRemainingKm: 0, progress: 0,
    };
  }
  if (polyline.length === 1) {
    const d = haversineKm(raw, polyline[0]);
    return {
      snapped: polyline[0], segmentIndex: 0, distanceToRouteKm: d,
      distanceAlongKm: 0, totalKm: 0, distanceRemainingKm: 0, progress: 0,
    };
  }

  // Cumulative distance to the START of each segment, plus the grand total.
  const cum: number[] = [0];
  for (let i = 1; i < polyline.length; i++) {
    cum.push(cum[i - 1] + haversineKm(polyline[i - 1], polyline[i]));
  }
  const totalKm = cum[cum.length - 1];

  let best = {
    segmentIndex: 0,
    snapped: polyline[0],
    distanceToRouteKm: Infinity,
    distanceAlongKm: 0,
  };

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const { point, t, distanceKm } = projectPointToSegment(raw, a, b);
    if (distanceKm < best.distanceToRouteKm) {
      const segLen = haversineKm(a, b);
      best = {
        segmentIndex: i,
        snapped: point,
        distanceToRouteKm: distanceKm,
        distanceAlongKm: cum[i] + t * segLen,
      };
    }
  }

  const distanceAlongKm = Math.min(best.distanceAlongKm, totalKm);
  const distanceRemainingKm = Math.max(0, totalKm - distanceAlongKm);
  const progress = totalKm === 0 ? 0 : distanceAlongKm / totalKm;

  return {
    snapped: best.snapped,
    segmentIndex: best.segmentIndex,
    distanceToRouteKm: best.distanceToRouteKm,
    distanceAlongKm,
    totalKm,
    distanceRemainingKm,
    progress,
  };
};
