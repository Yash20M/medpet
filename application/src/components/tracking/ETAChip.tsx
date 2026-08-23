import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

interface Props {
  /** null = no ETA yet (not dispatched / no rider assigned), distinct from a real 0. */
  etaMinutes: number | null;
  delivered?: boolean;
}

/** Floating "X min" badge (top-right of the map). */
const ETAChip = ({ etaMinutes, delivered }: Props) => (
  <View style={styles.chip}>
    <Ionicons name={delivered ? 'checkmark-done' : 'time'} size={14} color={COLORS.white} />
    <Text style={styles.text} numberOfLines={1}>
      {delivered ? 'Delivered'
        : etaMinutes == null ? 'Preparing'
        : etaMinutes <= 0 ? 'Arriving now'
        : `${etaMinutes} min`}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(15,23,42,0.9)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  text: { color: COLORS.white, fontSize: 12.5, fontWeight: '800' },
});

export default ETAChip;
