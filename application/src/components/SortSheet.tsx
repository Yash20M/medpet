import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Text } from './AppText';
import Ionicons from './Icon';
import { SORT_OPTIONS, SortKey } from '../utils/productFilters';
import { COLORS, RADII } from '../theme/colors';

interface Props {
  visible: boolean;
  value: SortKey;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
}

/** "Sort By" bottom sheet — radio list; tapping an option applies it and closes. */
const SortSheet = ({ visible, value, onSelect, onClose }: Props) => {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  // Stay mounted while the closing animation plays.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sort options" />
        </Animated.View>

        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY }] }]}>
          <View style={styles.head}>
            <Text style={styles.title}>Sort By</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />

          {SORT_OPTIONS.map((o) => {
            const on = o.key === value;
            return (
              <TouchableOpacity
                key={o.key}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => {
                  if (o.key !== value) Haptics.selectionAsync().catch(() => {});
                  onSelect(o.key);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(15,42,34,0.5)' },
  sheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: RADII.lg, borderTopRightRadius: RADII.lg,
    paddingHorizontal: 20, paddingTop: 18,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.black },
  divider: { height: 1, backgroundColor: COLORS.grayBorder, marginHorizontal: -20, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.grayBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: COLORS.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.primary },
  label: { fontSize: 15, fontWeight: '500', color: COLORS.ink },
  labelOn: { fontWeight: '800', color: COLORS.black },
});

export default SortSheet;
