import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePets } from '../context/PetsContext';
import { PetCard, AddPetPrompt } from '../components/PetCard';
import { COLORS, GRADIENTS, RADII } from '../theme/colors';
import { RootStackParamList } from '../types/navigation.types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'MyPets'> };

const MyPetsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { pets, removePet } = usePets();

  const confirmDelete = (id: number, name: string) =>
    Alert.alert('Remove pet', `Remove ${name} from your pets?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePet(id) },
    ]);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <LinearGradient colors={GRADIENTS.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Pets</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.headerSub}>{pets.length} {pets.length === 1 ? 'companion' : 'companions'}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AddPetPrompt onPress={() => navigation.navigate('AddPet')} />

        <View style={{ height: 16 }} />

        {pets.map((pet) => (
          <View key={pet.id} style={styles.petRow}>
            <View style={{ flex: 1 }}>
              <PetCard pet={pet} />
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(pet.id, pet.name)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.errorDark} />
            </TouchableOpacity>
          </View>
        ))}

        {pets.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🐾</Text>
            <Text style={styles.emptyTitle}>No pets yet</Text>
            <Text style={styles.emptySub}>Add your first pet to unlock tailored care.</Text>
          </View>
        )}
      </ScrollView>
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
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  deleteBtn: {
    width: 44, height: 44, borderRadius: RADII.md, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.grayBorder,
  },
  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, marginTop: 6, textAlign: 'center' },
});

export default MyPetsScreen;
