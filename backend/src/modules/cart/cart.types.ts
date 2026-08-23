import { Product } from '../products/products.types';

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface Cart {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
}

export interface AddToCartDto {
  productId: number;
  quantity?: number;
}
