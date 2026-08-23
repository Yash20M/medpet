import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supportAPI } from '../services/api';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'NewSupportTicket'> };

const NewSupportTicketScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!subject.trim()) { Alert.alert('Subject required', 'Please give your request a short subject.'); return; }
    if (!body.trim()) { Alert.alert('Message required', 'Please describe what you need help with.'); return; }
    setSending(true);
    try {
      const res = await supportAPI.createTicket(subject.trim(), body.trim());
      navigation.replace('SupportTicketDetail', { ticketId: res.data.ticket.id, subject: res.data.ticket.subject });
    } catch (err) {
      Alert.alert('Could not send', (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Request</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.headerSub}>Tell us what you need help with</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Where is my order?"
            placeholderTextColor={COLORS.gray}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Describe your issue in detail…"
            placeholderTextColor={COLORS.gray}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={sending}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {sending ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <Ionicons name="send" size={17} color={COLORS.white} />
                <Text style={styles.submitText}>Send message</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: RADII.xl, borderBottomRightRadius: RADII.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, marginLeft: 4 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 16, marginBottom: 18, ...SHADOWS.card },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.gray, marginTop: 4, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADII.sm, paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 14, color: COLORS.black, backgroundColor: COLORS.white,
  },
  textarea: { height: 130, paddingTop: 10, marginTop: 12 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADII.lg, paddingVertical: 16, ...SHADOWS.floating },
  submitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});

export default NewSupportTicketScreen;
