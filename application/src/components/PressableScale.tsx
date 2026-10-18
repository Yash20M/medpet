import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, ViewStyle, StyleProp, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  disabled?: boolean;
  scaleTo?: number;
  accessibilityLabel?: string;
  /** Make the visual layer fill the touch area (use when the parent stretches this in a row). */
  fill?: boolean;
}

// Layout props belong on the outer touchable: `width: '100%'`, `flex: 1`, margins and
// absolute positioning only make sense relative to the PARENT, not to the inner view.
const LAYOUT_KEYS = [
  'width', 'minWidth', 'maxWidth', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'position', 'top', 'left', 'right', 'bottom', 'zIndex',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
] as const;

const splitStyle = (style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } => {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const k of Object.keys(flat)) {
    if ((LAYOUT_KEYS as readonly string[]).includes(k)) outer[k] = flat[k];
    else inner[k] = flat[k];
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
};

/** A pressable that springs down on touch and fires a light haptic — the
 *  base building block for "alive" buttons and cards across the app. */
export default function PressableScale({
  children, onPress, style, haptic = true, disabled = false, scaleTo = 0.95, accessibilityLabel, fill = false,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const { outer, inner } = splitStyle(style);

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7, tension: 140 }).start();

  return (
    <Pressable
      style={outer}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
    >
      <Animated.View style={[fill && { flexGrow: 1 }, inner, { transform: [{ scale }], opacity: disabled ? 0.6 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
