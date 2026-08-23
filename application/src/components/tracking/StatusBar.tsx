import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LivePhase } from '../../services/api';
import { PHASES, phaseIndex, phaseMeta } from '../../utils/tracking';
import { COLORS } from '../../theme/colors';

interface Props {
  phase: LivePhase | null;
  /** Along-route progress 0..1 (drives the fill within the current phase). */
  progress: number;
}

/** Top overlay: current phase headline + animated progress bar + step dots. */
const StatusBar = ({ phase, progress }: Props) => {
  const idx = phaseIndex(phase);
  const meta = phaseMeta(phase);
  const total = PHASES.length - 1;
  // Overall fraction: completed steps + fractional progress of the active leg.
  const fraction = Math.min(1, (idx + Math.max(0, Math.min(1, progress))) / total);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: fraction, duration: 600, useNativeDriver: false }).start();
  }, [fraction, anim]);
  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={[styles.iconWrap, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={18} color={COLORS.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{meta.label}</Text>
          <Text style={styles.sub}>{meta.sub}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: barWidth, backgroundColor: meta.color }]} />
      </View>

      <View style={styles.dots}>
        {PHASES.map((p, i) => (
          <View key={p.key} style={[styles.dot, i <= idx && { backgroundColor: meta.color, borderColor: meta.color }]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 18, padding: 16, shadowColor: '#0F2A22', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  sub: { fontSize: 12, color: COLORS.gray, marginTop: 1 },
  track: { height: 7, borderRadius: 4, backgroundColor: COLORS.grayLight, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  dots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.grayLight, borderWidth: 1.5, borderColor: COLORS.grayBorder },
});

export default StatusBar;
