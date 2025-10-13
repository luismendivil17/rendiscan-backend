import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { subirFactura } from '../../controllers/facturas.controller.js';

const uploadDir = path.join(process.cwd(), 'src', 'storage', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const unique = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}_${unique}${ext}`);
  },
});

const allowedMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
]);
const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function fileFilter(_req, file, cb) {
  const okByMime = allowedMimes.has(file.mimetype);
  const okByExt = allowedExts.has((path.extname(file.originalname) || '').toLowerCase());

  if (okByMime || (file.mimetype === 'application/octet-stream' && okByExt)) {
    return cb(null, true);
  }
  return cb(new Error('FORMATO_NO_PERMITIDO'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

const router = Router({ mergeParams: true });

router.post('/upload', upload.single('file'), subirFactura);

export default router;
