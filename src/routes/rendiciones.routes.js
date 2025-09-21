import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { crearRendicion, listarMisRendiciones } from '../controllers/rendiciones.controller.js';
import facturaRoutes from './sub/facturas.upload.routes.js';
import * as ctrl from '../controllers/rendiciones.controller.js';

const router = Router();

router.post('/:id/enviar', ctrl.enviarRendicion);
router.post('/:id/aprobar', requireRole('aprobador','admin'), ctrl.aprobarRendicion);
router.post('/:id/rechazar', requireRole('aprobador','admin'), ctrl.rechazarRendicion);


router.use(requireAuth);
router.post('/', crearRendicion);
router.get('/', listarMisRendiciones);

router.use('/:rendicionId/factura', facturaRoutes);

export default router;
