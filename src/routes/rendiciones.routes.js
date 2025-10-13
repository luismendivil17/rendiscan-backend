import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import { validate as uuidValidate } from 'uuid';

import {
  crearRendicion,
  listarMisRendiciones,
  listarPorAprobador,
  enviarRendicion,
  aprobarRendicion,
  rechazarRendicion,
  listarPendientes,
  stats as getStats,     
  obtenerRendicion,
} from '../controllers/rendiciones.controller.js';

import {
  listarFacturasPorRendicion,
  listarFacturas,
  obtenerFactura,
  actualizarFactura,
} from '../controllers/facturas.controller.js';

import facturaRoutes from './sub/facturas.upload.routes.js';

const router = Router();
router.use(requireAuth);
router.get('/stats', getStats); 
router.get('/pendientes', requireRole(['aprobador', 'admin']), listarPendientes);
router.get('/aprobar', listarPorAprobador);
router.post('/', crearRendicion);
router.get('/', listarMisRendiciones);
router.get('/facturas', listarFacturas);           
router.get('/facturas/:id', obtenerFactura);    
router.put('/facturas/:id', actualizarFactura);
router.get('/:id/facturas', listarFacturasPorRendicion);
router.use('/:rendicionId/factura', facturaRoutes);
router.param('id', (req, res, next, val) => {
  if (!uuidValidate(val)) {
    return res.status(400).json({ error: 'id inválido: debe ser UUID' });
  }
  next();
});

router.post('/:id/enviar', enviarRendicion);
router.post('/:id/aprobar', requireRole('aprobador','admin'), aprobarRendicion);
router.post('/:id/rechazar', requireRole('aprobador','admin'), rechazarRendicion);

router.get('/:id', obtenerRendicion);

export default router;
