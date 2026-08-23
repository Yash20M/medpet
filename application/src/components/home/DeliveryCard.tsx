import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { loadDeliveryAddress } from '../../utils/deliveryAddress';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  etaMins?: number;
}

/** "Deliver to <name> · <area>" card with a live pulse, an animated delivery
 *  bike gliding across the ETA strip, and availability confirmation. */
const DeliveryCard = ({ etaMins = 18 }: Props) => {
  const { user } = useAuth();
  const [area, setArea] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const ride = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDeliveryAddress().then((saved) => {
      if (!saved?.address) return;
      // Last two comma-separated parts read like "Bengaluru, 560038".
      const parts = saved.address.split(',').map((p) => p.trim()).filter(Boolean);
      setArea(parts.slice(-2).join(' • ') || saved.address.slice(0, 32));
    });
  }, []);

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
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.locWrap}>
          <Animated.View style={[styles.locRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <View style={styles.locDot}>
            <Ionicons name="location" size={15} color={COLORS.white} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.deliverTo}>Deliver to</Text>
          <Text style={styles.name} numberOfLines={1}>
            {user?.name ?? 'Pet Parent'}{area ? `  ·  ${area}` : ''}
          </Text>
        </View>
        <View style={styles.etaPill}>
          <Ionicons name="flash" size={12} color={COLORS.white} />
          <Text style={styles.etaText}>{etaMins} min</Text>
        </View>
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
          {['Preparing', 'Packed', 'Out for delivery'].map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={[styles.stepDot, i === 0 && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, i === 0 && styles.stepLabelActive]}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
        <Text style={styles.availText}>Medicines available nearby</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 14, ...SHADOWS.card },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  locRing: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary },
  locDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  deliverTo: { fontSize: 10, color: COLORS.gray, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { fontSize: 14, fontWeight: '800', color: COLORS.black, marginTop: 1 },
  etaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primary, borderRadius: RADII.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  etaText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  track: { height: 58, borderRadius: RADII.md, marginTop: 12, overflow: 'hidden', justifyContent: 'flex-start' },
  trackLine: { position: 'absolute', left: 12, right: 12, top: 24, height: 2, backgroundColor: 'rgba(16,185,129,0.35)', borderRadius: 1 },
  bike: { position: 'absolute', left: 12, top: 5 },
  trackSteps: { position: 'absolute', left: 12, right: 12, bottom: 6, flexDirection: 'row', justifyContent: 'space-between' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.grayBorder },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepLabel: { fontSize: 9, color: COLORS.gray, fontWeight: '600' },
  stepLabelActive: { color: COLORS.primaryDark, fontWeight: '800' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  availText: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
});

export default DeliveryCard;
