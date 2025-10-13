import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/roles.middleware.js';
import {  crearUsuario,  listarUsuarios,  actualizarAreaYRol,  me,actualizarUsuario,obtenerUsuarioPorId} from '../controllers/usuarios.controller.js';
const router = Router();

router.use(requireAuth);

router.get('/me', me);

router.get('/', requireRole('admin'), listarUsuarios);
router.post('/', requireRole('admin'), crearUsuario);
router.patch('/:id', requireRole('admin'), actualizarAreaYRol);
router.put('/:id', requireAuth, requireRole('admin'), actualizarUsuario);
router.get('/:id',obtenerUsuarioPorId);



export default router;
