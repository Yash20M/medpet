import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { LatLng } from '../../services/api';
import { DEFAULT_MAP_CENTER } from '../../utils/tracking';

interface Props {
  pickup: LatLng | null;
  drop: LatLng | null;
  polyline: LatLng[];
  driver: LatLng | null;
  progress: number;
  heading?: number;
  height: number;
  delivered?: boolean;
  /** null = no ETA yet (not dispatched); drives the badge above the rider. */
  etaMinutes?: number | null;
  distanceRemainingKm?: number | null;
  /** Bump `nonce` to re-centre the map on demand (recenter button). */
  focusRequest?: { target: 'drop' | 'driver' | 'route'; nonce: number } | null;
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
    .medpet-driver { display:flex; flex-direction:column; align-items:center; }
    .medpet-eta {
      background:#0F172A; color:#fff; font:800 11px/1 system-ui,-apple-system,sans-serif;
      padding:5px 9px; border-radius:999px; white-space:nowrap; margin-bottom:3px;
      box-shadow:0 2px 8px rgba(0,0,0,.35); border:1.5px solid rgba(255,255,255,.25);
    }
    .medpet-bike {
      width:40px; height:40px; border-radius:20px; background:#fff; border:3px solid #10B981;
      display:flex; align-items:center; justify-content:center; font-size:18px;
      box-shadow:0 3px 10px rgba(16,185,129,.45);
    }
    /* Soft "live" halo so the rider reads as actively moving. */
    .medpet-bike.live::after {
      content:''; position:absolute; width:40px; height:40px; border-radius:20px;
      background:#10B981; opacity:.35; animation:medpet-pulse 1.8s ease-out infinite;
    }
    @keyframes medpet-pulse {
      0%   { transform:scale(1);   opacity:.35; }
      100% { transform:scale(2.4); opacity:0; }
    }
    /* Animate the marker gliding between GPS pings instead of teleporting. */
    .leaflet-marker-icon.medpet-driver-wrap { transition: transform 0.9s linear; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center = ${JSON.stringify(DEFAULT_MAP_CENTER)};
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
    // Rider marker = "X min" badge stacked above the scooter bubble (Blinkit-style).
    // Anchored so the bubble's centre — not the badge — sits on the GPS point.
    const etaLabel = (eta, delivered) => {
      if (delivered) return 'Delivered';
      if (eta === null || eta === undefined) return null;
      return eta <= 0 ? 'Arriving now' : eta + ' min';
    };
    const driverIcon = (eta, delivered) => {
      const label = etaLabel(eta, delivered);
      const badge = label ? '<div class="medpet-eta">' + label + '</div>' : '';
      const bike = '<div class="medpet-bike' + (delivered ? '' : ' live') + '">' + (delivered ? '✅' : '🛵') + '</div>';
      return L.divIcon({
        className: 'medpet-driver-wrap',
        html: '<div class="medpet-driver">' + badge + bike + '</div>',
        iconSize: [110, 66],
        iconAnchor: [55, 46],
      });
    };

    let pickupMarker = null, dropMarker = null, driverMarker = null;
    let doneLine = null, restLine = null;
    let fitted = false, fittedLive = false;
    let lastData = null, suspendFollowUntil = 0;

    function setRoute(polyline, progress, live) {
      if (doneLine) { map.removeLayer(doneLine); doneLine = null; }
      if (restLine) { map.removeLayer(restLine); restLine = null; }
      if (!polyline || polyline.length < 2) return;
      const latlngs = polyline.map(p => [p.lat, p.lng]);

      if (!live) {
        // No rider assigned yet — an illustrative "planned route" dashed line,
        // Blinkit's pre-pickup look (nobody is actually driving this path yet).
        restLine = L.polyline(latlngs, { color: '#94A3B8', weight: 4, opacity: 0.85, dashArray: '1,10', lineCap: 'round' }).addTo(map);
        return;
      }

      // Live: the road already covered fades back, and the rider's REMAINING
      // path to the customer is the hero line — that's "the driver's route".
      const cut = Math.max(0, Math.min(1, progress)) * (latlngs.length - 1);
      const idx = Math.floor(cut);
      const done = latlngs.slice(0, idx + 1);
      const rest = latlngs.slice(idx);
      if (done.length > 1) {
        doneLine = L.polyline(done, { color: '#CBD5E1', weight: 4, opacity: 0.75, lineCap: 'round' }).addTo(map);
      }
      if (rest.length > 1) {
        restLine = L.polyline(rest, { color: '#10B981', weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      }
    }

    // Manual re-centre from the RN side. Pauses rider auto-follow briefly so the
    // map doesn't immediately yank back to the scooter the user just panned away from.
    function focusOn(target) {
      const d = lastData;
      if (!d) return;
      suspendFollowUntil = Date.now() + 12000;
      if (target === 'drop' && d.drop) {
        map.flyTo([d.drop.lat, d.drop.lng], 17, { duration: 0.8 });
      } else if (target === 'driver' && d.driver) {
        map.flyTo([d.driver.lat, d.driver.lng], 16, { duration: 0.8 });
      } else {
        const pts = [];
        if (d.polyline) d.polyline.forEach(p => pts.push([p.lat, p.lng]));
        if (d.pickup) pts.push([d.pickup.lat, d.pickup.lng]);
        if (d.drop) pts.push([d.drop.lat, d.drop.lng]);
        if (d.driver) pts.push([d.driver.lat, d.driver.lng]);
        if (pts.length > 1) map.flyToBounds(pts, { padding: [40, 40], duration: 0.8 });
      }
    }

    function update(d) {
      lastData = d;
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
          driverMarker.setIcon(driverIcon(d.eta, d.delivered));
          driverMarker.setLatLng([d.driver.lat, d.driver.lng]);
        } else {
          driverMarker = L.marker([d.driver.lat, d.driver.lng], { icon: driverIcon(d.eta, d.delivered), zIndexOffset: 1000 }).addTo(map);
        }
      }
      const live = !!d.driver;
      setRoute(d.polyline, d.progress, live);

      if (live && d.drop) {
        // Follow the rider: frame rider + doorstep once, then pan only when the
        // rider drifts toward the edge, so the map isn't constantly jumping.
        const leg = L.latLngBounds([[d.driver.lat, d.driver.lng], [d.drop.lat, d.drop.lng]]);
        if (!fittedLive) {
          map.fitBounds(leg, { padding: [55, 55], maxZoom: 16 });
          fittedLive = true;
          fitted = true;
        } else if (
          Date.now() > suspendFollowUntil &&
          !map.getBounds().pad(-0.2).contains([d.driver.lat, d.driver.lng])
        ) {
          map.panTo([d.driver.lat, d.driver.lng], { animate: true, duration: 0.9 });
        }
        return;
      }

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

    function handle(raw) {
      const msg = JSON.parse(raw);
      if (msg && msg.cmd === 'focus') focusOn(msg.target);
      else update(msg);
    }
    document.addEventListener('message', (e) => handle(e.data));
    window.addEventListener('message', (e) => handle(e.data));
  </script>
</body>
</html>
`;

/**
 * Real OpenStreetMap tiles (CARTO Voyager, key-free) rendered in a WebView,
 * driven by postMessage — same real GPS + OSRM route data as before, now
 * drawn on an actual street map instead of the stylized vector canvas.
 */
const LeafletMap = ({
  pickup, drop, polyline, driver, progress, height, delivered, etaMinutes, focusRequest,
}: Props) => {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const payload = useMemo(
    () => JSON.stringify({ pickup, drop, polyline, driver, progress, delivered, eta: etaMinutes ?? null }),
    [pickup, drop, polyline, driver, progress, delivered, etaMinutes]
  );

  const send = (): void => {
    webviewRef.current?.postMessage(payload);
  };

  useEffect(() => {
    if (readyRef.current) send();
  }, [payload]);

  const nonce = focusRequest?.nonce ?? 0;
  useEffect(() => {
    if (!readyRef.current || !focusRequest || nonce === 0) return;
    webviewRef.current?.postMessage(JSON.stringify({ cmd: 'focus', target: focusRequest.target }));
  }, [nonce]);

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
