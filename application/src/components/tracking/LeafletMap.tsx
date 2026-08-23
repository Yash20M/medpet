import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { LatLng } from '../../services/api';
import { AMRAVATI_CENTER, AMRAVATI_BOUNDS } from '../../utils/tracking';

interface Props {
  pickup: LatLng | null;
  drop: LatLng | null;
  polyline: LatLng[];
  driver: LatLng | null;
  progress: number;
  heading?: number;
  height: number;
  delivered?: boolean;
}

// Static HTML shell: Leaflet loaded from CDN, driven entirely by postMessage
// payloads sent from the RN side (see `update()` below). Kept as one template
// literal so there's no bundling/asset-serving step for the WebView content.
const HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #E5E7EB; }
    .leaflet-control-attribution { font-size: 9px; }
    .medpet-pin { display:flex; align-items:center; justify-content:center; }
    .medpet-driver { transition: transform 0.8s ease-in-out; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center = ${JSON.stringify(AMRAVATI_CENTER)};
    const bounds = ${JSON.stringify(AMRAVATI_BOUNDS)};
    const map = L.map('map', {
      center: [center.lat, center.lng], zoom: 14, minZoom: 11, maxZoom: 19,
      zoomControl: false, attributionControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);

    const icon = (html, size) => L.divIcon({ className: 'medpet-pin', html, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] });
    const pickupIcon = icon('<div style="width:28px;height:28px;border-radius:14px;background:#F59E0B;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.35)">🏬</div>', [28, 28]);
    const dropIcon = icon('<div style="width:28px;height:28px;border-radius:14px;background:#065F46;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.35)">🏠</div>', [28, 28]);
    const driverIcon = (delivered) => icon('<div class="medpet-driver" style="width:40px;height:40px;border-radius:20px;background:#fff;border:3px solid #10B981;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(16,185,129,.4)">' + (delivered ? '✅' : '🛵') + '</div>', [40, 40]);

    let pickupMarker = null, dropMarker = null, driverMarker = null;
    let doneLine = null, restLine = null;
    let fitted = false;

    function setRoute(polyline, progress) {
      if (doneLine) { map.removeLayer(doneLine); doneLine = null; }
      if (restLine) { map.removeLayer(restLine); restLine = null; }
      if (!polyline || polyline.length < 2) return;
      const latlngs = polyline.map(p => [p.lat, p.lng]);
      const cut = Math.max(0, Math.min(1, progress)) * (latlngs.length - 1);
      const idx = Math.floor(cut);
      const done = latlngs.slice(0, idx + 1);
      const rest = latlngs.slice(idx);
      if (rest.length > 1) restLine = L.polyline(rest, { color: '#94A3B8', weight: 4, opacity: 0.7 }).addTo(map);
      if (done.length > 1) doneLine = L.polyline(done, { color: '#10B981', weight: 5, opacity: 0.95 }).addTo(map);
    }

    function update(d) {
      if (d.pickup) {
        if (pickupMarker) pickupMarker.setLatLng([d.pickup.lat, d.pickup.lng]);
        else pickupMarker = L.marker([d.pickup.lat, d.pickup.lng], { icon: pickupIcon }).addTo(map);
      }
      if (d.drop) {
        if (dropMarker) dropMarker.setLatLng([d.drop.lat, d.drop.lng]);
        else dropMarker = L.marker([d.drop.lat, d.drop.lng], { icon: dropIcon }).addTo(map);
      }
      if (d.driver) {
        if (driverMarker) {
          driverMarker.setIcon(driverIcon(d.delivered));
          driverMarker.setLatLng([d.driver.lat, d.driver.lng]);
        } else {
          driverMarker = L.marker([d.driver.lat, d.driver.lng], { icon: driverIcon(d.delivered), zIndexOffset: 1000 }).addTo(map);
        }
      }
      setRoute(d.polyline, d.progress);

      if (!fitted) {
        const pts = [];
        if (d.polyline) d.polyline.forEach(p => pts.push([p.lat, p.lng]));
        if (d.pickup) pts.push([d.pickup.lat, d.pickup.lng]);
        if (d.drop) pts.push([d.drop.lat, d.drop.lng]);
        if (d.driver) pts.push([d.driver.lat, d.driver.lng]);
        if (pts.length > 1) { map.fitBounds(pts, { padding: [36, 36] }); fitted = true; }
        else if (d.driver) { map.setView([d.driver.lat, d.driver.lng], 15); fitted = true; }
      }
    }

    document.addEventListener('message', (e) => update(JSON.parse(e.data)));
    window.addEventListener('message', (e) => update(JSON.parse(e.data)));
  </script>
</body>
</html>
`;

/**
 * Real OpenStreetMap tiles (CARTO Voyager, key-free) rendered in a WebView,
 * driven by postMessage — same real GPS + OSRM route data as before, now
 * drawn on an actual street map instead of the stylized vector canvas.
 */
const LeafletMap = ({ pickup, drop, polyline, driver, progress, height, delivered }: Props) => {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const payload = useMemo(
    () => JSON.stringify({ pickup, drop, polyline, driver, progress, delivered }),
    [pickup, drop, polyline, driver, progress, delivered]
  );

  const send = (): void => {
    webviewRef.current?.postMessage(payload);
  };

  useEffect(() => {
    if (readyRef.current) send();
  }, [payload]);

  const onMessage = (_e: WebViewMessageEvent): void => {
    // Reserved for future map -> RN messages (e.g. marker taps).
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: HTML }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => { readyRef.current = true; send(); }}
        onMessage={onMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: '#E5E7EB' },
  web: { flex: 1, backgroundColor: 'transparent' },
});

export default LeafletMap;
