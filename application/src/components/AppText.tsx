import React from 'react';
import { Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps } from 'react-native';
import { MAX_FONT_SCALE } from '../theme/responsive';

/**
 * Text / TextInput that respect the system font size but stop growing at
 * MAX_FONT_SCALE, so large accessibility settings can't break headers, tab bars
 * and cards. Same API as the react-native versions.
 */
export const Text = (props: TextProps) => <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => (
  <RNTextInput ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />
));
TextInput.displayName = 'TextInput';
