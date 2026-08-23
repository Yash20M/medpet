import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Testimonial } from '../../data/premium';
import { COLORS, RADII, SHADOWS } from '../../theme/colors';

const { width } = Dimensions.get('window');
const CARD_W = width - 80;

interface Props {
  testimonials: Testimonial[];
}

/** Verified-purchase testimonial cards. */
const ReviewsCarousel = ({ testimonials }: Props) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    snapToInterval={CARD_W + 12}
    decelerationRate="fast"
    contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 4 }}
  >
    {testimonials.map((t) => (
      <View key={t.id} style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 24 }}>{t.petEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.owner}>{t.owner}</Text>
            <Text style={styles.pet}>with {t.petName}</Text>
          </View>
          <View style={styles.verified}>
            <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>
        <View style={styles.stars}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons key={i} name={i < t.rating ? 'star' : 'star-outline'} size={13} color="#F59E0B" />
          ))}
        </View>
        <Text style={styles.text}>"{t.text}"</Text>
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  card: { width: CARD_W, backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 16, ...SHADOWS.card },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  owner: { fontSize: 13, fontWeight: '800', color: COLORS.black },
  pet: { fontSize: 11, color: COLORS.gray },
  verified: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#DCFCE7', borderRadius: RADII.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  verifiedText: { fontSize: 10, fontWeight: '700', color: COLORS.success },
  stars: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  text: { fontSize: 13, color: COLORS.gray, lineHeight: 19, fontStyle: 'italic' },
});

export default ReviewsCarousel;
