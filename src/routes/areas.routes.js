import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import * as ctrl from '../controllers/areas.controller.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.post('/', ctrl.crearArea);                 
router.get('/', ctrl.listarAreas);                
router.put('/:id/jefe', ctrl.asignarJefeArea);    
export default router;
