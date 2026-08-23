import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePets } from '../context/PetsContext';
import { COLORS, GRADIENTS, RADII, SHADOWS } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';
import { PetType, PetGender, PET_EMOJI, PET_TYPE_LABEL } from '../types/pet.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AddPet'> };

const TYPES: PetType[] = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'horse', 'reptile', 'other'];
const GENDERS: { value: PetGender; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'male', label: 'Male', icon: 'male' },
  { value: 'female', label: 'Female', icon: 'female' },
  { value: 'unknown', label: 'Skip', icon: 'help' },
];

const AddPetScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { addPet } = usePets();

  const [type, setType] = useState<PetType>('dog');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<PetGender>('unknown');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Name your pet', 'Please enter your pet’s name.'); return; }
    setSaving(true);
    try {
      await addPet({
        name: name.trim(),
        type,
        breed: breed.trim() || undefined,
        gender,
        age_years: age ? Number(age) : null,
        weight_kg: weight ? Number(weight) : null,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save pet', (err as Error).message);
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>Add your pet</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.headerSub}>{PET_EMOJI[type]} Tell us about your companion</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Pet type</Text>
        <View style={styles.typeGrid}>
          {TYPES.map((t) => {
            const active = type === t;
            return (
              <TouchableOpacity key={t} activeOpacity={0.85} onPress={() => setType(t)} style={[styles.typeChip, active && styles.typeChipActive]}>
                <Text style={styles.typeEmoji}>{PET_EMOJI[t]}</Text>
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{PET_TYPE_LABEL[t]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Bruno" placeholderTextColor={COLORS.gray} />

          <Text style={styles.label}>Breed (optional)</Text>
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="e.g. Labrador" placeholderTextColor={COLORS.gray} />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Age (years)</Text>
              <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="2" placeholderTextColor={COLORS.gray} keyboardType="decimal-pad" />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="12" placeholderTextColor={COLORS.gray} keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => {
              const active = gender === g.value;
              return (
                <TouchableOpacity key={g.value} activeOpacity={0.85} onPress={() => setGender(g.value)} style={[styles.genderChip, active && styles.genderChipActive]}>
                  <Ionicons name={g.icon} size={16} color={active ? COLORS.white : COLORS.gray} />
                  <Text style={[styles.genderLabel, active && { color: COLORS.white }]}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={save} disabled={saving}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {saving ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <Ionicons name="paw" size={18} color={COLORS.white} />
                <Text style={styles.ctaText}>Save pet</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: RADII.xl, borderBottomRightRadius: RADII.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 8, marginLeft: 4 },
  scroll: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.gray, marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: {
    width: '22%', minWidth: 72, alignItems: 'center', paddingVertical: 12, borderRadius: RADII.md,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.grayBorder, ...SHADOWS.card,
  },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  typeEmoji: { fontSize: 26 },
  typeLabel: { fontSize: 11, fontWeight: '700', color: COLORS.gray, marginTop: 4 },
  typeLabelActive: { color: COLORS.primaryDark },
  card: { backgroundColor: COLORS.white, borderRadius: RADII.lg, padding: 18, marginTop: 18, ...SHADOWS.card },
  input: {
    borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADII.md, paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 15, color: COLORS.black, backgroundColor: COLORS.white,
  },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: RADII.md, borderWidth: 1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.white,
  },
  genderChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  footer: {
    paddingHorizontal: 20, paddingTop: 12, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.grayBorder,
  },
  cta: { borderRadius: RADII.lg, overflow: 'hidden', ...SHADOWS.floating },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  ctaText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});

export default AddPetScreen;
