import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { getSocket } from '../services/socket';
import { trackingAPI } from '../services/api';

export type LocationPermission = 'granted' | 'denied' | 'pending';

export interface DriverPosition {
  lat: number;
  lng: number;
  heading: number;
  speed: number; // km/h
}

interface UseDriverLocation {
  permission: LocationPermission;
  position: DriverPosition | null;
  sending: boolean;
  error: string | null;
}

const MIN_INTERVAL_MS = 3000;   // normal ping cadence
const IDLE_INTERVAL_MS = 10_000; // slowed cadence when nearly stopped
const IDLE_SPEED_KMH = 2;       // below this = "stopped"
const IDLE_AFTER_MS = 30_000;   // must be slow this long before slowing pings

/**
 * Foreground GPS sender for the delivery partner. Watches position via
 * expo-location and emits `driver:location-update` over the shared socket every
 * ~3 s (10 m distance filter). Slows to every 10 s when the rider is stopped to
 * save battery. (Background tracking needs expo-task-manager + a dev build.)
 */
export const useDriverLocation = (orderId: number, enabled: boolean): UseDriverLocation => {
  const [permission, setPermission] = useState<LocationPermission>('pending');
  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastEmitRef = useRef(0);
  const slowSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') { setPermission('denied'); return; }
        setPermission('granted');

        const socket = await getSocket();

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: MIN_INTERVAL_MS },
          (loc) => {
            const speedKmh = Math.max(0, (loc.coords.speed ?? 0) * 3.6);
            const heading = loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : 0;
            const pos: DriverPosition = { lat: loc.coords.latitude, lng: loc.coords.longitude, heading, speed: speedKmh };
            setPosition(pos);

            // Battery optimisation: throttle pings when the rider is basically stopped.
            const now = Date.now();
            if (speedKmh < IDLE_SPEED_KMH) {
              slowSinceRef.current = slowSinceRef.current ?? now;
            } else {
              slowSinceRef.current = null;
            }
            const idle = slowSinceRef.current != null && now - slowSinceRef.current > IDLE_AFTER_MS;
            const minGap = idle ? IDLE_INTERVAL_MS : MIN_INTERVAL_MS;
            if (now - lastEmitRef.current < minGap) return;
            lastEmitRef.current = now;

            setSending(true);
            const payload = { orderId, lat: pos.lat, lng: pos.lng, heading: pos.heading, speed: pos.speed, timestamp: now };
            if (socket.connected) {
              socket.emit('driver:location-update', payload);
            } else {
              // Socket is down — don't drop the fix; POST it over REST instead.
              trackingAPI.ping(orderId, { lat: pos.lat, lng: pos.lng, heading: pos.heading, speed: pos.speed, timestamp: now })
                .catch(() => undefined);
            }
          }
        );
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      setSending(false);
    };
  }, [orderId, enabled]);

  return { permission, position, sending, error };
};
