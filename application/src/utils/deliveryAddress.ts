import * as SecureStore from 'expo-secure-store';
import type { PaymentMethod } from '../services/api';

const KEY = 'lastDeliveryAddress';

export interface SavedDeliveryAddress {
  fullName: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  paymentMethod: PaymentMethod;
}

export const saveDeliveryAddress = (data: SavedDeliveryAddress): Promise<void> =>
  SecureStore.setItemAsync(KEY, JSON.stringify(data));

export const loadDeliveryAddress = async (): Promise<SavedDeliveryAddress | null> => {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedDeliveryAddress;
  } catch {
    return null;
  }
};
