import { Router } from 'express';
import { TrackingController } from './tracking.controller';
import { protect, adminOnly, deliveryOnly } from '../../shared/middleware/auth.middleware';

/**
 * Tracking sub-routes for an order. Mounted at /api/orders (after ordersRouter),
 * so it only handles the paths ordersRouter doesn't: dispatch/tracking/route/status.
 */
export const trackingOrderRouter = Router();
trackingOrderRouter.use(protect);
trackingOrderRouter.post('/:id/dispatch', adminOnly, TrackingController.dispatch);
trackingOrderRouter.get('/:id/tracking', TrackingController.getTracking);
trackingOrderRouter.get('/:id/route', TrackingController.getRoute);
trackingOrderRouter.post('/:id/status', TrackingController.setPhase);
trackingOrderRouter.post('/:id/ping', deliveryOnly, TrackingController.ping);

/** Mounted at /api/drivers. */
export const driversRouter = Router();
driversRouter.use(protect);
driversRouter.get('/active', adminOnly, TrackingController.activeDrivers);
driversRouter.get('/analytics', adminOnly, TrackingController.analytics);
