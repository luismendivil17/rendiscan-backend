import jwt from 'jsonwebtoken';
import { q } from '../db/index.js'; 

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

export const requireRole = (...need) => {
  // Acepta tanto requireRole('admin','aprobador') como requireRole(['admin','aprobador'])
  const allowed = need
    .flatMap(r => Array.isArray(r) ? r : [r])
    .filter(Boolean)
    .map(r => String(r).trim().toLowerCase());

  return (req, res, next) => {
    const got = String(req.user?.rol ?? '').trim().toLowerCase();
    if (!allowed.includes(got)) {
      return res.status(403).json({
        error: 'Require rol',
        need: allowed,
        got,
        user: req.user?.id,
      });
    }
    next();
  };
};