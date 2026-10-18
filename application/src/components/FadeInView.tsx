import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle, AccessibilityInfo } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Stagger offset in ms (use `index * 60`, capped by the caller or `maxDelay`). */
  delay?: number;
  /** Start this many px below the final position. */
  distance?: number;
  duration?: number;
  /** Upper bound for `delay` so long lists don't make the tail wait. */
  maxDelay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades + slides its children up on mount. Native-driven; skipped when the
 *  user has "reduce motion" turned on. */
const FadeInView = ({ children, delay = 0, distance = 18, duration = 420, maxDelay = 480, style }: Props) => {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let anim: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) { v.setValue(1); return; }
        anim = Animated.timing(v, {
          toValue: 1, duration, delay: Math.min(delay, maxDelay),
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        });
        anim.start();
      });
    return () => { cancelled = true; anim?.stop(); };
  }, [v, delay, duration, maxDelay]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
};

export default FadeInView;
