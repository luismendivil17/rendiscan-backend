import bcrypt from 'bcryptjs';
import { q } from '../db/index.js';

/**
 * Crear usuario
 */
export async function crearUsuario({ nombre, email, password, rol = 'solicitante', area_id = null }) {
  const hash = await bcrypt.hash(password, 10);

  const sql = `
    INSERT INTO usuarios (nombre, email, password, rol, area_id)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id, nombre, email, rol, area_id, creado_en
  `;
  const vals = [nombre.trim(), email.toLowerCase(), hash, rol, area_id];
  const { rows } = await q(sql, vals);
  return rows[0];
}

/**
 * Listar usuarios
 */
export async function listarUsuarios(_req, res, next) {
  try {
    const { rows } = await q(`
      SELECT u.id, u.nombre, u.email, u.rol, a.nombre AS area, u.area_id
      FROM usuarios u
      LEFT JOIN areas a ON a.id = u.area_id
      ORDER BY u.creado_en DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
}


/**
 * Obtener usuario por ID
 */
export async function obtenerUsuarioPorId(id) {
  const { rows } = await q(
    `SELECT id, nombre, email, rol, area_id, creado_en
     FROM usuarios
     WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Actualizar usuario
 */
export async function actualizarUsuario(id, data = {}) {
  const allowed = ['nombre', 'email', 'rol', 'area_id'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      vals.push(key === 'email' ? data[key].toLowerCase() : data[key]);
      sets.push(`${key} = $${vals.length}`);
    }
  }
  if (!sets.length) return await obtenerUsuarioPorId(id);

  vals.push(id);
  const { rows } = await q(
    `UPDATE usuarios
     SET ${sets.join(', ')}
     WHERE id = $${vals.length}
     RETURNING id, nombre, email, rol, area_id, creado_en`,
    vals
  );
  return rows[0] || null;
}

/**
 * Cambiar contraseña
 */
export async function cambiarPassword(id, nuevaPassword) {
  const hash = await bcrypt.hash(nuevaPassword, 10);
  const { rows } = await q(
    `UPDATE usuarios
     SET password = $1
     WHERE id = $2
     RETURNING id`,
    [hash, id]
  );
  return !!rows[0];
}
