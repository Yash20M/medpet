import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS } from '../theme/colors';

const { width, height } = Dimensions.get('window');

// Floating paw prints that drift upward and fade — pure decoration.
const PAWS = Array.from({ length: 8 }).map((_, i) => ({
  key: i,
  x: Math.random() * width,
  size: 16 + Math.random() * 20,
  delay: Math.random() * 2200,
  duration: 3200 + Math.random() * 1800,
}));

const FloatingPaw = ({ paw }: { paw: typeof PAWS[number] }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: paw.duration, delay: paw.delay, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [t, paw.duration, paw.delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [height * 0.85, -60] });
  const opacity = t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.5, 0.5, 0] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] });

  return (
    <Animated.Text style={{ position: 'absolute', left: paw.x, fontSize: paw.size, opacity, transform: [{ translateY }, { rotate }] }}>
      🐾
    </Animated.Text>
  );
};

const SplashScreen = () => {
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const dotsAnim    = useRef(new Animated.Value(0)).current;
  const pulse       = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(tagOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotsAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dotsAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ),
    ]).start();

    // Gentle breathing on the logo badge.
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient colors={GRADIENTS.primary} style={styles.container}>
      <View style={[styles.circle, styles.topRight]} />
      <View style={[styles.circle, styles.bottomLeft]} />

      {PAWS.map((p) => <FloatingPaw key={p.key} paw={p} />)}

      <Animated.View style={[styles.logo, { transform: [{ scale: Animated.multiply(logoScale, pulse) }], opacity: logoOpacity }]}>
        <View style={styles.iconBg}>
          <Text style={styles.icon}>🐾</Text>
        </View>
        <Text style={styles.appName}>MedPet</Text>
        <Text style={styles.tagline}>Your Pet's Health Partner</Text>
      </Animated.View>

      <Animated.View style={[styles.dots, { opacity: tagOpacity }]}>
        <Animated.View style={[styles.dot, { opacity: dotsAnim }]} />
        <Animated.View style={[styles.dot, styles.dotMid, { opacity: dotsAnim }]} />
        <Animated.View style={[styles.dot, { opacity: dotsAnim }]} />
      </Animated.View>

      <Animated.Text style={[styles.sub, { opacity: tagOpacity }]}>
        Medicines · Nutrition · Grooming
      </Animated.Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute', width: 300, height: 300,
    borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  topRight:   { top: -80, right: -80 },
  bottomLeft: { bottom: -100, left: -80 },
  logo:       { alignItems: 'center', marginBottom: 60 },
  iconBg: {
    width: 110, height: 110, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  icon:    { fontSize: 56 },
  appName: { fontSize: 42, fontWeight: '800', color: COLORS.white, letterSpacing: 2 },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  dots:    { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)', marginHorizontal: 4,
  },
  dotMid: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.white },
  sub: {
    position: 'absolute', bottom: 60,
    fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 1,
  },
});

export default SplashScreen;
