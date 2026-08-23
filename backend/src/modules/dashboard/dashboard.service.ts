import db from '../../shared/config/database';

export interface DashboardSummary {
  total_users: number;
  total_orders: number;
  total_revenue: number;
  total_products: number;
  low_stock_count: number;
  orders_today: number;
  revenue_today: number;
  recent_orders: {
    id: number; user_name: string; status: string; total: number; created_at: Date;
  }[];
  top_products: { id: number; name: string; emoji: string; units_sold: number }[];
  orders_by_status: { status: string; count: number }[];
  revenue_series: { date: string; revenue: number; orders: number }[];
}

export const DashboardService = {
  async summary(): Promise<DashboardSummary> {
    const [
      usersRes, productsRes, lowStockRes, ordersAgg, todayAgg,
      recentRes, topRes, statusRes, seriesRes,
    ] = await Promise.all([
      db.query<{ count: string }>('SELECT COUNT(*)::int AS count FROM users'),
      db.query<{ count: string }>('SELECT COUNT(*)::int AS count FROM products WHERE is_active = true'),
      db.query<{ count: string }>(
        'SELECT COUNT(*)::int AS count FROM products WHERE is_active = true AND stock_quantity <= low_stock_threshold'
      ),
      db.query<{ count: string; total: string }>(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(total),0)::int AS total
         FROM orders WHERE status != 'cancelled'`
      ),
      db.query<{ count: string; total: string }>(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(total),0)::int AS total
         FROM orders WHERE status != 'cancelled' AND created_at >= CURRENT_DATE`
      ),
      db.query(
        `SELECT o.id, u.name AS user_name, o.status, o.total, o.created_at
         FROM orders o JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC LIMIT 8`
      ),
      db.query(
        `SELECT p.id, p.name, p.emoji, COALESCE(SUM(oi.quantity),0)::int AS units_sold
         FROM products p
         LEFT JOIN order_items oi ON oi.product_id = p.id
         GROUP BY p.id
         ORDER BY units_sold DESC
         LIMIT 5`
      ),
      db.query(
        `SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`
      ),
      db.query<{ date: string; revenue: string; orders: string }>(
        `SELECT
           TO_CHAR(day, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(o.total), 0)::int AS revenue,
           COUNT(o.id)::int AS orders
         FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS day
         LEFT JOIN orders o
           ON o.created_at::date = day AND o.status != 'cancelled'
         GROUP BY day
         ORDER BY day`
      ),
    ]);

    return {
      total_users: Number(usersRes.rows[0].count),
      total_orders: Number(ordersAgg.rows[0].count),
      total_revenue: Number(ordersAgg.rows[0].total),
      total_products: Number(productsRes.rows[0].count),
      low_stock_count: Number(lowStockRes.rows[0].count),
      orders_today: Number(todayAgg.rows[0].count),
      revenue_today: Number(todayAgg.rows[0].total),
      recent_orders: recentRes.rows as DashboardSummary['recent_orders'],
      top_products: topRes.rows as DashboardSummary['top_products'],
      orders_by_status: statusRes.rows as DashboardSummary['orders_by_status'],
      revenue_series: seriesRes.rows.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      })),
    };
  },
};
