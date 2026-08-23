import { QueryResult, QueryResultRow } from 'pg';
import db from '../../shared/config/database';
import {
  Coupon, CouponRow, CreateCouponDto, UpdateCouponDto, CartItemInput, EligibilityResult,
} from './coupons.types';

/** Satisfied by both the plain pool (`db`) and a transaction `PoolClient`, so
 *  eligibility checks can run standalone or inside an order's transaction. */
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

const fail = (message: string, statusCode: number): never => {
  throw Object.assign(new Error(message), { statusCode });
};

const getCouponWithJoins = async (executor: Queryable, id: number): Promise<Coupon | null> => {
  const { rows } = await executor.query<CouponRow>(`SELECT * FROM coupons WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const [catRes, prodRes, redRes] = await Promise.all([
    executor.query<{ category_id: number }>(`SELECT category_id FROM coupon_categories WHERE coupon_id = $1`, [id]),
    executor.query<{ product_id: number }>(`SELECT product_id FROM coupon_products WHERE coupon_id = $1`, [id]),
    executor.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id = $1`, [id]),
  ]);
  return {
    ...rows[0],
    category_ids: catRes.rows.map((c) => c.category_id),
    product_ids: prodRes.rows.map((p) => p.product_id),
    redemption_count: Number(redRes.rows[0]?.count ?? 0),
  };
};

const getCouponByCode = async (executor: Queryable, code: string): Promise<Coupon | null> => {
  const { rows } = await executor.query<{ id: number }>(
    `SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)`,
    [code]
  );
  if (!rows[0]) return null;
  return getCouponWithJoins(executor, rows[0].id);
};

const attachJoinsForList = async (rows: CouponRow[]): Promise<Coupon[]> => {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [catRes, prodRes, redRes] = await Promise.all([
    db.query<{ coupon_id: number; category_id: number }>(
      `SELECT coupon_id, category_id FROM coupon_categories WHERE coupon_id = ANY($1)`, [ids]
    ),
    db.query<{ coupon_id: number; product_id: number }>(
      `SELECT coupon_id, product_id FROM coupon_products WHERE coupon_id = ANY($1)`, [ids]
    ),
    db.query<{ coupon_id: number; count: string }>(
      `SELECT coupon_id, COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id = ANY($1) GROUP BY coupon_id`, [ids]
    ),
  ]);
  return rows.map((r) => ({
    ...r,
    category_ids: catRes.rows.filter((c) => c.coupon_id === r.id).map((c) => c.category_id),
    product_ids: prodRes.rows.filter((p) => p.coupon_id === r.id).map((p) => p.product_id),
    redemption_count: Number(redRes.rows.find((x) => x.coupon_id === r.id)?.count ?? 0),
  }));
};

const syncJoinTables = async (
  executor: Queryable, couponId: number, categoryIds: number[], productIds: number[]
): Promise<void> => {
  await executor.query(`DELETE FROM coupon_categories WHERE coupon_id = $1`, [couponId]);
  await executor.query(`DELETE FROM coupon_products WHERE coupon_id = $1`, [couponId]);
  for (const categoryId of categoryIds) {
    await executor.query(`INSERT INTO coupon_categories (coupon_id, category_id) VALUES ($1,$2)`, [couponId, categoryId]);
  }
  for (const productId of productIds) {
    await executor.query(`INSERT INTO coupon_products (coupon_id, product_id) VALUES ($1,$2)`, [couponId, productId]);
  }
};

/** Core eligibility + discount calculator, shared by validate/eligible/checkout. */
const evaluateCoupon = async (
  executor: Queryable, userId: number, coupon: Coupon, items: CartItemInput[]
): Promise<EligibilityResult> => {
  if (!coupon.is_active) fail('This coupon is no longer available.', 404);

  const now = new Date();
  if (coupon.valid_from && now < new Date(coupon.valid_from)) fail('This coupon is not active yet.', 400);
  if (coupon.valid_until && now > new Date(coupon.valid_until)) fail('This coupon has expired.', 400);

  if (coupon.user_id != null && coupon.user_id !== userId) {
    fail('This coupon is not available for your account.', 403);
  }

  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    fail('This coupon has been fully redeemed.', 409);
  }

  const { rows: redemptionRows } = await executor.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2`,
    [coupon.id, userId]
  );
  if (Number(redemptionRows[0].count) >= coupon.per_user_limit) {
    fail("You've already used this coupon.", 409);
  }

  if (!items.length) fail('Your cart is empty.', 400);

  const productIds = items.map((i) => i.productId);
  const { rows: products } = await executor.query<{ id: number; category_id: number | null; discount_price: number }>(
    `SELECT id, category_id, discount_price FROM products WHERE id = ANY($1) AND is_active = true`,
    [productIds]
  );
  const productMap = new Map(products.map((p) => [p.id, p]));

  const hasRestrictions = coupon.category_ids.length > 0 || coupon.product_ids.length > 0;
  const qualifyingProductIds: number[] = [];
  let qualifyingSubtotal = 0;

  for (const item of items) {
    const p = productMap.get(item.productId);
    if (!p) continue;
    const qualifies = !hasRestrictions
      || coupon.product_ids.includes(p.id)
      || (p.category_id != null && coupon.category_ids.includes(p.category_id));
    if (qualifies) {
      qualifyingProductIds.push(p.id);
      qualifyingSubtotal += p.discount_price * Math.max(1, item.quantity);
    }
  }

  if (hasRestrictions && qualifyingProductIds.length === 0) {
    fail("This coupon doesn't apply to any items in your cart.", 400);
  }
  if (qualifyingSubtotal === 0) fail('Your cart is empty.', 400);
  if (qualifyingSubtotal < coupon.min_order_value) {
    fail(`Minimum order value of ₹${coupon.min_order_value} not met for this coupon.`, 400);
  }

  if (coupon.condition_type !== 'none') {
    const { rows: countRows } = await executor.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1 AND status != 'cancelled'`,
      [userId]
    );
    const pastOrders = Number(countRows[0].count);
    const n = coupon.condition_value ?? 0;
    if (coupon.condition_type === 'first_order' && pastOrders !== 0) {
      fail('This coupon is valid only on your first order.', 400);
    }
    if (coupon.condition_type === 'nth_order' && pastOrders !== n - 1) {
      fail(`This coupon is valid only on your order #${n}.`, 400);
    }
    if (coupon.condition_type === 'min_order_count' && pastOrders < n) {
      fail(`This coupon unlocks after ${n} orders.`, 400);
    }
  }

  let discount: number;
  if (coupon.discount_type === 'percent') {
    const raw = Math.round((qualifyingSubtotal * Number(coupon.discount_value)) / 100);
    discount = coupon.max_discount_amount != null ? Math.min(raw, coupon.max_discount_amount) : raw;
  } else {
    discount = Math.min(Math.round(Number(coupon.discount_value)), qualifyingSubtotal);
  }

  return { coupon, discount, qualifying_product_ids: qualifyingProductIds };
};

