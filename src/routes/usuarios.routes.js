import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { me } from '../controllers/usuarios.controller.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import * as ctrl from '../controllers/usuarios.controller.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', ctrl.listarUsuarios);              
router.get('/me', requireAuth, me);
router.put('/:id/area', ctrl.actualizarAreaYRol);  
export default router;
