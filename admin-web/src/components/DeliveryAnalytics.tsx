import { useEffect, useState, useCallback } from 'react';
import { Timer, PackageCheck, Truck, Target, Medal, MapPin } from 'lucide-react';
import { api } from '../api';
import { DeliveryAnalytics as Analytics } from '../liveTypes';

const fmtMins = (m: number | null): string => (m == null ? '—' : m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(m < 10 ? 1 : 0)} min`);

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white border px-4 py-3 flex-1 min-w-[150px]" style={{ borderColor: 'var(--border)' }}>
      <div className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: `${tone}1a`, color: tone }}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: 'var(--gray)' }}>{label}</div>
        <div className="text-lg font-extrabold text-ink leading-tight">{value}</div>
      </div>
    </div>
  );
}

export default function DeliveryAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.deliveryAnalytics()); } catch { /* keep last */ }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, [load]);

  const maxZone = data ? Math.max(1, ...data.zones.map((z) => z.count)) : 1;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="flex flex-wrap gap-3">
        <Kpi icon={<Truck size={18} />}       label="Active now"      value={data ? String(data.activeNow) : '—'}                 tone="#8B5CF6" />
        <Kpi icon={<PackageCheck size={18} />} label="Delivered today" value={data ? String(data.deliveredToday) : '—'}            tone="#10B981" />
        <Kpi icon={<Timer size={18} />}        label="Avg delivery"    value={data ? fmtMins(data.avgDeliveryMinutes) : '—'}       tone="#0EA5E9" />
        <Kpi icon={<Target size={18} />}       label="ETA accuracy"    value={data?.etaAccuracyPct != null ? `${data.etaAccuracyPct}%` : '—'} tone="#FB923C" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top riders */}
        <div className="rounded-xl bg-white border p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Medal size={16} className="text-brand-600" />
            <span className="font-extrabold text-sm text-ink">Top riders</span>
          </div>
          {!data?.topDrivers.length && <div className="text-[13px] py-4 text-center" style={{ color: 'var(--gray)' }}>No completed deliveries yet.</div>}
          <div className="space-y-2">
            {data?.topDrivers.map((d, i) => (
              <div key={d.driverId} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : '#CBD5E1' }}>{i + 1}</span>
                <span className="flex-1 text-[13px] font-semibold text-ink truncate">{d.name}</span>
                <span className="text-[12px]" style={{ color: 'var(--gray)' }}>{fmtMins(d.avgMinutes)} avg</span>
                <span className="text-[13px] font-extrabold text-ink w-10 text-right">{d.deliveries}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Busiest drop zones */}
        <div className="rounded-xl bg-white border p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-brand-600" />
            <span className="font-extrabold text-sm text-ink">Busiest drop zones</span>
          </div>
          {!data?.zones.length && <div className="text-[13px] py-4 text-center" style={{ color: 'var(--gray)' }}>No delivery zones yet.</div>}
          <div className="space-y-2">
            {data?.zones.map((z) => (
              <div key={`${z.lat},${z.lng}`} className="flex items-center gap-3">
                <span className="text-[12px] font-mono w-28 shrink-0" style={{ color: 'var(--gray)' }}>{z.lat.toFixed(2)}, {z.lng.toFixed(2)}</span>
                <div className="flex-1 h-2.5 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(z.count / maxZone) * 100}%` }} />
                </div>
                <span className="text-[13px] font-extrabold text-ink w-8 text-right">{z.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
