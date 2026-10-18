export interface DeliverySummary {
  /** Confirmed orders waiting to be accepted by any partner. */
  available: number;
  /** Orders this partner has accepted and not yet delivered. */
  active: number;
  completed_today: number;
  completed_total: number;
}

export interface DeliveryHistoryQuery {
  /** YYYY-MM-DD (IST), inclusive. Defaults to 29 days before `to`. */
  from?: string;
  /** YYYY-MM-DD (IST), inclusive. Defaults to today. */
  to?: string;
  /** Restrict to one partner; omit for all partners (admin). */
  partnerId?: number | null;
  page?: number;
  limit?: number;
}

export interface DeliveryHistoryRow {
  id: number;
  status: string;
  total: number;
  payment_method: string;
  address: string;
  accepted_at: Date;
  delivered_at: Date | null;
  customer_name: string;
  partner_id: number;
  partner_name: string;
  item_count: number;
}

export interface DeliveryHistorySummary {
  accepted: number;
  delivered: number;
  /** Accepted but still out for delivery. */
  active: number;
  total_value: number;
  delivered_value: number;
  /** Cash-on-delivery value of delivered orders. */
  cod_collected: number;
}

export interface DeliveryHistoryDay { date: string; accepted: number; delivered: number; value: number; }
export interface DeliveryHistoryPartner { partner_id: number; partner_name: string; accepted: number; delivered: number; value: number; }

export interface DeliveryHistory {
  range: { from: string; to: string };
  summary: DeliveryHistorySummary;
  daily: DeliveryHistoryDay[];
  /** Only populated for the all-partners (admin) view. */
  by_partner: DeliveryHistoryPartner[];
  orders: DeliveryHistoryRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}
