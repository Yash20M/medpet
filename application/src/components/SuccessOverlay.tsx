import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import PressableScale from './PressableScale';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  ctaLabel?: string;
  onDone: () => void;
}

const CONFETTI_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.coral, COLORS.yellow, COLORS.mint];
const PIECES = Array.from({ length: 16 }).map((_, i) => ({
  key: i,
  x: Math.random() * width,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: Math.random() * 250,
  size: 6 + Math.random() * 8,
  spin: Math.random() > 0.5 ? 1 : -1,
}));

const ConfettiPiece = ({ piece, run }: { piece: typeof PIECES[number]; run: boolean }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) { t.setValue(0); return; }
    Animated.timing(t, {
      toValue: 1, duration: 1700, delay: piece.delay, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [run, t, piece.delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-40, 520] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin * 540}deg`] });
  const opacity = t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute', top: 0, left: piece.x,
        width: piece.size, height: piece.size * 1.4, borderRadius: 2,
        backgroundColor: piece.color, transform: [{ translateY }, { rotate }], opacity,
      }}
    />
  );
};

export default function SuccessOverlay({ visible, title, message, ctaLabel = 'Great!', onDone }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0);
      cardOpacity.setValue(0);
    }
  }, [visible, scale, cardOpacity]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        {PIECES.map((p) => <ConfettiPiece key={p.key} piece={p} run={visible} />)}

        <Animated.View style={[styles.card, { opacity: cardOpacity }]}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.check}>
              <Ionicons name="checkmark" size={52} color={COLORS.white} />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <PressableScale onPress={onDone} style={{ width: '100%', marginTop: 22 }}>
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,42,34,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { width: '100%', backgroundColor: COLORS.white, borderRadius: RADII.xl, padding: 28, alignItems: 'center', ...SHADOWS.floating },
  check: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 18, ...SHADOWS.floating },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.black, textAlign: 'center' },
  message: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  cta: { paddingVertical: 15, borderRadius: RADII.lg, alignItems: 'center' },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
