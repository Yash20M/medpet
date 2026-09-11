/**
 * Delivery config — the ONLY hard-coded coordinates left are the warehouse the
 * orders ship from. Everything else (pickup override, drop, driver) comes from
 * live order data; delivery is not restricted to any single city/region.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Default store / warehouse the orders are dispatched from. */
export const STORE_LOCATION: LatLng = { lat: 20.9370, lng: 77.7710 };

/** Default average driving speed used for ETA (km/h) when no route-derived speed is available. */
export const CITY_SPEED_KMH = 18;
