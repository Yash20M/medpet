import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../PressableScale';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../../theme/colors';

interface Props {
  onVideoCall: () => void;
  onChat: () => void;
  onSchedule: () => void;
}

/** Purple vet-consultation card with a pulsing "Available now" indicator and
 *  three consult entry points. */
const VetConsultCard = ({ onVideoCall, onChat, onSchedule }: Props) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  return (
    <LinearGradient colors={GRADIENTS.purple} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.decor} />
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.onlineRow}>
            <Animated.View style={[styles.onlineDot, { opacity: dotOpacity }]} />
            <Text style={styles.onlineText}>Available now</Text>
          </View>
          <Text style={styles.title}>Talk to a Vet</Text>
          <Text style={styles.sub}>Certified vets, 24/7 · First consult free</Text>
        </View>
        <View style={styles.docWrap}>
          <Text style={{ fontSize: 44 }}>👨‍⚕️</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PressableScale style={styles.actionPrimary} onPress={onVideoCall} scaleTo={0.94}>
          <Ionicons name="videocam" size={16} color={COLORS.purpleDark} />
          <Text style={styles.actionPrimaryText} numberOfLines={1} adjustsFontSizeToFit>Video Call</Text>
        </PressableScale>
        <PressableScale style={styles.actionGhost} onPress={onChat} scaleTo={0.94}>
          <Ionicons name="chatbubble-ellipses" size={15} color={COLORS.white} />
          <Text style={styles.actionGhostText} numberOfLines={1} adjustsFontSizeToFit>Chat</Text>
        </PressableScale>
        <PressableScale style={styles.actionGhost} onPress={onSchedule} scaleTo={0.94}>
          <Ionicons name="calendar" size={15} color={COLORS.white} />
          <Text style={styles.actionGhostText} numberOfLines={1} adjustsFontSizeToFit>Schedule</Text>
        </PressableScale>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: RADII.lg, padding: 18, overflow: 'hidden', ...SHADOWS.soft },
  decor: {
    position: 'absolute', top: -50, right: -50, width: 160, height: 160,
    borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  onlineText: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  docWrap: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionPrimary: {
    flex: 1.2, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.white, borderRadius: RADII.md, paddingVertical: 10, paddingHorizontal: 2, overflow: 'hidden',
  },
  actionPrimaryText: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: COLORS.purpleDark },
  actionGhost: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: RADII.md, paddingVertical: 10, paddingHorizontal: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden',
  },
  actionGhostText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: COLORS.white },
});

export default VetConsultCard;
