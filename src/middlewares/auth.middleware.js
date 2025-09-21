import jwt from 'jsonwebtoken';
import { q } from '../db/index.js'; // ajusta a tu acceso a BD
// Suponiendo tabla "usuarios" con columnas: id, nombre, email, rol, area_id, creado_en

export const requireAuth = async (req, res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const [type, token] = hdr.split(' ');
    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Falta token Bearer' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.id || payload.uid;
    const { rows } = await q(
      'SELECT id, nombre, email, rol, area_id, creado_en FROM usuarios WHERE id = $1 LIMIT 1',
      [userId]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuario inválido' });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido', detail: String(e) });
  }
};