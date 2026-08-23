export interface DeliverySummary {
  /** Confirmed orders waiting to be accepted by any partner. */
  available: number;
  /** Orders this partner has accepted and not yet delivered. */
  active: number;
  completed_today: number;
  completed_total: number;
}
