import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, adminOnly } from '../../shared/middleware/auth.middleware';
import { sendSuccess, sendError } from '../../shared/utils/response';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `prod_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files (png, jpg, webp, gif, avif) are allowed.'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// POST /api/uploads — multipart field "image". Returns an absolute URL.
router.post('/', protect, adminOnly, (req: Request, res: Response) => {
  upload.single('image')(req, res, (err: unknown) => {
    if (err) { sendError(res, (err as Error).message || 'Upload failed.', 400); return; }
    if (!req.file) { sendError(res, 'No file uploaded.', 400); return; }
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/${req.file.filename}`;
    sendSuccess(res, { message: 'Image uploaded.', data: { url } }, 201);
  });
});

export default router;
