import { q } from '../db/index.js';

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

export async function actualizarAreaYRol(req, res, next) {
  try {
    const { id } = req.params;
    const { area_id, rol } = req.body; 
    const { rows } = await q(
      `UPDATE usuarios SET
         area_id = COALESCE($1, area_id),
         rol     = COALESCE($2, rol)
       WHERE id = $3
       RETURNING id, nombre, email, rol, area_id`,
      [area_id ?? null, rol ?? null, id]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
}
export const me = (req, res) => {
  return res.json(req.user);
};
