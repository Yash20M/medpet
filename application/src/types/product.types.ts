import React from 'react';
import { Ionicons } from '@expo/vector-icons';

/** One pack size of a product (10kg, 20kg…) with its own price and stock. */
export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  originalPrice: number;
  stockQuantity: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  emoji: string;
  imageUrl?: string | null;
  /** Gallery (max 5), first = imageUrl. Empty = just imageUrl. */
  imageUrls?: string[];
  /** Admin-entered free text for the product page's collapsible sections. */
  manufacturerDetails?: string;
  ingredients?: string;
  uses?: string;
  rating: string;
  reviews: string;
  category: string;
  description: string;
  inStock: boolean;
  stockQuantity?: number;
  /** Flagged "Featured" by the admin — shown as a label on the product screen. */
  isFeatured?: boolean;
  /** Pet accessory (collar, toy, bed…) — shown in the Accessories section. */
  /** Review count as a number (the `reviews` string is display-formatted, e.g. 2.3k). */
  reviewsCount?: number;
  /** ISO timestamp the product was added; drives What's New. */
  createdAt?: string;
  isAccessory?: boolean;
  /** Pet types an accessory suits (dog, cat…); empty = every pet. */
  petTypes?: string[];
  /** Size options; empty/absent = single-size product. */
  variants?: ProductVariant[];
}

export interface CartItem {
  /** For a sized line, `price`/`originalPrice` already hold the chosen size's prices. */
  product: Product;
  quantity: number;
  variant?: ProductVariant;
}

/** Identifies a cart line: the same product in two sizes is two lines. */
export const cartLineKey = (productId: string, variantId?: string | null): string =>
  variantId ? `${productId}:${variantId}` : productId;

export interface Category {
  id: string;
  icon: string;
  imageUrl?: string | null;
  label: string;
  color: string;
  iconBg: string;
  parentId?: number | null;
}

export interface QuickLink {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  bg: string;
}

export const formatPrice = (n: number): string => `₹${n.toLocaleString('en-IN')}`;
