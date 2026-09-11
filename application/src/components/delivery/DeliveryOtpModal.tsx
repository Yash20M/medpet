import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../../theme/colors';

type Props = {
  visible: boolean;
  orderId: number | null;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (otp: string) => void;
};

/**
 * The customer is emailed a 6-digit code when their order goes out for
 * delivery. The delivery partner asks them for it in person and enters it
 * here to confirm the handoff — this is what actually completes the order.
 */
const DeliveryOtpModal = ({ visible, orderId, loading, error, onCancel, onConfirm }: Props) => {
  const [otp, setOtp] = useState('');

  useEffect(() => { if (visible) setOtp(''); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={26} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Confirm delivery{orderId ? ` — #${orderId}` : ''}</Text>
          <Text style={styles.sub}>
            Ask the customer for their 6-digit delivery code — we emailed it to them when this order went out for delivery.
          </Text>

          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={COLORS.grayBorder}
            autoFocus
            editable={!loading}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (otp.length !== 6 || loading) && styles.confirmBtnDisabled]}
              onPress={() => onConfirm(otp)}
              disabled={otp.length !== 6 || loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmText}>Confirm delivery</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,42,34,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 24, alignItems: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.black, textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 13, color: COLORS.gray, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  input: {
    width: '100%', borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADII.md,
    paddingVertical: 14, textAlign: 'center', fontSize: 26, fontWeight: '800',
    letterSpacing: 10, color: COLORS.black, marginBottom: 6,
  },
  error: { fontSize: 13, color: COLORS.errorDark, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.grayBorder, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },
  confirmBtn: { flex: 1.4, paddingVertical: 13, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
});

export default DeliveryOtpModal;
