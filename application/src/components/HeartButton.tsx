import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from './Icon';
import { COLORS } from '../theme/colors';

interface Props {
  active: boolean;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Wishlist heart: springs when pressed and bursts when it flips to "saved". */
const HeartButton = ({ active, onPress, size = 16, style }: Props) => {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!active) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.45, duration: 120, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 180 }),
    ]).start();
  }, [active, scale]);

  return (
    <Pressable
      style={[styles.btn, style]}
      hitSlop={8}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={active ? 'heart' : 'heart-outline'} size={size} color={active ? COLORS.coral : COLORS.gray} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
});

export default HeartButton;
