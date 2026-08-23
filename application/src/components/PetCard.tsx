import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { Pet, PET_EMOJI, PET_TYPE_LABEL, formatPetAge } from '../types/pet.types';

interface PetCardProps {
  pet: Pet;
  onPress?: () => void;
}

export const PetCard = ({ pet, onPress }: PetCardProps) => (
  <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.cardWrap}>
    <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.avatar}>
        {pet.avatar_url
          ? <Image source={{ uri: pet.avatar_url }} style={styles.avatarImg} />
          : <Text style={styles.avatarEmoji}>{PET_EMOJI[pet.type]}</Text>}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{pet.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {PET_TYPE_LABEL[pet.type]}{pet.breed ? ` · ${pet.breed}` : ''}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.pill}><Ionicons name="time-outline" size={12} color={COLORS.white} /><Text style={styles.pillText}>{formatPetAge(pet.age_years)}</Text></View>
          {pet.weight_kg != null && (
            <View style={styles.pill}><Ionicons name="barbell-outline" size={12} color={COLORS.white} /><Text style={styles.pillText}>{pet.weight_kg} kg</Text></View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
    </LinearGradient>
  </TouchableOpacity>
);

export const AddPetPrompt = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.promptWrap}>
    <View style={styles.promptIcon}><Text style={{ fontSize: 26 }}>🐾</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.promptTitle}>Add your pet</Text>
      <Text style={styles.promptSub}>Get tailored medicine & care recommendations</Text>
    </View>
    <View style={styles.promptPlus}>
      <Ionicons name="add" size={22} color={COLORS.white} />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  cardWrap: { borderRadius: RADII.lg, ...SHADOWS.floating },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: RADII.lg, gap: 14 },
  avatar: {
    width: 58, height: 58, borderRadius: RADII.md, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 32 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADII.pill,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: COLORS.white },

  promptWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.white,
    borderRadius: RADII.lg, padding: 14, borderWidth: 1.5, borderColor: COLORS.primaryLight, ...SHADOWS.card,
  },
  promptIcon: {
    width: 52, height: 52, borderRadius: RADII.md, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  promptTitle: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  promptSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  promptPlus: {
    width: 40, height: 40, borderRadius: RADII.pill, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.floating,
  },
});

export default PetCard;
