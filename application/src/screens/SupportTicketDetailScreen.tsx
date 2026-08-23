import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import EventSource from 'react-native-sse';
import * as SecureStore from 'expo-secure-store';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { supportAPI, ApiSupportMessage, notificationStreamUrl } from '../services/api';
import { COLORS, GRADIENTS, RADII } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import PressableScale from '../components/PressableScale';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SupportTicketDetail'>;
  route: RouteProp<RootStackParamList, 'SupportTicketDetail'>;
};

interface SupportMessageEvent {
  message: ApiSupportMessage;
  ticket: { id: number; subject: string; status: string };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const SupportTicketDetailScreen = ({ navigation, route }: Props) => {
  const { ticketId, subject } = route.params;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ApiSupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await supportAPI.getTicket(ticketId);
        if (active) setMessages(res.data.messages);
      } catch {
        /* keep empty state */
      } finally {
        if (active) setLoading(false);
      }
    })();
    const t = setTimeout(() => { supportAPI.markRead(ticketId).catch(() => {}); }, 600);

    // Live updates ride the same notifications stream — filter by ticket_id.
    let es: EventSource<'support_message'> | null = null;
    (async () => {
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) return;
      es = new EventSource<'support_message'>(notificationStreamUrl(token));
      es.addEventListener('support_message', (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data) as SupportMessageEvent;
          if (payload.message.ticket_id !== ticketId) return;
          setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
          supportAPI.markRead(ticketId).catch(() => {});
        } catch {
          /* ignore malformed frame */
        }
      });
    })();

    return () => {
      clearTimeout(t);
      es?.removeAllEventListeners();
      es?.close();
    };
  }, [ticketId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setDraft('');
    try {
      const res = await supportAPI.sendMessage(ticketId, body);
      setMessages((prev) => [...prev, res.data]);
    } catch {
      setDraft(body); // restore on failure so the user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{subject ?? 'Support'}</Text>
          <View style={styles.iconBtn} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubbleRow, m.sender_role === 'user' && styles.bubbleRowMine]}>
              <View style={[styles.bubble, m.sender_role === 'user' ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, m.sender_role === 'user' && styles.bubbleTextMine]}>{m.body}</Text>
                <Text style={[styles.bubbleTime, m.sender_role === 'user' && styles.bubbleTimeMine]}>{fmtTime(m.created_at)}</Text>
              </View>
            </View>
          ))}
          {messages.length === 0 && <Text style={styles.emptyText}>No messages yet.</Text>}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.gray}
          multiline
        />
        <PressableScale onPress={send} disabled={sending || !draft.trim()} style={styles.sendBtn}>
          {sending ? <ActivityIndicator color={COLORS.white} size="small" /> : <Ionicons name="send" size={18} color={COLORS.white} />}
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: COLORS.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingBottom: 12, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: RADII.md, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleTheirs: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.grayBorder },
  bubbleMine: { backgroundColor: COLORS.primary },
  bubbleText: { fontSize: 14, color: COLORS.black, lineHeight: 19 },
  bubbleTextMine: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.gray, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  emptyText: { textAlign: 'center', color: COLORS.gray, marginTop: 40 },
  footer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADII.md,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.black,
    maxHeight: 100, backgroundColor: COLORS.background,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: RADII.pill, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default SupportTicketDetailScreen;
