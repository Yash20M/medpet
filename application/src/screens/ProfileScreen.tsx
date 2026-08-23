import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { usePets } from '../context/PetsContext';
import { PetCard, AddPetPrompt } from '../components/PetCard';
import { loadDeliveryAddress } from '../utils/deliveryAddress';
import { COLORS, GRADIENTS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'> };

interface MenuItem {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
}

const ProfileScreen = ({ navigation }: Props) => {
  const { user, logout, updateProfile } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const { pets, hasPets, primaryPet } = usePets();
  const insets = useSafeAreaInsets();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    loadDeliveryAddress().then((saved) => setSavedAddress(saved?.address ?? null));
  }, []);

  const comingSoon = (feature: string) =>
    Alert.alert(feature, 'This feature is coming very soon. Stay tuned! 🐾');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      setEditing(false);
    } catch (err) {
      Alert.alert('Could not update profile', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out?', 'You can always sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await logout(); navigation.navigate('Home'); } },
    ]);
  };

  const menu: MenuItem[] = [
    { icon: 'paw-outline', label: 'My Pets', sub: hasPets ? `${pets.length} pet${pets.length === 1 ? '' : 's'}` : 'Add your first pet', onPress: () => navigation.navigate('MyPets') },
    { icon: 'receipt-outline', label: 'My Orders', sub: 'Track your past orders', onPress: () => navigation.navigate('Orders') },
    { icon: 'heart-outline', label: 'Wishlist', sub: `${wishlistItems.length} saved item${wishlistItems.length === 1 ? '' : 's'}`, onPress: () => navigation.navigate('Wishlist') },
    { icon: 'cart-outline', label: 'My Cart', onPress: () => navigation.navigate('Cart') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'chatbubble-ellipses-outline', label: 'Help & Support', sub: 'Chat with our team', onPress: () => navigation.navigate('SupportTickets') },
  ];

  const accountMenu: MenuItem[] = [
    { icon: 'document-text-outline', label: 'Saved Prescriptions', sub: 'Upload & manage prescriptions', onPress: () => comingSoon('Saved Prescriptions') },
    {
      icon: 'location-outline', label: 'Addresses',
      sub: savedAddress ? savedAddress.slice(0, 42) + (savedAddress.length > 42 ? '…' : '') : 'Saved at your next checkout',
      onPress: () => Alert.alert('Delivery Address', savedAddress ?? 'Place an order and your address will be saved here for one-tap reuse.'),
    },
    { icon: 'card-outline', label: 'Payment Methods', sub: 'UPI · Cash on Delivery', onPress: () => comingSoon('Payment Methods') },
    { icon: 'repeat-outline', label: 'Subscriptions', sub: 'Monthly essentials, auto-delivered', onPress: () => comingSoon('Subscription Plans') },
  ];

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.iconBtn} />
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? 'Pet Parent'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        {hasPets && primaryPet
          ? <PetCard pet={primaryPet} onPress={() => navigation.navigate('MyPets')} />
          : <AddPetPrompt onPress={() => navigation.navigate('AddPet')} />}

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Account Details</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.fieldLabel}>Name</Text>
          {editing ? (
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />
          ) : (
            <Text style={styles.fieldValue}>{user?.name}</Text>
          )}

          <Text style={styles.fieldLabel}>Phone</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Add a phone number"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.phone || 'Not added'}</Text>
          )}

          {editing && (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setName(user?.name ?? ''); setPhone(user?.phone ?? ''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          {menu.map((m, i) => (
            <TouchableOpacity
              key={m.label}
              style={[styles.menuItem, i < menu.length - 1 && styles.menuItemBorder]}
              onPress={m.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconBg}>
                <Ionicons name={m.icon} size={19} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{m.label}</Text>
                {!!m.sub && <Text style={styles.menuSub}>{m.sub}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account & Payments</Text>
          {accountMenu.map((m, i) => (
            <TouchableOpacity
              key={m.label}
              style={[styles.menuItem, i < accountMenu.length - 1 && styles.menuItemBorder]}
              onPress={m.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconBg}>
                <Ionicons name={m.icon} size={19} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{m.label}</Text>
                {!!m.sub && <Text style={styles.menuSub}>{m.sub}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.menuItem}>
            <View style={styles.menuIconBg}>
              <Ionicons name="moon-outline" size={19} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Dark Mode</Text>
              <Text style={styles.menuSub}>Easier on the eyes at night</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={(v) => {
                setDarkMode(v);
                if (v) Alert.alert('Dark Mode', 'A full dark theme is on its way — this is a sneak peek toggle. 🌙');
              }}
              trackColor={{ false: COLORS.grayBorder, true: COLORS.mint }}
              thumbColor={darkMode ? COLORS.primary : COLORS.white}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  avatarWrap: { alignItems: 'center' },
  avatar: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 30 },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scrollContent: { padding: 20, gap: 16 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  editLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  fieldLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 10 },
  fieldValue: { fontSize: 15, color: COLORS.black, fontWeight: '600', marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: 10, paddingHorizontal: 12,
    height: 42, fontSize: 14, color: COLORS.black, marginTop: 4, backgroundColor: COLORS.grayLight,
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.grayLight },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },
  saveBtn: { flex: 1, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  saveText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  menuIconBg: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  menuSub: { fontSize: 12, color: COLORS.gray, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
});

export default ProfileScreen;
