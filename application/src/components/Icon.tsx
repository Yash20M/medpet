import React from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { Ionicons as VectorIonicons } from '@expo/vector-icons';
import { widthScale, MAX_FONT_SCALE } from '../theme/responsive';

/**
 * Drop-in replacement for Ionicons that keeps icons visually consistent:
 *  1. snaps ad-hoc sizes (13, 15, 17, 19, 23, 26…) onto one design scale, so the
 *     same role looks the same on every screen;
 *  2. scales with the screen width a little, and follows the user's system font
 *     size (capped like text is), so icons don't look tiny next to large text
 *     or oversized next to small text.
 */
const SIZE_SCALE = [10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40, 52] as const;

const snap = (size: number): number => {
  if (size > SIZE_SCALE[SIZE_SCALE.length - 1]) return size;
  let best: number = SIZE_SCALE[0];
  for (const s of SIZE_SCALE) {
    if (Math.abs(s - size) <= Math.abs(best - size)) best = s; // ties round up
  }
  return best;
};

type IconProps = React.ComponentProps<typeof VectorIonicons>;

const Icon = ({ size = 24, ...rest }: IconProps) => {
  const { width } = useWindowDimensions();
  const fontFactor = 1 + (Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE) - 1) * 0.6;
  const px = Math.round(snap(size) * widthScale(width) * fontFactor);
  return <VectorIonicons size={px} {...rest} />;
};

// Keep Ionicons' static `glyphMap` so `keyof typeof Ionicons.glyphMap` typing keeps working.
export default Object.assign(Icon, { glyphMap: VectorIonicons.glyphMap });
