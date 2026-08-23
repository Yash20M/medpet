/**
 * Amravati city constants — the ONLY hard-coded coordinates allowed in the app.
 * Everything else (pickup, drop, driver) comes from live order data.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Geographic centre of Amravati, Maharashtra. */
export const AMRAVATI_CENTER: LatLng = { lat: 20.9320, lng: 77.7523 };

/**
 * City bounding box. All maps lock to this and pings outside it are rejected as
 * bogus GPS. Matches the Task 5 test bounds.
 */
export const AMRAVATI_BOUNDS = {
  minLat: 20.85,
  maxLat: 21.01,
  minLng: 77.65,
  maxLng: 77.85,
} as const;

/** Default store / warehouse the orders are dispatched from. */
export const STORE_LOCATION: LatLng = { lat: 20.9370, lng: 77.7710 };

/** Average city driving speed used for ETA (km/h). */
export const CITY_SPEED_KMH = 18;

export const isWithinAmravati = ({ lat, lng }: LatLng): boolean =>
  lat >= AMRAVATI_BOUNDS.minLat &&
  lat <= AMRAVATI_BOUNDS.maxLat &&
  lng >= AMRAVATI_BOUNDS.minLng &&
  lng <= AMRAVATI_BOUNDS.maxLng;
