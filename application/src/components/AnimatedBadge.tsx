import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './AppText';
import { COLORS } from '../theme/colors';

interface Props {
  count: number;
  style?: StyleProp<ViewStyle>;
  /** `coral` = tab bar; `accent` = on the green header (yellow-orange with dark text). */
  tone?: 'coral' | 'accent';
}

/** Count badge that pops in on first show and bounces whenever the number changes. */
const AnimatedBadge = ({ count, style, tone = 'coral' }: Props) => {
  const scale = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
      return;
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 200 }),
    ]).start();
  }, [count, scale]);

  const isAccent = tone === 'accent';
  return (
    <Animated.View
      style={[
        styles.badge,
        isAccent ? styles.accent : styles.coral,
        style,
        { transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.text, isAccent && { color: COLORS.black }]}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  coral: { backgroundColor: COLORS.coral, borderColor: COLORS.white },
  accent: { backgroundColor: COLORS.accent, borderColor: COLORS.primaryDark },
  text: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
});

export default AnimatedBadge;
