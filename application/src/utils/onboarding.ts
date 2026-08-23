import * as SecureStore from 'expo-secure-store';

const KEY = 'hasOnboarded';

export const getHasOnboarded = async (): Promise<boolean> => {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
};

export const setHasOnboarded = (): Promise<void> => SecureStore.setItemAsync(KEY, '1');
