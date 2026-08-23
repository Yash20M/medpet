import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from './api';

/**
 * Background delivery-location tracking.
 *
 * A background location task runs in a HEADLESS JS context that can't reach the
 * app's Socket.IO instance, so it POSTs each fix to the REST `/orders/:id/ping`
 * endpoint instead — the server then broadcasts to the customer/admin sockets.
 *
 * IMPORTANT: expo-task-manager needs a native module that is ABSENT from Expo Go
 * and from dev builds created before it was added. We load it defensively so the
 * app never crashes at startup when it's missing — background tracking is simply
 * unavailable (foreground `useDriverLocation` still works) until a development
 * build that includes the native module is installed.
 */
export const LOCATION_TASK = 'medpet-delivery-location';
const ORDER_KEY = 'activeDeliveryOrderId';

type TaskManagerModule = typeof import('expo-task-manager');

// Defensive load — never let a missing native module crash the bundle at import.
let TaskManager: TaskManagerModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  TaskManager = require('expo-task-manager') as TaskManagerModule;
} catch {
  TaskManager = null;
}

// Register the task only if the native module is actually present. If defineTask
// throws (native module not linked in this build), background stays disabled.
let backgroundReady = false;
if (TaskManager && typeof TaskManager.defineTask === 'function') {
  try {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: { data?: unknown; error?: unknown }) => {
      if (error) return;
      const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
      if (!locations?.length) return;

      const [orderId, token] = await Promise.all([
        SecureStore.getItemAsync(ORDER_KEY),
        SecureStore.getItemAsync('authToken'),
      ]);
      if (!orderId || !token) return;

      const loc = locations[locations.length - 1];
      const heading = loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : 0;
      const speed = Math.max(0, (loc.coords.speed ?? 0) * 3.6); // m/s → km/h

      try {
        await fetch(`${BASE_URL}/orders/${orderId}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude, heading, speed, timestamp: loc.timestamp }),
        });
      } catch {
        /* offline — the OS will deliver the next fix on the next interval */
      }
    });
    backgroundReady = true;
  } catch {
    backgroundReady = false; // native module missing → background unsupported
  }
}

/** True only when expo-task-manager's native module is present in this build. */
export const isBackgroundSupported = (): boolean => backgroundReady;

export const isBackgroundTracking = async (): Promise<boolean> => {
  if (!backgroundReady) return false;
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
};

export const startBackgroundTracking = async (orderId: number): Promise<void> => {
  if (!backgroundReady) {
    throw new Error('Background sharing needs a development build (it isn’t available in Expo Go or this build). Foreground sharing still works while this screen is open.');
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Location permission is required.');
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    throw new Error('Set location access to "Allow all the time" to share in the background.');
  }

  await SecureStore.setItemAsync(ORDER_KEY, String(orderId));
  if (await isBackgroundTracking()) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 3000,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'MedPet delivery in progress',
      notificationBody: 'Sharing your live location with the customer.',
      notificationColor: '#10B981',
    },
  });
};

export const stopBackgroundTracking = async (): Promise<void> => {
  if (backgroundReady && (await isBackgroundTracking())) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  await SecureStore.deleteItemAsync(ORDER_KEY).catch(() => undefined);
};
