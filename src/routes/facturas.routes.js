import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  listarFacturas,
  obtenerFactura,
  actualizarFactura,
} from '../controllers/facturas.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', listarFacturas);        
router.get('/:id', obtenerFactura);     
router.put('/:id', actualizarFactura);  

export default router;
