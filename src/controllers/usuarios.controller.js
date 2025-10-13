import { q } from '../db/index.js';
import bcrypt from 'bcryptjs';
import { obtenerUsuarioPorId as getById } from '../services/usuarios.service.js';


export async function crearUsuario(req, res, next) {
  try {
    const { nombre, email, password, rol, area_id } = req.body || {};

    if (!nombre || !nombre.toString().trim()) {
      return res.status(400).json({ error: 'NOMBRE_REQUIRED' });
    }
    if (!email || !email.toString().trim()) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED' });
    }
    if (!password || password.toString().length < 6) {
      return res.status(400).json({ error: 'PASSWORD_MIN_6' });
    }

    const emailLower = email.toString().trim().toLowerCase();
    const rolFinal = (rol || 'solicitante').toString();

    if (rolFinal === 'admin') {
      const { rows: admins } = await q(
        `SELECT COUNT(*)::int AS c FROM usuarios WHERE rol = 'admin'`
      );
      if (admins[0].c >= 1) {
        return res.status(400).json({ error: 'UNICO_ADMIN' });
      }
    }

    let areaId = area_id ?? null;
    if (typeof areaId === 'string' && areaId.trim() === '') areaId = null;

    if (areaId) {
      const { rows: a } = await q(`SELECT id FROM areas WHERE id=$1`, [areaId]);
      if (a.length === 0) {
        return res.status(400).json({ error: 'AREA_NOT_FOUND' });
      }
    }

   
    const hash = await bcrypt.hash(password.toString(), 10);

    const { rows } = await q(
      `INSERT INTO usuarios (nombre, email, password, rol, area_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, rol, area_id, creado_en`,
      [nombre.toString().trim(), emailLower, hash, rolFinal, areaId]
    );

    return res.status(201).json({ data: rows[0] });
  } catch (e) {
    if (e.code === '23505') { 
      return res.status(409).json({ error: 'EMAIL_DUPLICADO' });
    }
    next(e);
  }
}


export async function listarUsuarios(req, res, next) {
  try {
    const qText = (req.query.q || '').toString().trim();
    const rol = (req.query.rol || '').toString().trim();
    const candidatos = (req.query.candidatos || '').toString() === 'true';

    const params = [];
    let whereParts = [];

    if (qText) {
      params.push(`%${qText}%`);
      whereParts.push(`(u.nombre ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (rol) {
      params.push(rol);
      whereParts.push(`u.rol = $${params.length}`);
    }
    if (candidatos) {
      whereParts.push(`u.rol <> 'admin'`);
      whereParts.push(`NOT EXISTS (SELECT 1 FROM areas a WHERE a.jefe_usuario_id = u.id)`);
    }

    const whereSQL = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const sql = `
      SELECT u.id, u.nombre, u.email, u.rol, u.area_id,
             a.nombre AS area
        FROM usuarios u
   LEFT JOIN areas a ON a.id = u.area_id
      ${whereSQL}
    ORDER BY u.creado_en DESC
    `;

    const { rows } = await q(sql, params);
    res.json({ data: rows });
  } catch (e) { next(e); }
}


export async function actualizarAreaYRol(req, res, next) {
  try {
    const { id } = req.params;
    const { area_id, rol } = req.body || {};

    if (rol === 'admin') {
      const { rows: admins } = await q(
        `SELECT id FROM usuarios WHERE rol = 'admin' AND id <> $1`,
        [id]
      );
      if (admins.length > 0) {
        return res.status(400).json({ error: 'UNICO_ADMIN' });
      }
    }

    const { rows } = await q(
      `UPDATE usuarios SET
         area_id = COALESCE($1, area_id),
         rol     = COALESCE($2, rol)
       WHERE id = $3
       RETURNING id, nombre, email, rol, area_id`,
      [area_id ?? null, rol ?? null, id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
}


export const me = (req, res) => {
  res.json({ data: req.user });
};


export async function actualizarUsuario(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, rol, area_id } = req.body || {};

    let areaId = area_id ?? null;
    if (typeof areaId === 'string' && areaId.trim() === '') areaId = null;

    if (areaId) {
      const { rows: a } = await q(`SELECT id FROM areas WHERE id=$1`, [areaId]);
      if (a.length === 0) {
        return res.status(400).json({ error: 'AREA_NOT_FOUND' });
      }
    }

    if (rol === 'admin') {
      const { rows: admins } = await q(
        `SELECT COUNT(*)::int AS c FROM usuarios WHERE rol = 'admin' AND id <> $1`,
        [id]
      );
      if (admins[0].c >= 1) {
        return res.status(400).json({ error: 'UNICO_ADMIN' });
      }
    }

    const { rows } = await q(
      `UPDATE usuarios
         SET nombre  = COALESCE($2, nombre),
             rol     = COALESCE($3, rol),
             area_id = $4
       WHERE id = $1
       RETURNING id, nombre, email, rol, area_id, creado_en`,
      [id, nombre ?? null, rol ?? null, areaId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'USUARIO_NOT_FOUND' });
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
}
export async function obtenerUsuarioPorId(req, res) {
  try {
    const { id } = req.params;

    const row = await getById(id);

    if (!row) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const out = {
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
      estado: row.estado ?? 'activo',
      area_id: row.area_id,
      area_nombre: row.area_nombre ?? null,
      creado_en: row.creado_en,
    };

    return res.json(out); 
  } catch (err) {
    console.error('obtenerUsuarioPorId error:', err);
    return res
      .status(500)
      .json({ message: 'Error al obtener usuario', detail: String(err?.message || err) });
  }
}