import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Dimensions, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationsContext';
import { useWishlist } from '../context/WishlistContext';
import { usePets } from '../context/PetsContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import BannerCarousel from '../components/BannerCarousel';
import MediaThumb from '../components/MediaThumb';
import SectionHeader from '../components/SectionHeader';
import { PetCard, AddPetPrompt } from '../components/PetCard';
import AddPetModal from '../components/AddPetModal';
import DeliveryCard from '../components/home/DeliveryCard';
import QuickActions from '../components/home/QuickActions';
import FlashSale from '../components/home/FlashSale';
import HealthReminderCard from '../components/home/HealthReminderCard';
import VetConsultCard from '../components/home/VetConsultCard';
import BrandsRow from '../components/home/BrandsRow';
import ReviewsCarousel from '../components/home/ReviewsCarousel';
import HealthTipsRow from '../components/home/HealthTipsRow';
import NearbyStores from '../components/home/NearbyStores';
import RecentlyPurchased from '../components/home/RecentlyPurchased';
import { COLORS, GRADIENTS, RADII } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { QuickAction } from '../data/premium';
import { formatPrice } from '../types/product.types';
import { useCategories, useProducts, useOffers } from '../hooks/useCatalog';
import { useHomeContent } from '../hooks/useHomeContent';
import { orderAPI, trackingAPI, LivePhase } from '../services/api';
import { TRACKABLE_STATUSES } from '../utils/tracking';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

// Show the "add your pet" nudge at most once per app session.
let petPromptShownThisSession = false;

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

/** Deterministic "from ₹xx" price shown on category cards. */
const catStartPrice = (id: string): number => 49 + (id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 8) * 25;
const catCount = (id: string): number => 12 + (id.split('').reduce((a, c) => a + c.charCodeAt(0), 3) % 40);

