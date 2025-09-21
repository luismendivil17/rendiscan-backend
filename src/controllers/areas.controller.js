import { q } from '../db/index.js';

export async function crearArea(req, res, next) {
  try {
    const { nombre } = req.body;
    const { rows } = await q(
      'INSERT INTO areas (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING RETURNING *',
      [nombre]
    );
    res.json(rows[0] || { ok: true }); 
  } catch (e) { next(e); }
}

export async function listarAreas(_req, res, next) {
  try {
    const { rows } = await q('SELECT id, nombre, jefe_usuario_id FROM areas ORDER BY nombre');
    res.json(rows);
  } catch (e) { next(e); }
}

export async function asignarJefeArea(req, res, next) {
  try {
    const { id } = req.params;             
    const { usuario_id } = req.body;        
    await q('UPDATE areas SET jefe_usuario_id=$1 WHERE id=$2', [usuario_id, id]);
    await q('UPDATE usuarios SET rol=$1 WHERE id=$2', ['aprobador', usuario_id]); 
    res.json({ ok: true });
  } catch (e) { next(e); }
}
