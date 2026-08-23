import { emitToOrder, emitToAdmins } from '../../shared/realtime/io';
import { PingResult } from './tracking.types';

/**
 * Fan a processed ping out to the order room + admin firehose. Shared by the
 * Socket.IO handler and the REST ping endpoint so both behave identically.
 */
export const broadcastPing = (orderId: number, result: PingResult): void => {
  if (!result.processed || !result.broadcast) return;
  const b = result.broadcast;

  emitToOrder(orderId, 'tracking:location', b);
  emitToAdmins('tracking:location', b);
  emitToOrder(orderId, 'tracking:eta-update', {
    orderId, etaMinutes: b.eta, distanceRemainingKm: b.distanceRemaining,
  });

  if (result.statusChange) {
    const sc = {
      orderId,
      oldStatus: result.statusChange.oldPhase,
      newStatus: result.statusChange.newPhase,
      timestamp: b.timestamp,
    };
    emitToOrder(orderId, 'tracking:status-change', sc);
    emitToAdmins('tracking:status-change', sc);
  }
};
