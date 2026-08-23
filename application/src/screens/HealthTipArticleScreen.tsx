import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { HEALTH_TIPS } from '../data/premium';
import { COLORS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'HealthTipArticle'>;
  route: RouteProp<RootStackParamList, 'HealthTipArticle'>;
};

const HealthTipArticleScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  // Prefer the admin-managed tip passed through navigation; fall back to the
  // bundled fixture (deep links / offline).
  const tip = route.params.tip
    ?? HEALTH_TIPS.find((t) => t.id === route.params.tipId)
    ?? HEALTH_TIPS[0];

  const shareArticle = () =>
    Share.share({ message: `${tip.title} — great pet care tips on MedPet 🐾` }).catch(() => {});

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Hero */}
      <LinearGradient colors={tip.tint} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroDecor} />
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={shareArticle}>
            <Ionicons name="share-social-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name={tip.icon} size={34} color={COLORS.white} />
        </View>
        <Text style={styles.heroTitle}>{tip.title}</Text>
        <View style={styles.heroMeta}>
          <Ionicons name="book-outline" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.heroMetaText}>{tip.readMins} min read · By the MedPet vet team</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.teaser}>{tip.teaser}</Text>

        {tip.sections.map((s, i) => (
          <View key={s.heading} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionNum}><Text style={styles.sectionNumText}>{i + 1}</Text></View>
              <Text style={styles.sectionTitle}>{s.heading}</Text>
            </View>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        {/* CTA */}
        <View style={styles.ctaCard}>
          <Text style={{ fontSize: 30 }}>🐾</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Questions about your pet?</Text>
            <Text style={styles.ctaSub}>Our vets are online and happy to help.</Text>
          </View>
          <TouchableOpacity
            style={styles.ctaBtn}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('SupportTickets')}
          >
            <Text style={styles.ctaBtnText}>Ask a vet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  hero: {
    paddingHorizontal: 20, paddingBottom: 26, overflow: 'hidden',
    borderBottomLeftRadius: RADII.xl, borderBottomRightRadius: RADII.xl,
  },
  heroDecor: {
    position: 'absolute', top: -70, right: -70, width: 220, height: 220,
    borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white, lineHeight: 32 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  heroMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  scrollContent: { padding: 20 },
  teaser: { fontSize: 16, color: COLORS.gray, lineHeight: 24, fontStyle: 'italic', marginBottom: 22 },
  section: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 16, marginBottom: 14, ...SHADOWS.card },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionNumText: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.black },
  sectionBody: { fontSize: 14, color: COLORS.gray, lineHeight: 22 },
  ctaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.primaryLight, borderRadius: RADII.lg, padding: 16, marginTop: 8,
  },
  ctaTitle: { fontSize: 14, fontWeight: '800', color: COLORS.black },
  ctaSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  ctaBtn: { backgroundColor: COLORS.primary, borderRadius: RADII.pill, paddingHorizontal: 14, paddingVertical: 9 },
  ctaBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.white },
});

export default HealthTipArticleScreen;
