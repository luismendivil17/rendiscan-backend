import { q } from '../db/index.js';

export const listarAreas = async (_req, res) => {
  try {
    const { rows } = await q(`
      SELECT a.id,
             a.nombre,
             a.jefe_usuario_id,
             u.nombre AS jefe_nombre,
             u.email  AS jefe_email,
             u.rol    AS jefe_rol
        FROM areas a
   LEFT JOIN usuarios u ON u.id = a.jefe_usuario_id
    ORDER BY a.nombre;
    `);                             
    res.json({ data: rows });
  } catch (e) {
    console.error('ERR listarAreas:', e);
    res.status(500).json({ error: 'ERR_LIST_AREAS' });
  }
};

export const crearArea = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.toString().trim()) {
      return res.status(400).json({ error: 'NOMBRE_REQUIRED' });
    }
    const { rows } = await q(
      `INSERT INTO areas (nombre) VALUES ($1)
       RETURNING id, nombre, jefe_usuario_id`,
      [nombre.trim()]
    );
    res.status(201).json({ data: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'NOMBRE_DUPLICADO' });
    console.error('ERR crearArea:', e);
    res.status(500).json({ error: 'ERR_CREATE_AREA' });
  }
};

export const asignarJefeArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { jefe_usuario_id } = req.body;

    const areaQ = await q('SELECT id FROM areas WHERE id = $1', [id]);
    if (!areaQ.rows[0]) return res.status(404).json({ error: 'AREA_NOT_FOUND' });

    if (jefe_usuario_id) {
      const u = await q('SELECT id, rol FROM usuarios WHERE id = $1', [jefe_usuario_id]);
      const user = u.rows[0];
      if (!user) return res.status(400).json({ error: 'JEFE_INVALIDO' });

      if (user.rol !== 'aprobador') {
        await q('UPDATE usuarios SET rol = $1 WHERE id = $2', ['aprobador', jefe_usuario_id]);
      }
      await q('UPDATE usuarios SET area_id = $1 WHERE id = $2', [id, jefe_usuario_id]);

      const upd = await q(
        `UPDATE areas SET jefe_usuario_id = $1 WHERE id = $2
         RETURNING id, nombre, jefe_usuario_id`,
        [jefe_usuario_id, id]
      );

      const jefe = await q(
        'SELECT nombre AS jefe_nombre, email AS jefe_email FROM usuarios WHERE id = $1',
        [jefe_usuario_id]
      );

      return res.json({ data: { ...upd.rows[0], ...jefe.rows[0] } });
    }

    const prev = await q('SELECT jefe_usuario_id FROM areas WHERE id = $1', [id]);
    const prevJefe = prev.rows[0]?.jefe_usuario_id;

    const upd = await q(
      `UPDATE areas SET jefe_usuario_id = NULL WHERE id = $1
       RETURNING id, nombre, jefe_usuario_id`,
      [id]
    );

    if (prevJefe) {
      await q(
        `UPDATE usuarios SET rol = 'solicitante', area_id = NULL WHERE id = $1`,
        [prevJefe]
      );
    }

    return res.json({ data: { ...upd.rows[0], jefe_nombre: null, jefe_email: null } });
  } catch (e) {
    if (e.code === '23505') { 
      return res.status(409).json({ error: 'JEFE_YA_ASIGNADO_EN_OTRA_AREA' });
    }
    console.error('ERR asignarJefeArea:', e);
    res.status(500).json({ error: 'ERR_SET_BOSS' });
  }
};
export async function miArea(req, res, next) {
  try {
    const { id: userId } = req.user;
    const { rows } = await q(`
      SELECT a.id, a.nombre, a.jefe_usuario_id
      FROM usuarios u
      JOIN areas a ON a.id = u.area_id
      WHERE u.id = $1::uuid
      LIMIT 1
    `, [userId]);
    if (!rows.length) return res.json({ data: null }); 
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
}
export async function miembrosDeMiArea(req, res, next) {
  try {
    const { id: userId } = req.user;
    const a = await q(`SELECT area_id FROM usuarios WHERE id=$1::uuid`, [userId]);
    const areaId = a.rows[0]?.area_id;
    if (!areaId) return res.json({ data: [] });

    const { rows } = await q(`
      SELECT id, nombre, email, rol, estado, area_id, creado_en
      FROM usuarios
      WHERE area_id = $1::uuid
      ORDER BY rol DESC, nombre ASC
    `, [areaId]);
    res.json({ data: rows });
  } catch (e) { next(e); }
}
export async function miembrosPorArea(req, res, next) {
  try {
    const { id } = req.params; // UUID
    const { rows } = await q(`
      SELECT id, nombre, email, rol, estado, area_id, creado_en
      FROM usuarios
      WHERE area_id = $1::uuid
      ORDER BY rol DESC, nombre ASC
    `, [id]);
    res.json({ data: rows });
  } catch (e) { next(e); }
}