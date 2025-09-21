import { q } from '../db/index.js';

export async function crear({ usuarioId, comentario }){
  const { rows: u } = await q(`
    SELECT u.area_id, a.jefe_usuario_id
    FROM usuarios u
    LEFT JOIN areas a ON a.id = u.area_id
    WHERE u.id = $1
  `, [usuarioId]);

  const aprobadorId = u[0]?.jefe_usuario_id || null;

  const ins = `
    INSERT INTO rendiciones (usuario_id, comentario, aprobador_id, estado)
    VALUES ($1,$2,$3,'borrador')
    RETURNING *`;
  const { rows } = await q(ins, [usuarioId, comentario ?? null, aprobadorId]);
  return rows[0];
}


export async function enviar(id, usuarioId){
  const upd = await q(`
    UPDATE rendiciones
    SET estado='enviado', enviado_en=now()
    WHERE id=$1 AND usuario_id=$2 AND estado='borrador'
    RETURNING *`,
    [id, usuarioId]
  );
  return upd.rows[0];
}

export async function listarPorUsuario(usuarioId){
  const { rows } = await q(
    `SELECT * FROM rendiciones WHERE usuario_id=$1 ORDER BY fecha_creacion DESC`,
    [usuarioId]
  );
  return rows;
}
