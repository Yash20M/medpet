import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin, Wifi, WifiOff } from 'lucide-react';
import { api } from '../api';
import DeliveryAnalytics from './DeliveryAnalytics';
import { useAdminSocket } from '../hooks/useAdminSocket';
import {
  ActiveDriver, LocationBroadcast, StatusChange, LivePhase, PHASE_COLOR, PHASE_LABEL,
} from '../liveTypes';

const AMRAVATI_CENTER: [number, number] = [20.9320, 77.7523];
const AMRAVATI_BOUNDS: [[number, number], [number, number]] = [[20.85, 77.65], [21.01, 77.85]];

const phaseColor = (phase: LivePhase | null): string => (phase ? PHASE_COLOR[phase] : '#94A3B8');

/** Leaflet divIcon: a coloured pin with the order number label + scooter glyph. */
const makeIcon = (phase: LivePhase | null, label: string): L.DivIcon => {
  const color = phaseColor(phase);
  return L.divIcon({
    className: 'medpet-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">
        <div style="background:${color};color:#fff;font:700 10px system-ui;padding:2px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);margin-bottom:2px">${label}</div>
        <div style="width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid ${color};display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.4);font-size:13px">🛵</div>
      </div>`,
    iconSize: [26, 40],
    iconAnchor: [13, 34],
  });
};

const popupHtml = (d: ActiveDriver): string => `
  <div style="font:400 12px system-ui;min-width:170px">
    <div style="font-weight:800;font-size:13px;margin-bottom:4px">${d.orderNumber}</div>
    <div><b>Customer:</b> ${d.customerName ?? '—'}</div>
    <div><b>Rider:</b> ${d.driverName ?? '—'}</div>
    <div><b>Status:</b> ${d.phase ? PHASE_LABEL[d.phase] : '—'}</div>
    <div><b>ETA:</b> ${d.etaMinutes != null ? `${d.etaMinutes} min` : '—'}${d.distanceRemainingKm != null ? ` · ${d.distanceRemainingKm.toFixed(1)} km` : ''}</div>
  </div>`;

export default function LiveMap() {
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const [drivers, setDrivers] = useState<Record<number, ActiveDriver>>({});
  const [connected, setConnected] = useState(false);

  // ── Initialise the Leaflet map once ───────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: AMRAVATI_CENTER, zoom: 13, minZoom: 12, maxZoom: 18,
      maxBounds: L.latLngBounds(AMRAVATI_BOUNDS), maxBoundsViscosity: 0.9,
      zoomControl: true, attributionControl: true,
    });
    // Free CARTO dark tiles — no API key.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = {}; };
  }, []);

  // ── Upsert a marker for one delivery ──────────────────────────────────────
  const upsertMarker = useCallback((d: ActiveDriver) => {
    const map = mapRef.current;
    if (!map || d.lat == null || d.lng == null) return;
    const existing = markersRef.current[d.orderId];
    if (existing) {
      existing.setLatLng([d.lat, d.lng]);
      existing.setIcon(makeIcon(d.phase, d.orderNumber));
      existing.setPopupContent(popupHtml(d));
    } else {
      const m = L.marker([d.lat, d.lng], { icon: makeIcon(d.phase, d.orderNumber) })
        .addTo(map)
        .bindPopup(popupHtml(d));
      markersRef.current[d.orderId] = m;
    }
  }, []);

  const removeMarker = useCallback((orderId: number) => {
    const m = markersRef.current[orderId];
    if (m) { m.remove(); delete markersRef.current[orderId]; }
  }, []);

  // ── Full refresh (initial load + 15s prune of finished deliveries) ────────
  const refresh = useCallback(async () => {
    try {
      const list = await api.activeDrivers();
      const next: Record<number, ActiveDriver> = {};
      for (const d of list) { next[d.orderId] = d; upsertMarker(d); }
      // Remove markers for orders no longer active.
      for (const idStr of Object.keys(markersRef.current)) {
        const id = Number(idStr);
        if (!next[id]) removeMarker(id);
      }
      setDrivers(next);
    } catch { /* keep last */ }
  }, [upsertMarker, removeMarker]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  // ── Live socket updates ───────────────────────────────────────────────────
  const onLocation = useCallback((p: LocationBroadcast) => {
    setDrivers((prev) => {
      const existing = prev[p.orderId];
      if (!existing) { void refresh(); return prev; } // new order — pull its details
      const merged: ActiveDriver = {
        ...existing, lat: p.lat, lng: p.lng, phase: p.phase,
        etaMinutes: p.eta, distanceRemainingKm: p.distanceRemaining,
      };
      upsertMarker(merged);
      if (p.phase === 'delivered') removeMarker(p.orderId);
      const next = { ...prev, [p.orderId]: merged };
      if (p.phase === 'delivered') delete next[p.orderId];
      return next;
    });
  }, [refresh, upsertMarker, removeMarker]);

  const onStatus = useCallback((p: StatusChange) => {
    setDrivers((prev) => {
      const existing = prev[p.orderId];
      if (!existing) return prev;
      const merged = { ...existing, phase: p.newStatus };
      upsertMarker(merged);
      return { ...prev, [p.orderId]: merged };
    });
  }, [upsertMarker]);

  useAdminSocket({ onLocation, onStatus, onConnected: setConnected });

  const focus = (d: ActiveDriver): void => {
    if (d.lat == null || d.lng == null || !mapRef.current) return;
    mapRef.current.flyTo([d.lat, d.lng], 16, { duration: 0.6 });
    markersRef.current[d.orderId]?.openPopup();
  };

  const list = Object.values(drivers);

  return (
    <div className="space-y-4">
      <DeliveryAnalytics />
      <div className="rounded-2xl overflow-hidden border relative" style={{ borderColor: 'var(--border)', height: '66vh' }}>
      <div ref={mapDivRef} className="absolute inset-0" style={{ background: '#0b1220' }} />

      {/* Live deliveries panel */}
      <div className="absolute top-4 left-4 z-[500] w-72 max-h-[calc(78vh-2rem)] flex flex-col rounded-xl bg-white/95 backdrop-blur shadow-float border"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-brand-600" />
            <span className="font-extrabold text-sm text-ink">Live deliveries</span>
            <span className="text-xs font-bold text-white bg-brand-500 rounded-full px-2 py-0.5">{list.length}</span>
          </div>
          {connected
            ? <span className="flex items-center gap-1 text-[11px] font-bold text-green-600"><Wifi size={13} /> Live</span>
            : <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500"><WifiOff size={13} /> Offline</span>}
        </div>

        <div className="overflow-y-auto flex-1">
          {list.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--gray)' }}>
              No active deliveries right now.
            </div>
          )}
          {list.map((d) => (
            <button key={d.orderId} onClick={() => focus(d)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b hover:bg-black/5 text-left"
              style={{ borderColor: 'var(--border)' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: phaseColor(d.phase) }} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[13px] text-ink truncate">{d.orderNumber} · {d.customerName}</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--gray)' }}>
                  {d.driverName ?? 'Unassigned'} · {d.phase ? PHASE_LABEL[d.phase] : '—'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12px] font-extrabold text-ink">{d.etaMinutes != null ? `${d.etaMinutes}m` : '—'}</div>
                <div className="text-[10px]" style={{ color: 'var(--gray)' }}>{d.distanceRemainingKm != null ? `${d.distanceRemainingKm.toFixed(1)}km` : ''}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 border-t flex flex-wrap gap-x-3 gap-y-1" style={{ borderColor: 'var(--border)' }}>
          {(Object.keys(PHASE_LABEL) as LivePhase[]).filter((p) => p !== 'delivered').map((p) => (
            <span key={p} className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--gray)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: PHASE_COLOR[p] }} />{PHASE_LABEL[p]}
            </span>
          ))}
        </div>
      </div>

      {/* City badge */}
      <div className="absolute bottom-4 right-4 z-[500] flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 shadow-float text-[12px] font-bold text-ink">
        <MapPin size={13} className="text-brand-600" /> Amravati
      </div>
      </div>
    </div>
  );
}
