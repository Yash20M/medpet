import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../PressableScale';
import { NearbyStore } from '../../data/premium';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  stores: NearbyStore[];
}

/** Nearby store list beneath a stylised mini-map preview (roads drawn with
 *  plain Views — no map SDK needed for a decorative preview). */
const NearbyStores = ({ stores }: Props) => (
  <View style={styles.card}>
    {/* Mini map */}
    <View style={styles.map}>
      <LinearGradient colors={['#ECFDF5', '#E0F2FE']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      {/* Roads */}
      <View style={[styles.road, { top: '34%', left: 0, right: 0, height: 7 }]} />
      <View style={[styles.road, { top: '70%', left: 0, right: 0, height: 5 }]} />
      <View style={[styles.road, { left: '28%', top: 0, bottom: 0, width: 6 }]} />
      <View style={[styles.road, { left: '72%', top: 0, bottom: 0, width: 5 }]} />
      {/* Park + water blocks */}
      <View style={[styles.park, { left: '6%', top: '10%', width: 46, height: 30 }]} />
      <View style={[styles.water, { right: '4%', bottom: '8%', width: 60, height: 34 }]} />
      {/* Store pins */}
      <View style={[styles.pin, { left: '24%', top: '26%' }]}>
        <Ionicons name="storefront" size={12} color={COLORS.white} />
      </View>
      <View style={[styles.pin, { left: '66%', top: '58%', backgroundColor: COLORS.secondaryDark }]}>
        <Ionicons name="storefront" size={12} color={COLORS.white} />
      </View>
      {/* You marker */}
      <View style={styles.youWrap}>
        <View style={styles.youDot} />
        <Text style={styles.youText}>You</Text>
      </View>
    </View>

    {stores.map((s, i) => (
      <View key={s.id} style={[styles.storeRow, i < stores.length - 1 && styles.storeBorder]}>
        <View style={[styles.storeIcon, !s.open && { backgroundColor: COLORS.grayLight }]}>
          <Ionicons name="storefront" size={17} color={s.open ? COLORS.primary : COLORS.gray} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName}>{s.name}</Text>
          <Text style={styles.storeMeta}>{s.area} · {s.distanceKm} km · ~{s.etaMins} min</Text>
        </View>
        <View style={[styles.openPill, { backgroundColor: s.open ? '#DCFCE7' : COLORS.grayLight }]}>
          <Text style={[styles.openText, { color: s.open ? COLORS.success : COLORS.gray }]}>
            {s.open ? 'Open' : 'Closed'}
          </Text>
        </View>
        <PressableScale
          style={styles.navBtn}
          scaleTo={0.9}
          onPress={() => Alert.alert('Navigate', `Opening directions to ${s.name}…`)}
        >
          <Ionicons name="navigate" size={15} color={COLORS.white} />
        </PressableScale>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 14, ...SHADOWS.card },
  map: { height: 120, borderRadius: RADII.md, overflow: 'hidden', marginBottom: 6 },
  road: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 3 },
  park: { position: 'absolute', backgroundColor: '#BBF7D0', borderRadius: 8, opacity: 0.8 },
  water: { position: 'absolute', backgroundColor: '#BAE6FD', borderRadius: 10, opacity: 0.9 },
  pin: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white, ...SHADOWS.card,
  },
  youWrap: { position: 'absolute', left: '46%', top: '44%', alignItems: 'center' },
  youDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.secondaryDark,
    borderWidth: 3, borderColor: COLORS.white, ...SHADOWS.card,
  },
  youText: { fontSize: 9, fontWeight: '800', color: COLORS.secondaryDark, marginTop: 2 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  storeBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  storeIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  storeName: { fontSize: 13, fontWeight: '800', color: COLORS.black },
  storeMeta: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  openPill: { borderRadius: RADII.pill, paddingHorizontal: 8, paddingVertical: 3 },
  openText: { fontSize: 10, fontWeight: '800' },
  navBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default NearbyStores;
