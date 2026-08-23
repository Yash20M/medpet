import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

interface Props {
  active: TabKey;
  onTab: (key: TabKey) => void;
  cartCount?: number;
}

const TabItem = ({ tab, active, onPress, badge }: { tab: TabDef; active: boolean; onPress: () => void; badge?: number }) => {
  const scale = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1 : 0, useNativeDriver: true, friction: 6, tension: 120 }).start();
  }, [active, scale]);

  const lift = scale.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      onPressIn={() => Animated.spring(press, { toValue: 0.85, useNativeDriver: true, friction: 7 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 7 }).start()}
    >
      <Animated.View style={{ transform: [{ translateY: lift }, { scale: press }], alignItems: 'center' }}>
        <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
          <Ionicons
            name={active ? tab.iconActive : tab.icon}
            size={22}
            color={active ? COLORS.white : COLORS.gray}
          />
          {badge != null && badge > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View>
          )}
        </View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{tab.label}</Text>
      </Animated.View>
    </Pressable>
  );
};

const BottomNav = ({ active, onTab, cartCount }: Props) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
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
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 44, height: 44, borderRadius: RADII.md,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: COLORS.primary, ...SHADOWS.floating },
  label: { fontSize: 10, color: COLORS.gray, fontWeight: '600', marginTop: 2 },
  labelActive: { color: COLORS.primary, fontWeight: '800' },
  badge: {
    position: 'absolute', top: 2, right: 4, minWidth: 16, height: 16, paddingHorizontal: 3,
    borderRadius: 8, backgroundColor: COLORS.coral, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
});

export default BottomNav;
