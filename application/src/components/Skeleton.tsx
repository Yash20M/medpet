import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADII } from '../theme/colors';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A shimmering placeholder block — a gradient highlight sweeps across a soft
 *  base while the whole block gently pulses. */
export const Skeleton = ({ width = '100%', height = 16, radius = RADII.sm, style }: SkeletonProps) => {
  const pulse = useRef(new Animated.Value(0.6)).current;
  const sweep = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 750, useNativeDriver: true }),
      ])
    );
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1400, useNativeDriver: true })
    );
    pulseLoop.start();
    sweepLoop.start();
    return () => { pulseLoop.stop(); sweepLoop.stop(); };
  }, [pulse, sweep]);

  const translateX = sweep.interpolate({ inputRange: [-1, 1], outputRange: [-160, 320] });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: COLORS.grayLight, opacity: pulse, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.65)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ width: 160, height: '100%' }}
        />
      </Animated.View>
    </Animated.View>
  );
};

/** Grid of product-card skeletons matching the Home / ProductList layout. */
export const ProductGridSkeleton = ({ count = 4 }: { count?: number }) => (
  <View style={styles.grid}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.card}>
        <Skeleton height={110} radius={RADII.md} />
        <Skeleton width="50%" height={10} style={{ marginTop: 10 }} />
        <Skeleton width="90%" height={14} style={{ marginTop: 8 }} />
        <Skeleton width="40%" height={16} style={{ marginTop: 10 }} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: '45%', backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 12 },
});

export default Skeleton;
