import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { listarFacturas, obtenerFactura, totalesPorRendicion} from '../controllers/facturas.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireAuth, listarFacturas);
router.get('/totales', requireAuth, totalesPorRendicion);
router.get('/:id', obtenerFactura);

export default router;   
