import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';

const { width } = Dimensions.get('window');
const BANNER_W = width - 40;

export interface BannerData {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  badge: string;
  colors: [string, string];
  accent: string;
}

const DEFAULT_BANNERS: BannerData[] = [
  { id: '1', title: 'Flat 30% Off',       subtitle: 'On all pet medicines\nThis weekend only!',     emoji: '💊', badge: 'SALE', colors: ['#E63946', '#A4121A'], accent: '#FF8FA3' },
  { id: '2', title: 'Premium Dog Food',   subtitle: 'Nutrition crafted by\nvet specialists',         emoji: '🐕', badge: 'NEW',  colors: ['#FF6B35', '#C1440E'], accent: '#FFB347' },
  { id: '3', title: 'Cat Wellness',       subtitle: 'Vitamins & supplements\nfor your feline friend',emoji: '🐱', badge: 'HOT',  colors: ['#6366F1', '#4338CA'], accent: '#A78BFA' },
  { id: '4', title: 'Free Consultation',  subtitle: 'Talk to a vet online\n24/7 support available',  emoji: '👨‍⚕️', badge: 'FREE', colors: ['#F59E0B', '#B45309'], accent: '#FDE68A' },
];

const BannerCarousel = ({ banners }: { banners?: BannerData[] }) => {
  const data: BannerData[] = banners && banners.length > 0 ? banners : DEFAULT_BANNERS;
  const flatListRef = useRef<FlatList<BannerData>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      const next = (activeIndex + 1) % data.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }, 3500);
    return () => clearInterval(id);
  }, [activeIndex, data.length]);

  return (
    <View>
      <Animated.FlatList
        ref={flatListRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.id}
        snapToInterval={BANNER_W + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingRight: 12 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + 12)));
        }}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.92}>
            <LinearGradient colors={item.colors} style={styles.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={[styles.bgCircle, { top: -30, right: -30 }]} />
              <View style={[styles.bgCircle, { bottom: -20, left: 60, width: 80, height: 80, borderRadius: 40 }]} />
              <View style={styles.content}>
                <View>
                  <View style={[styles.badge, { backgroundColor: item.accent }]}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                  <Text style={styles.bannerTitle}>{item.title}</Text>
                  <Text style={styles.bannerSub}>{item.subtitle}</Text>
                  <TouchableOpacity style={styles.shopBtn}>
                    <Text style={styles.shopBtnText}>Shop Now →</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}
      />

      <View style={styles.dots}>
        {data.map((_, i) => {
          const dotWidth = scrollX.interpolate({
            inputRange: [(i - 1) * BANNER_W, i * BANNER_W, (i + 1) * BANNER_W],
            outputRange: [6, 20, 6],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * BANNER_W, i * BANNER_W, (i + 1) * BANNER_W],
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp',
          });
          return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity }]} />;
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: BANNER_W, height: 170, borderRadius: 20,
    overflow: 'hidden', marginRight: 12,
  },
  content: {
    flex: 1, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', padding: 20,
  },
  bgCircle: {
    position: 'absolute', width: 120, height: 120,
    borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 20, marginBottom: 8,
  },
  badgeText:   { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bannerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18, marginBottom: 12 },
  shopBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)',
  },
  shopBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emoji:  { fontSize: 60 },
  dots:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 4 },
  dot:    { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
});

export default BannerCarousel;
