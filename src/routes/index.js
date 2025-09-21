import { Router } from 'express';
import authRoutes from './auth.routes.js';
import rendicionesRoutes from './rendiciones.routes.js';
import facturasRoutes from './facturas.routes.js';
import areasRoutes from './areas.routes.js';
import usuariosRoutes from './usuarios.routes.js';

const router = Router();
router.use('/auth', authRoutes);
router.use('/rendiciones', rendicionesRoutes);
router.use('/facturas', facturasRoutes);
router.use('/areas', areasRoutes);
router.use('/usuarios', usuariosRoutes);



export default router;