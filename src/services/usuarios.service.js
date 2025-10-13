import bcrypt from 'bcryptjs';
import { q } from '../db/index.js';


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



export async function obtenerUsuarioPorId(id) {
  const sql = `
    SELECT
      u.id, u.nombre, u.email, u.rol, u.estado, u.area_id, u.creado_en,
      a.nombre AS area_nombre
    FROM usuarios u
    LEFT JOIN areas a ON a.id = u.area_id
    WHERE u.id = $1::uuid
    LIMIT 1;
  `;
  const { rows } = await q(sql, [String(id).trim()]);
  return rows[0] || null; 
}




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
