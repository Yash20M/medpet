/**
 * Google Maps deep links for the delivery partner. Opens the Google Maps app when
 * installed (Android intent-filters https://www.google.com/maps) or the browser otherwise.
 */
export interface MapTarget {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

export const googleMapsUrl = ({ latitude, longitude, address }: MapTarget): string | null => {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  }
  const text = address?.replace(/\s*\n\s*/g, ', ').trim();
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
};