const HomeScreen = ({ navigation }: Props) => {
  const { user, isAuthenticated } = useAuth();
  const { itemCount, addItem } = useCart();
  const { unread } = useNotifications();
  const { isWishlisted, toggle } = useWishlist();
  const { hasPets, primaryPet, loaded: petsLoaded } = usePets();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const { data: categories, reload: reloadCategories } = useCategories();
  const { data: featured, reload: reloadFeatured } = useProducts({ featured: true });
  const { data: offers, reload: reloadOffers } = useOffers();
  const content = useHomeContent();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showPetModal, setShowPetModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState<{ id: number; phase: LivePhase | null; etaMins: number | null } | null>(null);

  const loadActiveOrder = useCallback(async () => {
    if (!isAuthenticated) { setActiveOrder(null); return; }
    try {
      const res = await orderAPI.list();
      const trackable = res.data.find((o) => TRACKABLE_STATUSES.has(o.status));
      if (!trackable) { setActiveOrder(null); return; }
      let phase: LivePhase | null = null;
      let etaMins: number | null = null;
      try {
        const t = await trackingAPI.get(trackable.id);
        phase = t.data.phase;
        etaMins = t.data.tracking.etaMinutes ?? t.data.route?.estimatedMinutes ?? null;
      } catch { /* order exists but tracking not dispatched yet — show without ETA */ }
      setActiveOrder({ id: trackable.id, phase, etaMins });
    } catch {
      setActiveOrder(null);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadActiveOrder(); }, [loadActiveOrder]);

  // Once signed in and pets have actually been fetched, nudge the user to add
  // one if none exist. `petsLoaded` only flips true after the first fetch, so
  // this fires once on a stable condition (not during the loading transient).
  useEffect(() => {
    if (isAuthenticated && petsLoaded && !hasPets && !petPromptShownThisSession) {
      petPromptShownThisSession = true;
      const t = setTimeout(() => setShowPetModal(true), 600);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, petsLoaded, hasPets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    content.reload();
    await Promise.all([reloadCategories(), reloadFeatured(), reloadOffers(), loadActiveOrder()]);
    setRefreshing(false);
  }, [reloadCategories, reloadFeatured, reloadOffers, content.reload, loadActiveOrder]);

  const greeting = (): string => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Browsing and cart are open to guests; auth is only enforced at checkout.
  const openCart = () => navigation.navigate('Cart');
  const openNotifications = () => requireAuth(() => navigation.navigate('Notifications'), 'Login');

  const comingSoon = (feature: string) =>
    Alert.alert(feature, 'This service is coming to your area very soon. Stay tuned! 🐾');

  const handleQuickAction = (action: QuickAction) => {
    switch (action.id) {
      case 'medicines': navigation.navigate('ProductList', { title: 'Medicines' }); break;
      case 'grooming': navigation.navigate('ProductList', { title: 'Grooming' }); break;
      case 'vet': comingSoon('Vet Consultation'); break;
      case 'prescription': comingSoon('Upload Prescription'); break;
      case 'vaccination': comingSoon('Book Vaccination'); break;
      case 'emergency':
        Alert.alert('Emergency Care 🚨', '24/7 emergency helpline:\n1800-PET-HELP\n\nNearest 24h clinic: MedPet Indiranagar (1.2 km)');
        break;
      case 'insurance': comingSoon('Pet Insurance'); break;
      case 'subscription': comingSoon('Subscription Plans'); break;
    }
  };

  const openSupportChat = () =>
    requireAuth(() => navigation.navigate('SupportTickets'), 'Login');

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* ─── Header ─────────────────────────────────────────── */}
      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerDecor} />
        <View style={styles.headerDecor2} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] ?? 'Pet Parent'} 👋</Text>
            <Text style={styles.headerSub}>What does your pet need today?</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={openNotifications}>
              <Ionicons name="notifications-outline" size={23} color={COLORS.white} />
              {unread > 0 && (
                <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{unread}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={openCart}>
              <Ionicons name="cart-outline" size={24} color={COLORS.white} />
              {itemCount > 0 && (
                <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{itemCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => (isAuthenticated ? navigation.navigate('Profile') : navigation.navigate('Login'))}
            >
              {isAuthenticated
                ? <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</Text>
                : <Ionicons name="person-outline" size={20} color={COLORS.white} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search medicines, food, supplements..."
            placeholderTextColor={COLORS.gray}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchExtras}>
              <TouchableOpacity hitSlop={6} onPress={() => comingSoon('Voice Search')}>
                <Ionicons name="mic-outline" size={19} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={6} onPress={() => comingSoon('Camera Search')}>
                <Ionicons name="camera-outline" size={19} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={6} onPress={() => comingSoon('Barcode Scanner')}>
                <Ionicons name="barcode-outline" size={19} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >

        {/* ─── Delivery status — only shown while an order is actually in flight ─── */}
        {isAuthenticated && activeOrder && (
          <View style={styles.section}>
            <DeliveryCard
              orderId={activeOrder.id}
              phase={activeOrder.phase}
              etaMins={activeOrder.etaMins}
              onPress={() => navigation.navigate('LiveTracking', { orderId: activeOrder.id })}
            />
          </View>
        )}

        {/* ─── My Pet ──────────────────────────────────────── */}
        {isAuthenticated && (
          <View style={styles.section}>
            {hasPets && primaryPet
              ? <PetCard pet={primaryPet} onPress={() => navigation.navigate('MyPets')} />
              : <AddPetPrompt onPress={() => navigation.navigate('AddPet')} />}
          </View>
        )}

        {/* ─── Banner Carousel ─────────────────────────────── */}
        <View style={styles.section}>
          <BannerCarousel banners={offers} />
        </View>

        {/* ─── Quick Actions ───────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Services" subtitle="Everything your pet needs, in one tap" />
          <QuickActions onAction={handleQuickAction} />
        </View>

        {/* ─── Categories ──────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="Shop by Pet"
            onAction={() => navigation.navigate('ProductList', { title: 'All Products' })}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 4 }}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catCard, { backgroundColor: c.color }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ProductList', { category: c.label })}
              >
                <View style={[styles.catIconBg, { backgroundColor: c.iconBg }]}>
                  <MediaThumb uri={c.imageUrl} emoji={c.icon} emojiSize={26} style={StyleSheet.absoluteFill} rounded={14} />
                </View>
                <Text style={styles.catLabel}>{c.label}</Text>
                <Text style={styles.catMeta}>{catCount(c.id)} items</Text>
                <Text style={styles.catPrice}>from {formatPrice(catStartPrice(c.id))}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── Flash Sale — products flagged by the admin; falls back to
             featured picks until any are flagged ─────────────── */}
        <View style={styles.section}>
          <FlashSale
            products={content.flashProducts.length > 0 ? content.flashProducts : featured}
            endsAt={content.flashEndsAt}
            onProduct={(id) => navigation.navigate('ProductDetail', { productId: id })}
          />
        </View>

        {/* ─── Featured Products ───────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="Featured Products"
            onAction={() => navigation.navigate('ProductList', { title: 'All Products' })}
          />
          <View style={styles.grid}>
            {featured.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.productCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
              >
                <View style={styles.productImg}>
                  <MediaThumb uri={p.imageUrl} emoji={p.emoji} emojiSize={54} style={StyleSheet.absoluteFill} />
                  <View style={styles.fastBadge}>
                    <Ionicons name="flash" size={9} color={COLORS.white} />
                    <Text style={styles.fastBadgeText}>Fast</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.wishlistBtn}
                    onPress={() => requireAuth(() => toggle(p), 'Login')}
                  >
                    <Ionicons
                      name={isWishlisted(p.id) ? 'heart' : 'heart-outline'}
                      size={16}
                      color={isWishlisted(p.id) ? COLORS.primary : COLORS.gray}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productBrand}>{p.brand}</Text>
                  <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.ratingText}>{p.rating}</Text>
                    <Text style={styles.reviewText}>({p.reviews})</Text>
                    {!p.inStock && <Text style={styles.oosText}>Out of stock</Text>}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{formatPrice(p.price)}</Text>
                    <Text style={styles.oldPrice}>{formatPrice(p.originalPrice)}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => addItem(p)} disabled={!p.inStock}>
                    <LinearGradient colors={p.inStock ? GRADIENTS.primary : ['#CBD5E1', '#94A3B8']} style={styles.addBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="add" size={16} color={COLORS.white} />
                      <Text style={styles.addBtnText}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Buy Again ───────────────────────────────────── */}
        {isAuthenticated && (
          <View style={styles.section}>
            <RecentlyPurchased />
          </View>
        )}

        {/* ─── Health Reminder ─────────────────────────────── */}
        {isAuthenticated && (
          <View style={styles.section}>
            <HealthReminderCard onPress={() => comingSoon('Book Vaccination')} />
          </View>
        )}

        {/* ─── Vet Consultation ────────────────────────────── */}
        <View style={styles.section}>
          <VetConsultCard
            onVideoCall={() => comingSoon('Video Consultation')}
            onChat={openSupportChat}
            onSchedule={() => comingSoon('Schedule Appointment')}
          />
        </View>

        {/* ─── Popular Brands ──────────────────────────────── */}
        {content.brands.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Popular Brands" />
            <BrandsRow brands={content.brands} onBrand={(name) => navigation.navigate('ProductList', { title: name })} />
          </View>
        )}

        {/* ─── Reviews ─────────────────────────────────────── */}
        {content.testimonials.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Loved by Pet Parents" subtitle="Real reviews from real families" />
            <ReviewsCarousel testimonials={content.testimonials} />
          </View>
        )}

        {/* ─── Health Tips ─────────────────────────────────── */}
        {content.tips.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Pet Health Tips" subtitle="Curated by our vet team" />
            <HealthTipsRow
              tips={content.tips}
              onTip={(tip) => navigation.navigate('HealthTipArticle', { tipId: tip.id, tip })}
            />
          </View>
        )}

        {/* ─── Nearby Stores ───────────────────────────────── */}
        {content.stores.length > 0 && (
          <View style={[styles.section, { marginBottom: 24 }]}>
            <SectionHeader title="Stores Near You" />
            <NearbyStores stores={content.stores} />
          </View>
        )}

      </ScrollView>

      <AddPetModal
        visible={showPetModal}
        onAdd={() => { setShowPetModal(false); navigation.navigate('AddPet'); }}
        onDismiss={() => setShowPetModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden' },
  headerDecor: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerDecor2: {
    position: 'absolute', bottom: -80, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting:  { fontSize: 18, fontWeight: '700', color: COLORS.white, marginBottom: 2 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn:   { position: 'relative', padding: 2 },
  cartBadge: {
    position: 'absolute', top: -6, right: -8,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.primaryDark,
  },
  cartBadgeText: { color: COLORS.black, fontSize: 10, fontWeight: '800' },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 16, paddingHorizontal: 14, height: 48,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.black },
  searchExtras: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 20 },
  section:       { paddingHorizontal: 20, marginBottom: 24 },
  catCard: {
    width: 96, borderRadius: RADII.md, padding: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  catIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  catLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.black, textAlign: 'center' },
  catMeta:   { fontSize: 9, color: COLORS.gray, marginTop: 2 },
  catPrice:  { fontSize: 9, color: COLORS.primaryDark, fontWeight: '800', marginTop: 1 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: {
    width: CARD_W, backgroundColor: COLORS.white, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  productImg: { backgroundColor: COLORS.grayLight, height: 110, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  fastBadge: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: COLORS.secondaryDark, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, zIndex: 1,
  },
  fastBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  wishlistBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  productInfo:  { padding: 12 },
  productBrand: { fontSize: 10, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  productName:  { fontSize: 13, fontWeight: '700', color: COLORS.black, marginBottom: 5, lineHeight: 18 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  ratingText:   { fontSize: 11, fontWeight: '700', color: COLORS.black },
  reviewText:   { fontSize: 11, color: COLORS.gray },
  oosText:      { fontSize: 9, color: COLORS.error, fontWeight: '700', marginLeft: 4 },
  priceRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  price:        { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  oldPrice:     { fontSize: 12, color: COLORS.gray, textDecorationLine: 'line-through' },
  addBtn:       { borderRadius: 10, overflow: 'hidden' },
  addBtnGrad:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7 },
  addBtnText:   { color: COLORS.white, fontSize: 12, fontWeight: '700' },
});

export default HomeScreen;