export const CouponsService = {
  async list(): Promise<Coupon[]> {
    const { rows } = await db.query<CouponRow>(`SELECT * FROM coupons ORDER BY created_at DESC`);
    return attachJoinsForList(rows);
  },

  async getById(id: number): Promise<Coupon | null> {
    return getCouponWithJoins(db, id);
  },

  async create(dto: CreateCouponDto): Promise<Coupon> {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO coupons
           (code, title, description, discount_type, discount_value, max_discount_amount,
            min_order_value, condition_type, condition_value, user_id, show_on_ui,
            usage_limit, per_user_limit, valid_from, valid_until, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,0),COALESCE($8,'none'),$9,$10,COALESCE($11,true),
                 $12,COALESCE($13,1),$14,$15,COALESCE($16,true))
         RETURNING id`,
        [
          dto.code.trim().toUpperCase(), dto.title.trim(), dto.description ?? '',
          dto.discount_type, dto.discount_value, dto.max_discount_amount ?? null,
          dto.min_order_value ?? null, dto.condition_type ?? null, dto.condition_value ?? null,
          dto.user_id ?? null, dto.show_on_ui ?? null, dto.usage_limit ?? null,
          dto.per_user_limit ?? null, dto.valid_from ?? null, dto.valid_until ?? null, dto.is_active ?? null,
        ]
      );
      const id = rows[0].id;
      await syncJoinTables(client, id, dto.category_ids ?? [], dto.product_ids ?? []);
      await client.query('COMMIT');
      return (await getCouponWithJoins(db, id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id: number, dto: UpdateCouponDto): Promise<Coupon | null> {
    const existing = await getCouponWithJoins(db, id);
    if (!existing) return null;
    // Full merge (not COALESCE) so an explicit `null` in the request really
    // clears a nullable field — the admin form always submits full state.
    const merged = { ...existing, ...dto };

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE coupons SET
           code = $1, title = $2, description = $3, discount_type = $4, discount_value = $5,
           max_discount_amount = $6, min_order_value = $7, condition_type = $8, condition_value = $9,
           user_id = $10, show_on_ui = $11, usage_limit = $12, per_user_limit = $13,
           valid_from = $14, valid_until = $15, is_active = $16
         WHERE id = $17`,
        [
          merged.code.trim().toUpperCase(), merged.title.trim(), merged.description ?? '',
          merged.discount_type, merged.discount_value, merged.max_discount_amount ?? null,
          merged.min_order_value ?? 0, merged.condition_type ?? 'none', merged.condition_value ?? null,
          merged.user_id ?? null, merged.show_on_ui, merged.usage_limit ?? null, merged.per_user_limit,
          merged.valid_from ?? null, merged.valid_until ?? null, merged.is_active, id,
        ]
      );
      if (dto.category_ids !== undefined || dto.product_ids !== undefined) {
        await syncJoinTables(
          client, id,
          dto.category_ids ?? existing.category_ids,
          dto.product_ids ?? existing.product_ids
        );
      }
      await client.query('COMMIT');
      return getCouponWithJoins(db, id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async remove(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM coupons WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  /** Validates a manually-entered code. Throws on any ineligibility. */
  async checkEligibility(
    executor: Queryable, userId: number, code: string, items: CartItemInput[]
  ): Promise<EligibilityResult> {
    const coupon = await getCouponByCode(executor, code);
    if (!coupon) fail('Invalid coupon code.', 404);
    return evaluateCoupon(executor, userId, coupon!, items);
  },

  /** Coupons the user can see/apply right now (show_on_ui + currently eligible). */
  async listEligible(executor: Queryable, userId: number, items: CartItemInput[]): Promise<EligibilityResult[]> {
    const { rows } = await executor.query<{ id: number }>(
      `SELECT id FROM coupons
       WHERE is_active = true AND show_on_ui = true
         AND (user_id IS NULL OR user_id = $1)
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until >= NOW())`,
      [userId]
    );

    const results: EligibilityResult[] = [];
    for (const row of rows) {
      const coupon = await getCouponWithJoins(executor, row.id);
      if (!coupon) continue;
      try {
        results.push(await evaluateCoupon(executor, userId, coupon, items));
      } catch {
        // Not eligible right now (e.g. min order value, restricted items) — omit silently.
      }
    }
    return results;
  },
};
