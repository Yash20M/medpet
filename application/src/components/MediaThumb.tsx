import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';

interface Props {
  uri?: string | null;
  emoji: string;
  emojiSize?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  rounded?: number;
}

/** Renders a real photo when available, falling back to the emoji if there's no URL or it fails to load. */
const MediaThumb = ({ uri, emoji, emojiSize = 40, style, imageStyle, rounded = 0 }: Props) => {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;

  return (
    <View style={[styles.wrap, rounded ? { borderRadius: rounded, overflow: 'hidden' } : null, style]}>
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={[StyleSheet.absoluteFill, imageStyle]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

export default MediaThumb;
