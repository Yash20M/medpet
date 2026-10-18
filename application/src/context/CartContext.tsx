import React, {
  createContext, useContext, useState, useCallback, useMemo, ReactNode,
} from 'react';
import { Product, ProductVariant, CartItem, cartLineKey } from '../types/product.types';
import { addToCartFeedback } from '../utils/feedback';
import { couponAPI } from '../services/api';

const DELIVERY_FEE = 49;
const FREE_DELIVERY_OVER = 499;

export interface AppliedCoupon {
  code: string;
  title: string;
  discount: number;
  qualifyingProductIds: string[];
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  coupon: AppliedCoupon | null;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateQty: (id: string, delta: number, variantId?: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  const addItem = useCallback((product: Product, quantity = 1, variant?: ProductVariant) => {
    addToCartFeedback();
    setItems((prev) => {
      const key = cartLineKey(product.id, variant?.id);
      const existing = prev.find((i) => cartLineKey(i.product.id, i.variant?.id) === key);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + quantity } : i));
      }
      // Sized lines carry the chosen size's prices so totals/coupons need no special casing.
      const line = variant
        ? { ...product, price: variant.price, originalPrice: variant.originalPrice, stockQuantity: variant.stockQuantity }
        : product;
      return [...prev, { product: line, quantity, variant }];
    });
  }, []);

  const removeItem = useCallback((id: string, variantId?: string) => {
    const key = cartLineKey(id, variantId);
    setItems((prev) => prev.filter((i) => cartLineKey(i.product.id, i.variant?.id) !== key));
  }, []);

  const updateQty = useCallback((id: string, delta: number, variantId?: string) => {
    const key = cartLineKey(id, variantId);
    setItems((prev) =>
      prev
        .map((i) => (cartLineKey(i.product.id, i.variant?.id) === key ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  // Placing an order (or emptying the cart) invalidates whatever coupon was applied.
  const clearCart = useCallback(() => { setItems([]); setCoupon(null); }, []);

  const removeCoupon = useCallback(() => setCoupon(null), []);

  const applyCoupon = useCallback(async (code: string) => {
    const res = await couponAPI.validate(
      code.trim().toUpperCase(),
      items.map((i) => ({ productId: Number(i.product.id), variantId: i.variant ? Number(i.variant.id) : undefined, quantity: i.quantity }))
    );
    const { coupon: c, discount, qualifying_product_ids } = res.data;
    setCoupon({
      code: c.code,
      title: c.title,
      discount,
      qualifyingProductIds: qualifying_product_ids.map(String),
    });
  }, [items]);

  const { itemCount, subtotal, deliveryFee, discount, total } = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const sub = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    const delivery = sub === 0 || sub >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
    const disc = coupon?.discount ?? 0;
    return { itemCount: count, subtotal: sub, deliveryFee: delivery, discount: disc, total: Math.max(0, sub + delivery - disc) };
  }, [items, coupon]);

  return (
    <CartContext.Provider
      value={{
        items, itemCount, subtotal, deliveryFee, discount, total,
        coupon, applyCoupon, removeCoupon,
        addItem, removeItem, updateQty, clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
};
