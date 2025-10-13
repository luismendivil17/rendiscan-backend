// src/routes/areas.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import {
  listarAreas,
  crearArea,
  asignarJefeArea,
  miArea,
  miembrosDeMiArea,
  miembrosPorArea
} from '../controllers/areas.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/mia',  requireRole('solicitante','aprobador','admin'),  miArea);

router.get('/mia/miembros',
  requireRole('solicitante','aprobador','admin'),  miembrosDeMiArea);

router.post('/',  requireRole('admin'), crearArea);
router.get('/',  requireRole('admin'),  listarAreas);
router.put('/:id/jefe',  requireRole('admin'),  asignarJefeArea);
router.get('/:id/miembros',  requireRole('admin'),  miembrosPorArea);

export default router;
