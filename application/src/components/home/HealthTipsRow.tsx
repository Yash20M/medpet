import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../PressableScale';
import { HealthTip } from '../../data/premium';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  tips: HealthTip[];
  onTip: (tip: HealthTip) => void;
}

/** Pet health tip cards that open the full article screen. */
const HealthTipsRow = ({ tips, onTip }: Props) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 4 }}>
    {tips.map((tip) => (
      <PressableScale key={tip.id} style={styles.card} onPress={() => onTip(tip)} scaleTo={0.95}>
        <LinearGradient colors={tip.tint} style={styles.iconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name={tip.icon} size={22} color={COLORS.white} />
        </LinearGradient>
        <Text style={styles.title} numberOfLines={2}>{tip.title}</Text>
        <Text style={styles.teaser} numberOfLines={2}>{tip.teaser}</Text>
        <View style={styles.readRow}>
          <Ionicons name="book-outline" size={12} color={COLORS.primary} />
          <Text style={styles.readText}>{tip.readMins} min read</Text>
        </View>
      </PressableScale>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  card: { width: 168, backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 14, ...SHADOWS.card },
  iconBg: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '800', color: COLORS.black, lineHeight: 17, minHeight: 34 },
  teaser: { fontSize: 11, color: COLORS.gray, lineHeight: 15, marginTop: 4, minHeight: 30 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  readText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
});

export default HealthTipsRow;
