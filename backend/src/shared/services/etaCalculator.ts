import { CITY_SPEED_KMH } from '../config/amravati';

/**
 * ETA in whole minutes from the remaining along-route distance, assuming the
 * city cruising speed. Clamped to a minimum of 1 minute while any distance
 * remains (so a moving order never shows "0 min" until it's basically there).
 */
export const etaMinutes = (
  distanceRemainingKm: number,
  speedKmh: number = CITY_SPEED_KMH
): number => {
  if (distanceRemainingKm <= 0.03) return 0; // within ~30 m → arrived
  const mins = (distanceRemainingKm / speedKmh) * 60;
  return Math.max(1, Math.round(mins));
};
