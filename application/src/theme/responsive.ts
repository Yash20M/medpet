import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

/** Design baseline: a 390dp-wide phone (iPhone 14 / Pixel 7). */
const BASE_WIDTH = 390;
/** Text may grow with the user's system font size, but only this far — beyond
 *  it layouts (headers, tab bars, chips) start to break. */
export const MAX_FONT_SCALE = 1.2;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Width-based scale, kept close to 1 so small phones shrink a little and tablets don't balloon. */
export const widthScale = (width: number): number => clamp(width / BASE_WIDTH, 0.9, 1.15);

/** How much text actually grows (system font size, capped at MAX_FONT_SCALE). */
export const textScale = (): number => Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);

/** Moderate scale for fixed-size things (tiles, avatars, badges). Safe at module load — the app is portrait-only. */
export const ms = (size: number): number =>
  Math.round(size * widthScale(Dimensions.get('window').width));

/** Reactive version for components that must follow window changes (split screen, foldables). */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const scale = widthScale(width);
  return {
    width,
    height,
    scale,
    ms: (size: number) => Math.round(size * scale),
    /** Horizontal page gutter used by sections. */
    gutter: ms(20),
    isCompact: width < 360,
  };
};
