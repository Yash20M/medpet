import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  emoji: string;
  imageUrl?: string | null;
  rating: string;
  reviews: string;
  category: string;
  description: string;
  inStock: boolean;
  stockQuantity?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

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
