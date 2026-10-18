import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from './AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Ionicons from './Icon';
import AnimatedBadge from './AnimatedBadge';
import { COLORS, RADII, SHADOWS } from '../theme/colors';

export type TabKey = 'Home' | 'Categories' | 'Cart' | 'Orders' | 'Profile';

interface TabDef {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabDef[] = [
  { key: 'Home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'Categories', label: 'Categories', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'Cart', label: 'Cart', icon: 'cart-outline', iconActive: 'cart' },
  { key: 'Orders', label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' },
  { key: 'Profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

const PILL = 46;

interface Props {
  active: TabKey;
  onTab: (key: TabKey) => void;
  cartCount?: number;
}

const TabItem = ({ tab, active, onPress, badge }: { tab: TabDef; active: boolean; onPress: () => void; badge?: number }) => {
  const pop = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  // Icon "pops" up a little when its tab becomes active.
  useEffect(() => {
    Animated.spring(pop, { toValue: active ? 1 : 0, useNativeDriver: true, friction: 5, tension: 140 }).start();
  }, [active, pop]);

  const iconScale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const iconLift = pop.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <Pressable
      style={styles.item}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={() => Animated.spring(press, { toValue: 0.88, useNativeDriver: true, friction: 7 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 7 }).start()}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={{ transform: [{ scale: press }], alignItems: 'center' }}>
        <View style={styles.iconWrap}>
          <Animated.View style={{ transform: [{ translateY: iconLift }, { scale: iconScale }] }}>
            <Ionicons
              name={active ? tab.iconActive : tab.icon}
              size={22}
              color={active ? COLORS.white : COLORS.gray}
            />
          </Animated.View>
          {badge != null && badge > 0 && <AnimatedBadge count={badge} style={styles.badge} tone="coral" />}
        </View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const BottomNav = ({ active, onTab, cartCount }: Props) => {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const index = Math.max(0, TABS.findIndex((t) => t.key === active));
  const slide = useRef(new Animated.Value(index)).current;

  // One green pill glides between tabs instead of each tab toggling its own background.
  useEffect(() => {
    Animated.spring(slide, { toValue: index, useNativeDriver: true, friction: 8, tension: 90 }).start();
  }, [index, slide]);

  const tabWidth = barWidth / TABS.length;
  const translateX = slide.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => i * tabWidth + (tabWidth - PILL) / 2),
  });

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {barWidth > 0 && (
        <Animated.View style={[styles.pill, { transform: [{ translateX }] }]} pointerEvents="none" />
      )}
      {TABS.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          active={active === tab.key}
          onPress={() => onTab(tab.key)}
          badge={tab.key === 'Cart' ? cartCount : undefined}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    paddingTop: 10, borderTopLeftRadius: RADII.xl, borderTopRightRadius: RADII.xl,
    ...SHADOWS.floating, shadowOpacity: 0.12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 60 },
  pill: {
    position: 'absolute', top: 10, left: 0, width: PILL, height: PILL, borderRadius: RADII.md,
    backgroundColor: COLORS.primary, ...SHADOWS.floating,
  },
  iconWrap: { width: PILL, height: PILL, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, color: COLORS.gray, fontWeight: '600', marginTop: 2, maxWidth: '100%' },
  labelActive: { color: COLORS.primary, fontWeight: '800' },
  badge: { position: 'absolute', top: 2, right: 4 },
});

export default BottomNav;
