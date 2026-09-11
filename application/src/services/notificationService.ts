import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-notifications';

/**
 * Native push-notification registration + listener wiring.
 *
 * ── Native FCM device token vs. Expo push token ─────────────────────────────
 * expo-notifications can hand back two very different kinds of token:
 *
 *   - `getExpoPushTokenAsync()` → an "Expo push token" (`ExponentPushToken[...]`).
 *     Sending to it means POSTing to Expo's own push relay, which then talks to
 *     FCM/APNs on your behalf. Convenient, but it puts Expo's service in the
 *     delivery path and only Expo can use that token.
 *
 *   - `getDevicePushTokenAsync()` → the RAW, NATIVE token issued directly by the
 *     platform push service itself: an FCM registration token on Android, an
 *     APNs device token on iOS. This is what we use here — our backend talks to
 *     Firebase Cloud Messaging directly via the Firebase Admin SDK, with no
 *     Expo relay involved at all (per the architecture this app is built for).
 *
 *   This DOES require a custom development/production build with
 *   `google-services.json` wired into `app.json` (see bottom of this file for
 *   what that means) — it will NOT return a usable token inside Expo Go, which
 *   only has Expo's own push credentials baked in, not this app's Firebase
 *   project.
 *
 * ── Why Firebase Admin SDK credentials must never ship in this app ─────────
 * The Admin SDK service-account key can send a push to *any* device registered
 * under the whole Firebase project (and reach other privileged Firebase APIs
 * besides). An app bundle (APK/IPA) is just a zip file anyone can unpack, so
 * anything placed in it must be treated as public. Bundling that key would let
 * any user extract it and impersonate our entire backend to every installed
 * copy of the app. The mobile app's only job is to obtain ITS OWN device token
 * and hand it to our own authenticated backend — the Admin SDK credentials
 * live only there, server-side, never inside the app.
 *
 *   Mobile app → FCM device token → backend → Firebase Admin SDK → FCM → device
 *
 * Sending the token to the backend is a separate, later step (not implemented
 * here) — this file only gets the token onto the device and into memory.
 */

export type PermissionStatus = Notifications.PermissionStatus;

const ANDROID_CHANNEL_ID = 'default';

const log = (...args: unknown[]): void => {
  if (__DEV__) console.log('[notifications]', ...args);
};
const warn = (...args: unknown[]): void => {
  if (__DEV__) console.warn('[notifications]', ...args);
};

// How a notification that arrives while the app is in the foreground should
// be presented. This only controls presentation — it doesn't request
// permission or a token, so it's safe to set at module load.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Android 8+ requires every notification to belong to a channel; the channel
 * (not the individual notification) controls sound/vibration/importance from
 * Android 8 onward. No-op on iOS. Safe to call more than once — it just
 * upserts the same channel.
 */
async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    showBadge: true,
  });
}

/** Current OS permission status — read-only, never prompts the user. */
export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Prompts for notification permission only if it hasn't already been decided.
 * On Android 13+ (API 33) this is what triggers the POST_NOTIFICATIONS system
 * dialog — expo-notifications handles that runtime permission internally, no
 * extra code needed on our side. On iOS it triggers the standard
 * alert/badge/sound prompt. A previously-denied permission is NOT re-prompted
 * (the OS won't show the dialog twice) — the caller gets back `'denied'` and
 * should degrade gracefully rather than retry.
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return existing.status;

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return requested.status;
}

/**
 * Reads the native FCM (Android) / APNs (iOS) device push token. Only
 * meaningful after permission has been granted and inside a physical device
 * / custom build — see the file-level comment above for why.
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    log('native device token acquired:', token.type);
    return String(token.data);
  } catch (err) {
    warn('failed to read device push token:', (err as Error).message);
    return null;
  }
}

/**
 * Full registration flow: device check → Android channel → permission →
 * native token. Call this ONCE, explicitly, after the user logs in — not on
 * every render and not unconditionally at app boot — so a token is only
 * requested for an authenticated user and is ready to hand to the backend
 * once that endpoint exists.
 *
 * Returns the native device push token, or `null` if push isn't available
 * (simulator/emulator, permission denied, or the token couldn't be read).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    warn('push notifications require a physical device — skipping (simulator/emulator detected).');
    return null;
  }

  await configureAndroidChannel();

  const status = await requestNotificationPermission();
  if (status !== 'granted') {
    warn(`permission not granted (status: "${status}") — cannot register for push.`);
    return null;
  }

  const token = await getFCMToken();
  if (!token) {
    warn('could not obtain a device push token.');
    return null;
  }

  log('registered for push — token ready to send to the backend.');
  return token;
}

/**
 * Wires up the two standard expo-notifications listeners and returns a
 * cleanup function that removes both — call the cleanup from a
 * `useEffect` teardown (or equivalent) to avoid leaking subscriptions.
 *
 *  - `onReceived`: a notification arrived while the app was in the foreground.
 *  - `onResponse`: the user tapped a notification — fires whether the app was
 *    foregrounded, backgrounded, or launched fresh from a killed state (the OS
 *    redelivers the tap once the app finishes starting up).
 */
export function setupNotificationListeners(
  onReceived?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void
): () => void {
  const receivedSub: EventSubscription = Notifications.addNotificationReceivedListener((notification) => {
    log('received in foreground:', notification.request.content.title);
    onReceived?.(notification);
  });

  const responseSub: EventSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    log('user tapped notification:', response.notification.request.content.title);
    onResponse?.(response);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
