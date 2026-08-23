import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { wishlistAPI } from '../services/api';
import { mapProduct } from '../hooks/useCatalog';
import { Product } from '../types/product.types';

interface WishlistContextValue {
  items: Product[];
  ids: Set<string>;
  isWishlisted: (productId: string) => boolean;
  toggle: (product: Product) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Product[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await wishlistAPI.list();
      setItems(res.data.map(mapProduct));
    } catch {
      /* leave state as-is — backend unreachable */
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setItems([]);
  }, [isAuthenticated, refresh]);

  const isWishlisted = useCallback(
    (productId: string) => items.some((p) => p.id === productId),
    [items]
  );

  const toggle = useCallback(async (product: Product) => {
    const already = items.some((p) => p.id === product.id);
    // Optimistic update — instant heart feedback.
    setItems((prev) => (already ? prev.filter((p) => p.id !== product.id) : [product, ...prev]));
    try {
      if (already) await wishlistAPI.remove(Number(product.id));
      else await wishlistAPI.add(Number(product.id));
    } catch {
      // revert on failure
      setItems((prev) => (already ? [product, ...prev] : prev.filter((p) => p.id !== product.id)));
    }
  }, [items]);

  const ids = new Set(items.map((p) => p.id));

  return (
    <WishlistContext.Provider value={{ items, ids, isWishlisted, toggle, refresh }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextValue => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within <WishlistProvider>');
  return ctx;
};
