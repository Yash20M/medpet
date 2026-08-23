import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LatLng } from '../../services/api';
import { bboxOf, makeProjector, splitByProgress, XY } from '../../utils/tracking';
import { COLORS } from '../../theme/colors';

interface Props {
  pickup: LatLng | null;
  drop: LatLng | null;
  polyline: LatLng[];
  driver: LatLng | null;
  progress: number;
  heading?: number;
  height: number;
  delivered?: boolean;
}

interface Segment { x: number; y: number; w: number; angle: number; }

// Build rotated line-segments connecting projected points — a polyline drawn
// with plain Views (no react-native-svg, so no native module required).
const toSegments = (pts: XY[]): Segment[] => {
  const segs: Segment[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const w = Math.hypot(dx, dy);
    if (w < 0.5) continue;
    segs.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w, angle: (Math.atan2(dy, dx) * 180) / Math.PI });
  }
  return segs;
};

// Downsample so we never render hundreds of Views for a dense OSRM polyline.
const downsample = (pts: XY[], max = 60): XY[] => {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  const out: XY[] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
};

/**
 * Key-free "vector map": the real OSRM route + real driver GPS projected onto a
 * styled canvas. Completed route is solid green, remaining is faint. The driver
 * marker animates smoothly (800 ms) between pings with a pulse ring.
 * Uses ONLY core RN Views — renders in Expo Go and any dev build.
 */
const VectorMap = ({ pickup, drop, polyline, driver, progress, height, delivered }: Props) => {
  const [width, setWidth] = useState(0);
  const pos = useRef(new Animated.ValueXY({ x: -100, y: -100 })).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const initialised = useRef(false);

  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  const project = useMemo(() => {
    if (width === 0) return null;
    const pts = [...polyline];
    if (pickup) pts.push(pickup);
    if (drop) pts.push(drop);
    if (driver) pts.push(driver);
    return makeProjector(bboxOf(pts), width, height);
  }, [polyline, pickup, drop, driver, width, height]);

  const routePts = useMemo(() => (project ? downsample(polyline.map(project)) : []), [project, polyline]);
  const { done, rest } = useMemo(() => splitByProgress(routePts, progress), [routePts, progress]);
  const doneSegs = useMemo(() => toSegments(done), [done]);
  const restSegs = useMemo(() => toSegments(rest), [rest]);
  const pickupXY = useMemo(() => (project && pickup ? project(pickup) : null), [project, pickup]);
  const dropXY = useMemo(() => (project && drop ? project(drop) : null), [project, drop]);

  // Smoothly animate the driver marker toward each new projected position.
  useEffect(() => {
    if (!project || !driver) return;
    const { x, y } = project(driver);
    if (!initialised.current) {
      pos.setValue({ x, y });
      initialised.current = true;
    } else {
      Animated.timing(pos, { toValue: { x, y }, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();
    }
  }, [project, driver, pos]);

  // Continuous "live" pulse ring around the driver.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout}>
      <LinearGradient colors={['#0B1220', '#111C33']} style={StyleSheet.absoluteFill} />

      {/* Decorative "blocks" so the dark canvas reads like a city map */}
      <View style={[styles.block, { left: '8%', top: '12%', width: 60, height: 42 }]} />
      <View style={[styles.block, { right: '10%', top: '20%', width: 48, height: 56 }]} />
      <View style={[styles.block, { left: '18%', bottom: '16%', width: 54, height: 38 }]} />
      <View style={[styles.block, { right: '16%', bottom: '22%', width: 44, height: 44 }]} />

      {/* Remaining route — faint */}
      {restSegs.map((s, i) => (
        <View key={`r${i}`} pointerEvents="none"
          style={[styles.segRest, { left: s.x - s.w / 2, top: s.y - 2, width: s.w, transform: [{ rotate: `${s.angle}deg` }] }]} />
      ))}
      {/* Completed route — solid green */}
      {doneSegs.map((s, i) => (
        <View key={`d${i}`} pointerEvents="none"
          style={[styles.segDone, { left: s.x - s.w / 2, top: s.y - 2.5, width: s.w, transform: [{ rotate: `${s.angle}deg` }] }]} />
      ))}

      {/* Pickup pin */}
      {pickupXY && (
        <View style={[styles.pin, styles.pinStore, { left: pickupXY.x - 14, top: pickupXY.y - 14 }]}>
          <Text style={styles.pinEmoji}>🏬</Text>
        </View>
      )}

      {/* Drop pin */}
      {dropXY && (
        <View style={[styles.pin, styles.pinHome, { left: dropXY.x - 14, top: dropXY.y - 14 }]}>
          <Text style={styles.pinEmoji}>🏠</Text>
        </View>
      )}

      {/* Driver marker */}
      {driver && (
        <Animated.View
          pointerEvents="none"
          style={[styles.driverWrap, { transform: [{ translateX: Animated.subtract(pos.x, 20) }, { translateY: Animated.subtract(pos.y, 20) }] }]}
        >
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: delivered ? 0 : pulseOpacity }]} />
          <View style={styles.driverBubble}>
            <Text style={{ fontSize: 18 }}>{delivered ? '✅' : '🛵'}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: '#0B1220' },
  block: { position: 'absolute', backgroundColor: 'rgba(148,163,184,0.10)', borderRadius: 6 },
  segRest: { position: 'absolute', height: 4, backgroundColor: 'rgba(148,163,184,0.5)', borderRadius: 2 },
  segDone: { position: 'absolute', height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },
  pin: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  },
  pinStore: { backgroundColor: COLORS.accent },
  pinHome: { backgroundColor: COLORS.primaryDark },
  pinEmoji: { fontSize: 13 },
  driverWrap: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.mint },
  driverBubble: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
});

export default VectorMap;
