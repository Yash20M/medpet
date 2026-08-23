import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../PressableScale';
import { usePets } from '../../context/PetsContext';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  onPress: () => void;
}

/** Upcoming vaccination reminder for the primary pet, with a gently swinging
 *  bell. Hidden until the user has added a pet. */
const HealthReminderCard = ({ onPress }: Props) => {
  const { primaryPet } = usePets();
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1, duration: 360, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(2200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [swing]);

  if (!primaryPet) return null;

  const rotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <PressableScale onPress={onPress} scaleTo={0.97}>
      <LinearGradient colors={['#EFF6FF', '#E0F2FE']} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.bellWrap}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Text style={{ fontSize: 26 }}>💉</Text>
          </Animated.View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{primaryPet.name}'s Vaccination</Text>
          <Text style={styles.when}>{tomorrow} · 10:30 AM</Text>
          <Text style={styles.sub}>Annual booster is due — tap to prepare</Text>
        </View>
        <View style={styles.chip}>
          <Ionicons name="notifications" size={13} color={COLORS.secondaryDark} />
          <Text style={styles.chipText}>Remind</Text>
        </View>
      </LinearGradient>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADII.lg, padding: 16, ...SHADOWS.card,
  },
  bellWrap: {
    width: 52, height: 52, borderRadius: RADII.md, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.card,
  },
  title: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  when: { fontSize: 13, fontWeight: '700', color: COLORS.secondaryDark, marginTop: 2 },
  sub: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white, borderRadius: RADII.pill, paddingHorizontal: 10, paddingVertical: 6,
  },
  chipText: { fontSize: 11, fontWeight: '800', color: COLORS.secondaryDark },
});

export default HealthReminderCard;
