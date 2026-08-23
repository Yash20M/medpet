import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../PressableScale';
import { COLORS } from '../../theme/colors';

interface Props {
  name: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  phone: string | null;
  onCall: () => void;
  onChat: () => void;
}

const vehicleLabel = (type: string | null, number: string | null): string => {
  const t = type === 'bike' ? 'Motorbike' : type === 'scooter' ? 'Scooter' : 'Vehicle';
  return number ? `${t} · ${number}` : t;
};

/** Bottom-sheet rider card (name, vehicle, call + chat). */
const DriverCard = ({ name, vehicleNumber, vehicleType, phone, onCall, onChat }: Props) => (
  <View style={styles.card}>
    <View style={styles.avatar}><Text style={{ fontSize: 24 }}>🧑‍✈️</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.name}>{name ?? 'Assigning a rider…'}</Text>
      <Text style={styles.meta}>{vehicleLabel(vehicleType, vehicleNumber)}</Text>
    </View>
    <PressableScale style={[styles.btn, { backgroundColor: COLORS.primaryLight }, !phone && styles.btnDisabled]} scaleTo={0.9} onPress={onCall} disabled={!phone}>
      <Ionicons name="call" size={18} color={COLORS.primaryDark} />
    </PressableScale>
    <PressableScale style={[styles.btn, { backgroundColor: COLORS.secondaryLight }]} scaleTo={0.9} onPress={onChat}>
      <Ionicons name="chatbubble-ellipses" size={17} color={COLORS.secondaryDark} />
    </PressableScale>
  </View>
);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 18, padding: 14, shadowColor: '#0F2A22', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  meta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.45 },
});

export default DriverCard;
