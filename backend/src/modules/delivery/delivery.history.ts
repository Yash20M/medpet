import db from '../../shared/config/database';
import {
  DeliveryHistory, DeliveryHistoryQuery, DeliveryHistoryRow, DeliveryHistorySummary,
  DeliveryHistoryDay, DeliveryHistoryPartner,
} from './delivery.types';

/** Business timezone — day buckets / range edges are in IST, not the DB server's zone. */
const TZ = 'Asia/Kolkata';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

const todayIst = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const addDays = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const isRealDate = (ymd: string): boolean => {
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
};

/** Validate/normalise the range. Defaults to the last 30 days (IST), inclusive of today. */
export const resolveRange = (from?: string, to?: string): { from: string; to: string } => {
  const end = to || todayIst();
  const start = from || addDays(end, -(DEFAULT_RANGE_DAYS - 1));
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || !isRealDate(start) || !isRealDate(end)) {
    throw httpError('Dates must be valid and formatted as YYYY-MM-DD.', 400);
  }
  if (start > end) throw httpError('"from" date must not be after "to" date.', 400);
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) throw httpError(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`, 400);
  return { from: start, to: end };
};

const ACCEPTED_DAY = `(o.accepted_at AT TIME ZONE '${TZ}')::date`;

type PartnerAgg = { partner_id: number; partner_name: string; accepted: string; delivered: string; value: string };

/**
 * Deliveries a partner has ACCEPTED within a date range (inclusive, IST), newest first,
 * with totals and a per-day breakdown. `partnerId` null/undefined = every partner (admin view).
 */
export const getDeliveryHistory = async (q: DeliveryHistoryQuery): Promise<DeliveryHistory> => {
  const range = resolveRange(q.from, q.to);
  const limit = Math.min(Math.max(Math.floor(q.limit ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(Math.floor(q.page ?? 1) || 1, 1);

  const params: unknown[] = [range.from, range.to];
  let where = `o.delivery_partner_id IS NOT NULL AND o.accepted_at IS NOT NULL
               AND ${ACCEPTED_DAY} BETWEEN $1::date AND $2::date`;
  if (q.partnerId != null) {
    params.push(q.partnerId);
    where += ` AND o.delivery_partner_id = $${params.length}`;
  }

  const [sumRes, dayRes, listRes, partnerRes] = await Promise.all([
    db.query<{ accepted: string; delivered: string; active: string; total_value: string; delivered_value: string; cod_collected: string }>(
      `SELECT COUNT(*) AS accepted,
              COUNT(*) FILTER (WHERE o.status = 'delivered') AS delivered,
              COUNT(*) FILTER (WHERE o.status = 'shipped')   AS active,
              COALESCE(SUM(o.total), 0) AS total_value,
              COALESCE(SUM(o.total) FILTER (WHERE o.status = 'delivered'), 0) AS delivered_value,
              COALESCE(SUM(o.total) FILTER (WHERE o.status = 'delivered' AND o.payment_method = 'cod'), 0) AS cod_collected
       FROM orders o WHERE ${where}`,
      params
    ),
    db.query<{ day: string; accepted: string; delivered: string; value: string }>(
      `SELECT to_char(${ACCEPTED_DAY}, 'YYYY-MM-DD') AS day,
              COUNT(*) AS accepted,
              COUNT(*) FILTER (WHERE o.status = 'delivered') AS delivered,
              COALESCE(SUM(o.total) FILTER (WHERE o.status = 'delivered'), 0) AS value
       FROM orders o WHERE ${where}
       GROUP BY 1 ORDER BY 1 DESC`,
      params
    ),
    db.query<DeliveryHistoryRow>(
      `SELECT o.id, o.status, o.total, o.payment_method, o.address, o.accepted_at,
              CASE WHEN o.status = 'delivered' THEN COALESCE(o.tracking_delivered_at, o.updated_at) END AS delivered_at,
              u.name AS customer_name, dp.id AS partner_id, dp.name AS partner_name,
              (SELECT COALESCE(SUM(oi.quantity), 0)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       JOIN users u  ON u.id  = o.user_id
       JOIN users dp ON dp.id = o.delivery_partner_id
       WHERE ${where}
       ORDER BY o.accepted_at DESC, o.id DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    ),
    q.partnerId != null
      ? Promise.resolve({ rows: [] as PartnerAgg[] })
      : db.query<PartnerAgg>(
          `SELECT dp.id AS partner_id, dp.name AS partner_name,
                  COUNT(*) AS accepted,
                  COUNT(*) FILTER (WHERE o.status = 'delivered') AS delivered,
                  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'delivered'), 0) AS value
           FROM orders o JOIN users dp ON dp.id = o.delivery_partner_id
           WHERE ${where}
           GROUP BY dp.id, dp.name ORDER BY delivered DESC, accepted DESC`,
          params
        ),
  ]);

  const s = sumRes.rows[0];
  const summary: DeliveryHistorySummary = {
    accepted: Number(s.accepted),
    delivered: Number(s.delivered),
    active: Number(s.active),
    total_value: Number(s.total_value),
    delivered_value: Number(s.delivered_value),
    cod_collected: Number(s.cod_collected),
  };
  const daily: DeliveryHistoryDay[] = dayRes.rows.map((r) => ({
    date: r.day, accepted: Number(r.accepted), delivered: Number(r.delivered), value: Number(r.value),
  }));
  const by_partner: DeliveryHistoryPartner[] = partnerRes.rows.map((r) => ({
    partner_id: r.partner_id, partner_name: r.partner_name,
    accepted: Number(r.accepted), delivered: Number(r.delivered), value: Number(r.value),
  }));
  const orders: DeliveryHistoryRow[] = listRes.rows.map((r) => ({
    ...r, total: Number(r.total), item_count: Number(r.item_count),
  }));

  return {
    range,
    summary,
    daily,
    by_partner,
    orders,
    pagination: { page, limit, total: summary.accepted, total_pages: Math.max(Math.ceil(summary.accepted / limit), 1) },
  };
};
