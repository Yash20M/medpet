import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import PressableScale from './PressableScale';

interface Props {
  emoji: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/** A friendly, gently-floating illustrated empty state. */
export default function EmptyState({ emoji, title, subtitle, ctaLabel, onCta }: Props) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.bubble, { transform: [{ translateY }] }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {ctaLabel && onCta && (
        <PressableScale onPress={onCta} style={{ marginTop: 22 }}>
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </LinearGradient>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  bubble: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 22, ...SHADOWS.soft,
  },
  emoji: { fontSize: 60 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.black, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  cta: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: RADII.lg, ...SHADOWS.floating },
  ctaText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
