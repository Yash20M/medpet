export type DiscountType = 'percent' | 'flat';
export type ConditionType = 'none' | 'first_order' | 'nth_order' | 'min_order_count';

export interface CouponRow {
  id: number;
  code: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_value: number;
  condition_type: ConditionType;
  condition_value: number | null;
  user_id: number | null;
  show_on_ui: boolean;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  valid_from: Date | null;
  valid_until: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Coupon extends CouponRow {
  category_ids: number[];
  product_ids: number[];
  redemption_count: number;
}

export interface CreateCouponDto {
  code: string;
  title: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_value?: number;
  condition_type?: ConditionType;
  condition_value?: number | null;
  user_id?: number | null;
  show_on_ui?: boolean;
  usage_limit?: number | null;
  per_user_limit?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
  category_ids?: number[];
  product_ids?: number[];
}

export type UpdateCouponDto = Partial<CreateCouponDto>;

export interface CartItemInput {
  productId: number;
  quantity: number;
}

export interface EligibilityResult {
  coupon: Coupon;
  discount: number;
  qualifying_product_ids: number[];
}
