import React, { useState, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '../../components/Icon';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deliveryAPI, DeliveryHistory, DeliveryHistoryRow, ApiError } from '../../services/api';
import { COLORS, GRADIENTS } from '../../theme/colors';
import FadeInView from '../../components/FadeInView';
import { DeliveryStackParamList } from '../../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<DeliveryStackParamList, 'DeliveryHistory'> };

const PAGE_SIZE = 20;
const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ─── Date helpers (local calendar days; the server buckets by IST) ────────────
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const isValidYmd = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00`);
  return !Number.isNaN(d.getTime()) && ymd(d) === v;
};
const prettyDay = (v: string) =>
  new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const prettyTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const addressLine = (address: string): string => {
  if (!address) return 'No address provided';
  const parts = address.split('\n');
  return (parts.length > 1 ? parts.slice(1).join(', ') : parts[0]).trim() || 'No address provided';
};

type PresetKey = 'today' | '7d' | '30d' | 'month' | 'custom';
const PRESETS: { key: Exclude<PresetKey, 'custom'>; label: string; range: () => { from: string; to: string } }[] = [
  { key: 'today', label: 'Today', range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { key: '7d', label: 'Last 7 days', range: () => ({ from: daysAgo(6), to: ymd(new Date()) }) },
  { key: '30d', label: 'Last 30 days', range: () => ({ from: daysAgo(29), to: ymd(new Date()) }) },
  { key: 'month', label: 'This month', range: () => { const n = new Date(); return { from: ymd(new Date(n.getFullYear(), n.getMonth(), 1)), to: ymd(n) }; } },
];

const DeliveryHistoryScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<PresetKey>('7d');
  const [range, setRange] = useState(PRESETS[1].range());
  const [fromText, setFromText] = useState(range.from);
  const [toText, setToText] = useState(range.to);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [data, setData] = useState<DeliveryHistory | null>(null);
  const [rows, setRows] = useState<DeliveryHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (page: number) => {
    const res = await deliveryAPI.history({ from: range.from, to: range.to, page, limit: PAGE_SIZE });
    return res.data;
  }, [range]);

  const loadFirst = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchPage(1);
      setData(d);
      setRows(d.orders);
    } catch (err) {
      setError((err as ApiError).message ?? 'Could not load history.');
    }
  }, [fetchPage]);

  useEffect(() => {
    (async () => { setLoading(true); await loadFirst(); setLoading(false); })();
  }, [loadFirst]);

  const onRefresh = async () => { setRefreshing(true); await loadFirst(); setRefreshing(false); };

  const loadMore = async () => {
    if (!data || loadingMore || data.pagination.page >= data.pagination.total_pages) return;
    setLoadingMore(true);
    try {
      const d = await fetchPage(data.pagination.page + 1);
      setData(d);
      setRows((prev) => [...prev, ...d.orders]);
    } catch (err) {
      setError((err as ApiError).message ?? 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  };

  const choosePreset = (p: (typeof PRESETS)[number]) => {
    const r = p.range();
    setPreset(p.key);
    setRange(r);
    setFromText(r.from);
    setToText(r.to);
    setRangeError(null);
  };

  const applyCustom = () => {
    const f = fromText.trim();
    const t = toText.trim();
    if (!isValidYmd(f) || !isValidYmd(t)) { setRangeError('Use the format YYYY-MM-DD, e.g. 2026-10-01.'); return; }
    if (f > t) { setRangeError('"From" date must be on or before "To" date.'); return; }
    setRangeError(null);
    setPreset('custom');
    setRange({ from: f, to: t });
  };

  const s = data?.summary;
  const hasMore = !!data && data.pagination.page < data.pagination.total_pages;

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery history</Text>
          <View style={styles.iconBtn} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date range */}
        <View style={styles.chipRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity key={p.key} style={[styles.chip, preset === p.key && styles.chipActive]} onPress={() => choosePreset(p)}>
              <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rangeCard}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>From</Text>
            <TextInput
              style={styles.dateInput}
              value={fromText}
              onChangeText={setFromText}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="From date"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>To</Text>
            <TextInput
              style={styles.dateInput}
              value={toText}
              onChangeText={setToText}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="To date"
            />
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={applyCustom} accessibilityLabel="Apply date range">
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
        {rangeError && <Text style={styles.errorText}>{rangeError}</Text>}

        <Text style={styles.rangeLabel}>
          {range.from === range.to ? prettyDay(range.from) : `${prettyDay(range.from)} – ${prettyDay(range.to)}`}
        </Text>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
        ) : error && !data ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={styles.emptyTitle}>Couldn’t load history</Text>
            <Text style={styles.emptySub}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Totals */}
            <View style={styles.statsGrid}>
              <StatBox label="Accepted" value={String(s?.accepted ?? 0)} />
              <StatBox label="Delivered" value={String(s?.delivered ?? 0)} accent />
              <StatBox label="Still active" value={String(s?.active ?? 0)} />
              <StatBox label="Delivered value" value={rupee(s?.delivered_value ?? 0)} />
            </View>
            {!!s && s.cod_collected > 0 && (
              <View style={styles.codNote}>
                <Ionicons name="cash-outline" size={16} color={COLORS.primaryDark} />
                <Text style={styles.codText}>Cash collected on delivery: {rupee(s.cod_collected)}</Text>
              </View>
            )}

            {/* Per-day */}
            {!!data && data.daily.length > 1 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>By day</Text>
                {data.daily.map((d) => (
                  <View key={d.date} style={styles.dayRow}>
                    <Text style={styles.dayDate}>{prettyDay(d.date)}</Text>
                    <Text style={styles.dayCount}>{d.delivered}/{d.accepted} delivered</Text>
                    <Text style={styles.dayValue}>{rupee(d.value)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Orders */}
            <Text style={styles.sectionLabel}>Accepted deliveries ({data?.pagination.total ?? 0})</Text>
            {rows.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>🗓️</Text>
                <Text style={styles.emptyTitle}>No deliveries in this range</Text>
                <Text style={styles.emptySub}>Try a wider date range.</Text>
              </View>
            )}
            {rows.map((o, idx) => (
              <FadeInView key={o.id} delay={(idx % 8) * 55} distance={18}>
                <TouchableOpacity
                key={o.id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('DeliveryOrderDetail', { orderId: o.id })}
              >
                <View style={styles.orderTop}>
                  <Text style={styles.orderId}>Order #{o.id}</Text>
                  {o.status === 'delivered'
                    ? <View style={[styles.pill, { backgroundColor: '#DCFCE7' }]}><Text style={[styles.pillText, { color: COLORS.success }]}>Delivered</Text></View>
                    : <View style={[styles.pill, { backgroundColor: '#EDE9FE' }]}><Text style={[styles.pillText, { color: '#7C3AED' }]}>Out for delivery</Text></View>}
                </View>
                <View style={styles.rowLine}>
                  <Ionicons name="person-outline" size={14} color={COLORS.gray} />
                  <Text style={styles.rowText} numberOfLines={1}>{o.customer_name}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Ionicons name="location-outline" size={14} color={COLORS.gray} />
                  <Text style={styles.rowText} numberOfLines={2}>{addressLine(o.address)}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Ionicons name="time-outline" size={14} color={COLORS.gray} />
                  <Text style={styles.rowText} numberOfLines={2}>
                    Accepted {prettyTime(o.accepted_at)}{o.delivered_at ? ` · Delivered ${prettyTime(o.delivered_at)}` : ''}
                  </Text>
                </View>
                <View style={styles.orderBottom}>
                  <Text style={styles.orderMeta}>{o.item_count} item{o.item_count === 1 ? '' : 's'} · {o.payment_method.toUpperCase()}</Text>
                  <Text style={styles.orderTotal}>{rupee(o.total)}</Text>
                </View>
              </TouchableOpacity>
              </FadeInView>
            ))}

            {hasMore && (
              <TouchableOpacity style={styles.moreBtn} onPress={loadMore} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.moreText}>Load more</Text>}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const StatBox = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <View style={[styles.statBox, accent && styles.statBoxAccent]}>
    <Text style={[styles.statValue, accent && { color: COLORS.white }]}>{value}</Text>
    <Text style={[styles.statLabel, accent && { color: 'rgba(255,255,255,0.9)' }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  scroll: { padding: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.grayBorder },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12.5, fontWeight: '700', color: COLORS.gray },
  chipTextActive: { color: COLORS.white },
  rangeCard: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: COLORS.white, borderRadius: 14, padding: 12 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 11, fontWeight: '800', color: COLORS.gray, textTransform: 'uppercase', marginBottom: 4 },
  dateInput: { borderWidth: 1, borderColor: COLORS.grayBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13.5, color: COLORS.ink },
  applyBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  applyText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  errorText: { color: COLORS.errorDark, fontSize: 12.5, fontWeight: '600', marginTop: 8 },
  rangeLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray, marginTop: 14, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { width: '48%', flexGrow: 1, backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statBoxAccent: { backgroundColor: COLORS.primary },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.black },
  statLabel: { fontSize: 11.5, color: COLORS.gray, marginTop: 2, fontWeight: '600' },
  codNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 10, marginTop: 10 },
  codText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primaryDark },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: COLORS.gray, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginTop: 10,
    shadowColor: '#0F2A22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  dayDate: { flex: 1.2, fontSize: 13, fontWeight: '600', color: COLORS.ink },
  dayCount: { flex: 1, fontSize: 12, color: COLORS.gray },
  dayValue: { fontSize: 13, fontWeight: '800', color: COLORS.black, minWidth: 70, textAlign: 'right' },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  rowLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  rowText: { flex: 1, fontSize: 13, color: COLORS.ink, lineHeight: 18 },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.grayBorder },
  orderMeta: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  orderTotal: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  moreBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  moreText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: 'center' },
});

export default DeliveryHistoryScreen;
