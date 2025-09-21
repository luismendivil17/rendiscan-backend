import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { subirFactura } from '../../controllers/facturas.controller.js';

const upload = multer({
  dest: path.join(process.cwd(), 'src', 'storage', 'uploads')
});

const router = Router({ mergeParams: true });
router.post('/', upload.single('file'), subirFactura);

export default router;
