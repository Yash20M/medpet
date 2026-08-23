import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { uploadsRouter, UPLOAD_DIR } from './modules/uploads';
import { resetPasswordPage, resetPasswordScript } from './shared/utils/resetPasswordPage';

// ─── Module imports ───────────────────────────────────────────────────────────
import { authRouter } from './modules/auth';
import { categoriesRouter } from './modules/categories';
import { productsRouter } from './modules/products';
import { offersRouter } from './modules/offers';
import { wishlistRouter } from './modules/wishlist';
import { cartRouter } from './modules/cart';
import { notificationsRouter } from './modules/notifications';
import { ordersRouter } from './modules/orders';
import { deliveryRouter } from './modules/delivery';
import { trackingOrderRouter, driversRouter } from './modules/tracking';
import { usersRouter } from './modules/users';
import { dashboardRouter } from './modules/dashboard';
import { petsRouter } from './modules/pets';
import { couponsRouter } from './modules/coupons';
import { supportRouter } from './modules/support';
import { contentRouter } from './modules/content';

dotenv.config();

const createApp = (): Application => {
  const app = express();

  // ─── Global middleware ───────────────────────────────────────────────────
  // Allow uploaded images to be loaded cross-origin (admin / app on other hosts).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: process.env.CLIENT_URL ?? '*', credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Static: uploaded product images ───────────────────────────────────────
  app.use('/uploads', express.static(UPLOAD_DIR));

  // ─── Password reset / set-password page (opened from invite & reset emails) ──
  // Script is served as a separate same-origin file so it satisfies helmet's CSP.
  app.get('/reset-password', (_req: Request, res: Response) => {
    res.type('html').send(resetPasswordPage());
  });
  app.get('/reset-password.js', (_req: Request, res: Response) => {
    res.type('application/javascript').send(resetPasswordScript());
  });

  // ─── Health check ────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'MedPet API is running.',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
    });
  });

  // ─── Module registry ─────────────────────────────────────────────────────
  app.use('/api/auth',          authRouter);
  app.use('/api/categories',    categoriesRouter);
  app.use('/api/products',      productsRouter);
  app.use('/api/offers',        offersRouter);
  app.use('/api/wishlist',      wishlistRouter);
  app.use('/api/cart',          cartRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/orders',        ordersRouter);
  app.use('/api/orders',        trackingOrderRouter); // dispatch / tracking / route / status
  app.use('/api/drivers',       driversRouter);
  app.use('/api/delivery',      deliveryRouter);
  app.use('/api/users',         usersRouter);
  app.use('/api/dashboard',     dashboardRouter);
  app.use('/api/pets',          petsRouter);
  app.use('/api/uploads',       uploadsRouter);
  app.use('/api/coupons',       couponsRouter);
  app.use('/api/support',       supportRouter);
  app.use('/api/content',       contentRouter);

  // ─── 404 ─────────────────────────────────────────────────────────────────
  app.use((req: Request, res: Response) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
  });

  // ─── Global error handler ────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  });

  return app;
};

export default createApp;
