import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import PressableScale from './PressableScale';

interface Props {
  visible: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}

export default function AddPetModal({ visible, onAdd, onDismiss }: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 120 }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Animated.View style={[styles.bubble, { transform: [{ translateY }] }]}>
            <Text style={styles.emoji}>🐶</Text>
          </Animated.View>

          <Text style={styles.title}>Tell us about your pet</Text>
          <Text style={styles.subtitle}>
            Add your furry friend to unlock tailored medicine and care recommendations made just for them.
          </Text>

          <PressableScale onPress={onAdd} style={{ width: '100%', marginTop: 22 }}>
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Add my pet 🐾</Text>
            </LinearGradient>
          </PressableScale>

          <PressableScale onPress={onDismiss} haptic={false} style={styles.laterBtn}>
            <Text style={styles.laterText}>Maybe later</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,42,34,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', backgroundColor: COLORS.white, borderRadius: RADII.xl, padding: 26, alignItems: 'center', ...SHADOWS.floating },
  bubble: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18, ...SHADOWS.soft,
  },
  emoji: { fontSize: 54 },
  title: { fontSize: 21, fontWeight: '800', color: COLORS.black, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  primaryBtn: { paddingVertical: 15, borderRadius: RADII.lg, alignItems: 'center' },
  primaryText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  laterBtn: { paddingVertical: 12, marginTop: 4 },
  laterText: { color: COLORS.gray, fontSize: 14, fontWeight: '700' },
});
