import { Request, Response } from 'express';
import { TrackingService } from './tracking.service';
import { LivePhase, PHASE_ORDER } from './tracking.types';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { emitToOrder, emitToAdmins } from '../../shared/realtime/io';
import { broadcastPing } from './broadcast';

const parseId = (req: Request): number => Number(req.params.id);

export const TrackingController = {
  /** POST /api/orders/:id/dispatch — assign driver, fetch + cache OSRM route. */
  async dispatch(req: Request, res: Response): Promise<void> {
    try {
      const { driverId, pickup, drop } = req.body ?? {};
      const state = await TrackingService.dispatch(parseId(req), { driverId, pickup, drop });

      // Announce the order is now trackable.
      const sc = { orderId: state.orderId, oldStatus: null, newStatus: state.phase, timestamp: Date.now() };
      emitToOrder(state.orderId, 'tracking:status-change', sc);
      emitToAdmins('tracking:status-change', sc);

      sendSuccess(res, { message: 'Order dispatched — route cached.', data: state });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      sendError(res, e.message, e.statusCode ?? 500);
    }
  },

  /** GET /api/orders/:id/tracking — full current state (socket-disconnect fallback). */
  async getTracking(req: Request, res: Response): Promise<void> {
    const orderId = parseId(req);
    if (!(await TrackingService.canView(orderId, req.user!.id, req.user!.role))) {
      sendError(res, 'Not allowed to view this order.', 403);
      return;
    }
    const state = await TrackingService.getTracking(orderId);
    if (!state) { sendError(res, 'Order not found.', 404); return; }
    sendSuccess(res, { message: 'Tracking state.', data: state });
  },

  /** GET /api/orders/:id/route — cached route polyline only. */
  async getRoute(req: Request, res: Response): Promise<void> {
    const orderId = parseId(req);
    if (!(await TrackingService.canView(orderId, req.user!.id, req.user!.role))) {
      sendError(res, 'Not allowed to view this order.', 403);
      return;
    }
    const route = await TrackingService.getRoute(orderId);
    if (!route) { sendError(res, 'No route cached for this order yet.', 404); return; }
    sendSuccess(res, { message: 'Cached route.', data: route });
  },

  /** POST /api/orders/:id/status — manual phase override (admin or assigned driver). */
  async setPhase(req: Request, res: Response): Promise<void> {
    const orderId = parseId(req);
    const phase = (req.body?.phase ?? req.body?.status) as LivePhase;
    if (!PHASE_ORDER.includes(phase)) {
      sendError(res, `Invalid phase. Expected one of: ${PHASE_ORDER.join(', ')}.`, 400);
      return;
    }
    // Only admin or the assigned driver may push a manual phase.
    const canView = await TrackingService.canView(orderId, req.user!.id, req.user!.role);
    if (req.user!.role === 'customer' || !canView) {
      sendError(res, 'Not allowed to update this order.', 403);
      return;
    }

    const result = await TrackingService.setPhase(orderId, phase);
    if (!result) { sendError(res, 'Order not found.', 404); return; }

    const sc = { orderId, oldStatus: result.oldPhase, newStatus: phase, timestamp: Date.now() };
    emitToOrder(orderId, 'tracking:status-change', sc);
    emitToAdmins('tracking:status-change', sc);

    sendSuccess(res, { message: 'Phase updated.', data: result.state });
  },

  /**
   * POST /api/orders/:id/ping — REST GPS ping (assigned driver). Used by the
   * background-location task, which runs headless and can't reach the socket,
   * and as a fallback when the driver's socket won't connect. Runs the same
   * pipeline as the socket path and broadcasts the result.
   */
  async ping(req: Request, res: Response): Promise<void> {
    const orderId = parseId(req);
    const { lat, lng, heading, speed, timestamp } = req.body ?? {};
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      sendError(res, 'lat and lng (numbers) are required.', 400);
      return;
    }
    const result = await TrackingService.processPing({
      orderId, driverId: req.user!.id, lat, lng, heading, speed, timestamp,
    });
    if (!result.processed) {
      sendSuccess(res, { message: `Ping skipped (${result.reason}).`, data: { processed: false, reason: result.reason } });
      return;
    }
    broadcastPing(orderId, result);
    sendSuccess(res, { message: 'Ping processed.', data: { processed: true, broadcast: result.broadcast } });
  },

  /** GET /api/drivers/active — all live deliveries for the admin map. */
  async activeDrivers(_req: Request, res: Response): Promise<void> {
    const data = await TrackingService.listActiveDrivers();
    sendSuccess(res, { message: 'Active drivers.', data });
  },

  /** GET /api/drivers/analytics — delivery analytics for the admin dashboard. */
  async analytics(_req: Request, res: Response): Promise<void> {
    const data = await TrackingService.getAnalytics();
    sendSuccess(res, { message: 'Delivery analytics.', data });
  },
};
