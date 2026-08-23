import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { petAPI } from '../services/api';
import { Pet, PetDraft } from '../types/pet.types';

interface PetsContextValue {
  pets: Pet[];
  primaryPet: Pet | null;
  isLoading: boolean;
  /** True once the first fetch for the signed-in user has completed. */
  loaded: boolean;
  hasPets: boolean;
  refresh: () => Promise<void>;
  addPet: (draft: PetDraft) => Promise<Pet>;
  updatePet: (id: number, draft: Partial<PetDraft>) => Promise<void>;
  removePet: (id: number) => Promise<void>;
}

const PetsContext = createContext<PetsContextValue | null>(null);

export const PetsProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await petAPI.list();
      setPets(res.data as unknown as Pet[]);
    } catch {
      /* backend unreachable — keep current state */
    } finally {
      setIsLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setPets([]);
      setLoaded(false);
    }
  }, [isAuthenticated, refresh]);

  const addPet = useCallback(async (draft: PetDraft): Promise<Pet> => {
    const res = await petAPI.create(draft);
    const pet = res.data as unknown as Pet;
    setPets((prev) => [...prev, pet]);
    return pet;
  }, []);

  const updatePet = useCallback(async (id: number, draft: Partial<PetDraft>) => {
    const res = await petAPI.update(id, draft);
    const pet = res.data as unknown as Pet;
    setPets((prev) => prev.map((p) => (p.id === id ? pet : p)));
  }, []);

  const removePet = useCallback(async (id: number) => {
    setPets((prev) => prev.filter((p) => p.id !== id)); // optimistic
    try {
      await petAPI.remove(id);
    } catch {
      refresh();
    }
  }, [refresh]);

  return (
    <PetsContext.Provider
      value={{
        pets,
        primaryPet: pets[0] ?? null,
        isLoading,
        loaded,
        hasPets: pets.length > 0,
        refresh,
        addPet,
        updatePet,
        removePet,
      }}
    >
      {children}
    </PetsContext.Provider>
  );
};

export const usePets = (): PetsContextValue => {
  const ctx = useContext(PetsContext);
  if (!ctx) throw new Error('usePets must be used within <PetsProvider>');
  return ctx;
};
