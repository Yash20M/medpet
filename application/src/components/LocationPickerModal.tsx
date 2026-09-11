import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS } from '../theme/colors';
import { DEFAULT_MAP_CENTER } from '../utils/tracking';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface Props {
  visible: boolean;
  initial?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
}

/** Assemble a readable single-line address from a reverse-geocode result. */
const buildAddress = (p: Location.LocationGeocodedAddress): string =>
  [p.name, p.street, p.district, p.city, p.region, p.postalCode]
    .filter((part, i, arr) => part && arr.indexOf(part) === i)
    .join(', ');

/**
 * Resolve a pin to a street address. Falls back to Nominatim (key-free, same
 * service the backend geocodes with) because the on-device geocoder is missing
 * or unreliable on emulators and devices without Google Play services.
 */
const resolveAddress = async (lat: number, lng: number): Promise<string> => {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const line = places.length ? buildAddress(places[0]) : '';
    if (line) return line;
  } catch { /* fall through */ }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`,
      { headers: { 'User-Agent': 'MedPet-Delivery/1.0' } }
    );
    if (!res.ok) return '';
    const data = (await res.json()) as { display_name?: string };
    // display_name runs all the way out to the country — keep the local part.
    return String(data.display_name ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean)
      .slice(0, 5).join(', ');
  } catch {
    return '';
  }
};

// The map pans under a pin fixed at the screen centre (Blinkit/Ola pattern) —
// the WebView only reports its centre back; the pin itself is a native overlay.
const html = (lat: number, lng: number): string => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #E5E7EB; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', {
      center: [${lat}, ${lng}], zoom: 17, minZoom: 12, maxZoom: 19,
      zoomControl: false, attributionControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);

    const post = (payload) =>
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));

    map.on('movestart', () => post({ type: 'movestart' }));
    map.on('moveend', () => {
      const c = map.getCenter();
      post({ type: 'moveend', lat: c.lat, lng: c.lng });
    });

    // RN -> map: recentre on a device GPS fix.
    function handle(raw) {
      const m = JSON.parse(raw);
      if (m.cmd === 'goto') map.setView([m.lat, m.lng], 17);
    }
    document.addEventListener('message', (e) => handle(e.data));
    window.addEventListener('message', (e) => handle(e.data));

    setTimeout(() => { const c = map.getCenter(); post({ type: 'moveend', lat: c.lat, lng: c.lng }); }, 300);
  </script>
</body>
</html>
`;

/** Full-screen "drop a pin on your house" picker with live reverse-geocoding. */
const LocationPickerModal = ({ visible, initial, onClose, onConfirm }: Props) => {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const startLat = initial?.latitude ?? DEFAULT_MAP_CENTER.lat;
  const startLng = initial?.longitude ?? DEFAULT_MAP_CENTER.lng;

  const [coords, setCoords] = useState({ lat: startLat, lng: startLng });
  const [address, setAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Reverse-geocode whenever the pin settles on a new spot (debounced, so a
  // flurry of small drags doesn't hammer the geocoder).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setResolving(true);
    const t = setTimeout(() => {
      resolveAddress(coords.lat, coords.lng)
        .then((line) => { if (!cancelled) setAddress(line); })
        .finally(() => { if (!cancelled) setResolving(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [coords.lat, coords.lng, visible]);

  const onMessage = (e: WebViewMessageEvent): void => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'movestart') setMoving(true);
      else if (msg.type === 'moveend') {
        setMoving(false);
        setCoords({ lat: msg.lat, lng: msg.lng });
      }
    } catch { /* ignore malformed */ }
  };

  const useMyLocation = async (): Promise<void> => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!pos) return;
      webviewRef.current?.postMessage(
        JSON.stringify({ cmd: 'goto', lat: pos.coords.latitude, lng: pos.coords.longitude })
      );
    } catch { /* keep the current pin */ } finally {
      setLocating(false);
    }
  };

  const confirm = (): void => {
    onConfirm({ latitude: coords.lat, longitude: coords.lng, address });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.safe}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: html(startLat, startLng) }}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
        />

        {/* Centre pin. The shadow marks the exact coordinate being picked; the
            pin's tip rests on it and lifts while the map is being dragged. */}
        <View style={styles.pinWrap} pointerEvents="none">
          <View style={styles.pinShadow} />
          <Ionicons
            name="location"
            size={44}
            color={COLORS.primary}
            style={[styles.pinIcon, moving && styles.pinIconLifted]}
          />
        </View>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Set delivery location</Text>
        </View>

        <TouchableOpacity style={styles.gpsBtn} onPress={useMyLocation} activeOpacity={0.85} disabled={locating}>
          {locating
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Ionicons name="locate" size={20} color={COLORS.primary} />}
        </TouchableOpacity>

        {/* Bottom sheet */}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetLabel}>DELIVERING YOUR ORDER TO</Text>
          <View style={styles.addrRow}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              {resolving ? (
                <Text style={styles.addrText}>Locating address…</Text>
              ) : (
                <Text style={styles.addrText} numberOfLines={2}>
                  {address || 'Pinned location'}
                </Text>
              )}
              <Text style={styles.coordText}>
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={confirm}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaText}>Confirm location</Text>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#E5E7EB' },
  web: { flex: 1, backgroundColor: 'transparent' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.black },
  pinWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // Sits dead-centre = the exact lat/lng the user is choosing.
  pinShadow: {
    position: 'absolute', width: 12, height: 5, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  // Raised by half the glyph so the pointed tip lands on the shadow.
  pinIcon: { position: 'absolute', transform: [{ translateY: -22 }] },
  pinIconLifted: { transform: [{ translateY: -32 }] },
  gpsBtn: {
    position: 'absolute', right: 16, bottom: 250,
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 12,
  },
  sheetLabel: { fontSize: 10, fontWeight: '800', color: COLORS.gray, letterSpacing: 0.8, marginBottom: 10 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  addrText: { fontSize: 14, fontWeight: '700', color: COLORS.black, lineHeight: 19 },
  coordText: { fontSize: 11, color: COLORS.gray, marginTop: 3 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
  },
  ctaText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});

export default LocationPickerModal;
