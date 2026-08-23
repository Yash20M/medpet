import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../PressableScale';
import { LivePhase } from '../../services/api';
import { phaseMeta } from '../../utils/tracking';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  orderId: number;
  phase: LivePhase | null;
  etaMins: number | null;
  onPress: () => void;
}

const STEPS = ['Preparing', 'Packed', 'Out for delivery'] as const;

/** Maps the 5-stage live phase onto this card's simplified 3-step strip. */
const stepForPhase = (phase: LivePhase | null): number => {
  switch (phase) {
    case 'picked': return 1;
    case 'on_the_way':
    case 'nearby':
    case 'delivered': return 2;
    default: return 0;
  }
};

/** Tappable "Order #X is <status>" card with a live pulse and an animated
 *  delivery bike gliding across the step strip. Tapping opens live tracking. */
const DeliveryCard = ({ orderId, phase, etaMins, onPress }: Props) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const ride = useRef(new Animated.Value(0)).current;
  const activeStep = stepForPhase(phase);
  const meta = phaseMeta(phase);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    const rideLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ride, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(ride, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    pulseLoop.start();
    rideLoop.start();
    return () => { pulseLoop.stop(); rideLoop.stop(); };
  }, [pulse, ride]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const bikeX = ride.interpolate({ inputRange: [0, 1], outputRange: [0, 96] });
  const bikeBob = ride.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2, 0, -2, 0] });

  return (
    <PressableScale style={styles.card} scaleTo={0.97} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.locWrap}>
          <Animated.View style={[styles.locRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <View style={styles.locDot}>
            <Ionicons name="location" size={15} color={COLORS.white} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.deliverTo} numberOfLines={1}>Order #{orderId}</Text>
          <Text style={styles.name} numberOfLines={1}>{meta.label}</Text>
        </View>
        {etaMins != null && (
          <View style={styles.etaPill}>
            <Ionicons name="flash" size={12} color={COLORS.white} />
            <Text style={styles.etaText} numberOfLines={1}>{etaMins} min</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
      </View>

      <View style={styles.track}>
        <LinearGradient
          colors={[COLORS.primaryLight, COLORS.secondaryLight]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.trackLine} />
        <Animated.View style={[styles.bike, { transform: [{ translateX: bikeX }, { translateY: bikeBob }] }]}>
          <Text style={{ fontSize: 18 }}>🛵</Text>
        </Animated.View>
        <View style={styles.trackSteps}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={[styles.stepDot, i <= activeStep && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, i <= activeStep && styles.stepLabelActive]} numberOfLines={1}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Ionicons name="navigate" size={14} color={COLORS.primary} />
        <Text style={styles.availText} numberOfLines={1}>Tap to track live</Text>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 14, ...SHADOWS.card },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  locRing: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary },
  locDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  deliverTo: { fontSize: 10, color: COLORS.gray, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { fontSize: 14, fontWeight: '800', color: COLORS.black, marginTop: 1 },
  etaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1,
    backgroundColor: COLORS.primary, borderRadius: RADII.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  etaText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  track: { height: 58, borderRadius: RADII.md, marginTop: 12, overflow: 'hidden', justifyContent: 'flex-start' },
  trackLine: { position: 'absolute', left: 12, right: 12, top: 24, height: 2, backgroundColor: 'rgba(16,185,129,0.35)', borderRadius: 1 },
  bike: { position: 'absolute', left: 12, top: 5 },
  trackSteps: { position: 'absolute', left: 12, right: 12, bottom: 6, flexDirection: 'row', justifyContent: 'space-between' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '34%' },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.grayBorder, flexShrink: 0 },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepLabel: { fontSize: 9, color: COLORS.gray, fontWeight: '600', flexShrink: 1 },
  stepLabelActive: { color: COLORS.primaryDark, fontWeight: '800' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  availText: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
});

export default DeliveryCard;
