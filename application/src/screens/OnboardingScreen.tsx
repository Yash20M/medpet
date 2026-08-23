import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, Easing,
  NativeScrollEvent, NativeSyntheticEvent, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { setHasOnboarded } from '../utils/onboarding';
import PressableScale from '../components/PressableScale';

const { width } = Dimensions.get('window');

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'> };

interface Slide {
  emoji: string;
  badge: string;
  gradient: [string, string];
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  { emoji: '💊', badge: '🐕', gradient: GRADIENTS.primary, title: 'Vet-approved medicines', subtitle: 'Genuine medicines, supplements & nutrition delivered to your doorstep.' },
  { emoji: '👨‍⚕️', badge: '🐈', gradient: GRADIENTS.sky, title: 'Talk to a vet, 24/7', subtitle: 'Book online or offline consultations with certified veterinarians anytime.' },
  { emoji: '🚚', badge: '🐾', gradient: GRADIENTS.sunset, title: 'Care that arrives fast', subtitle: 'Smart reminders, quick delivery and everything your pet needs to thrive.' },
];

const FloatingEmoji = ({ emoji, badge }: { emoji: string; badge: string }) => {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  return (
    <Animated.View style={[styles.illus, { transform: [{ translateY }] }]}>
      <Text style={styles.illusEmoji}>{emoji}</Text>
      <View style={styles.illusBadge}><Text style={{ fontSize: 30 }}>{badge}</Text></View>
    </Animated.View>
  );
};

const OnboardingScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<Animated.FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    await setHasOnboarded();
    navigation.replace('Main');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
    } else {
      finish();
    }
  };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) =>
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width)),
  });

  const slide = SLIDES[index];

  return (
    <LinearGradient colors={slide.gradient} style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.skipRow, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={finish} haptic={false}>
          <Text style={styles.skip}>Skip</Text>
        </PressableScale>
      </View>

      <Animated.FlatList
        ref={scrollRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <FloatingEmoji emoji={item.emoji} badge={item.badge} />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const w = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={[styles.dot, { width: w, opacity }]} />;
          })}
        </View>

        <PressableScale onPress={next} style={styles.cta}>
          <View style={styles.ctaInner}>
            <Text style={styles.ctaText}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
            <Ionicons name="arrow-forward" size={20} color={slide.gradient[1]} />
          </View>
        </PressableScale>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  skipRow: { paddingHorizontal: 24, alignItems: 'flex-end' },
  skip: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  illus: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 44, position: 'relative',
  },
  illusEmoji: { fontSize: 96 },
  illusBadge: {
    position: 'absolute', bottom: 6, right: 6, width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', ...SHADOWS.floating,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginBottom: 14 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 23 },
  footer: { paddingHorizontal: 24 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4, backgroundColor: COLORS.white },
  cta: { borderRadius: RADII.lg, backgroundColor: COLORS.white, ...SHADOWS.floating },
  ctaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 17 },
  ctaText: { fontSize: 16, fontWeight: '800', color: COLORS.black },
});

export default OnboardingScreen;
