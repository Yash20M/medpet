import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../PressableScale';
import { QUICK_ACTIONS, QuickAction } from '../../data/premium';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

const { width } = Dimensions.get('window');
const CARD_W = (width - 40 - 3 * 10) / 4;

interface Props {
  onAction: (action: QuickAction) => void;
}

/** 4×2 grid of gradient quick-action tiles (Order Medicines, Vet Consult…). */
const QuickActions = ({ onAction }: Props) => (
  <View style={styles.grid}>
    {QUICK_ACTIONS.map((a) => (
      <PressableScale key={a.id} style={styles.card} onPress={() => onAction(a)} scaleTo={0.92}>
        <LinearGradient colors={a.colors} style={styles.iconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name={a.icon} size={22} color={COLORS.white} />
        </LinearGradient>
        <Text style={styles.label} numberOfLines={2}>{a.label}</Text>
      </PressableScale>
    ))}
  </View>
);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: CARD_W, backgroundColor: COLORS.white, borderRadius: RADII.md,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', ...SHADOWS.card,
  },
  iconBg: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.black, textAlign: 'center', lineHeight: 13 },
});

export default QuickActions;
