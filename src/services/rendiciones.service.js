import { q } from '../db/index.js';

export async function crear({ usuarioId, comentario, reuseBorrador = true }) {
  if (reuseBorrador) {
    const { rows: exist } = await q(
      `
      SELECT r.id, r.usuario_id, r.area_id, r.comentario, r.estado,
             r.aprobador_id, r.enviado_en, r.aprobado_en, r.rechazado_en,
             r.motivo_rechazo, r.creado_en,
             a.nombre AS area_nombre
        FROM rendiciones r
        LEFT JOIN areas a ON a.id = r.area_id
       WHERE r.usuario_id = $1
         AND r.estado = 'borrador'
       ORDER BY r.creado_en DESC
       LIMIT 1
      `,
      [usuarioId]
    );

    if (exist.length) {
      if (comentario && !exist[0].comentario) {
        await q(`UPDATE rendiciones SET comentario=$1 WHERE id=$2`, [comentario, exist[0].id]);
        exist[0].comentario = comentario;
      }
      return exist[0]; 
    }
  }

  const { rows: u } = await q(
    `
    SELECT u.area_id, a.jefe_usuario_id
      FROM usuarios u
      LEFT JOIN areas a ON a.id = u.area_id
     WHERE u.id = $1
    `,
    [usuarioId]
  );
  if (u.length === 0 || !u[0].area_id) {
    throw new Error('Usuario sin área asignada.');
  }

  const areaId = u[0].area_id;
  const aprobadorId = u[0].jefe_usuario_id || null;

  const { rows } = await q(
    `
    INSERT INTO rendiciones (usuario_id, area_id, comentario, aprobador_id, estado)
    VALUES ($1, $2, $3, $4, 'borrador')
    RETURNING id, usuario_id, area_id, comentario, estado,
              aprobador_id, enviado_en, aprobado_en, rechazado_en,
              motivo_rechazo, creado_en
    `,
    [usuarioId, areaId, comentario ?? null, aprobadorId]
  );

  const rendicion = rows[0];

  const { rows: areaInfo } = await q(`SELECT nombre FROM areas WHERE id = $1`, [areaId]);
  rendicion.area_nombre = areaInfo[0]?.nombre ?? null;

  return rendicion;
}

export async function listarPorAprobador(aprobadorId) {
  
  const ap = await q('SELECT area_id FROM usuarios WHERE id=$1::uuid', [aprobadorId]);
  const areaId = ap.rows[0]?.area_id;
  if (!areaId) return []; 

  const { rows } = await q(`
    SELECT
      r.id, r.usuario_id, r.area_id, r.estado, r.enviado_en, r.creado_en,
      u.nombre  AS usuario_nombre,
      u.email   AS usuario_email,
      a.nombre  AS area_nombre
    FROM rendiciones r
    JOIN usuarios u ON u.id = r.usuario_id
    LEFT JOIN areas a ON a.id = COALESCE(r.area_id, u.area_id)
    WHERE r.estado = 'enviado'
      AND COALESCE(r.area_id, u.area_id) = $1::uuid
    ORDER BY r.enviado_en DESC NULLS LAST, r.creado_en DESC
  `, [areaId]);

  return rows;
}
export async function listarPorUsuario(usuarioId) {
  const { rows } = await q(
    `
    SELECT id, usuario_id, comentario, estado,
           aprobador_id, enviado_en, aprobado_en, rechazado_en,
           motivo_rechazo, creado_en
      FROM rendiciones
     WHERE usuario_id = $1
     ORDER BY creado_en DESC
    `,
    [usuarioId]
  );
  return rows;
}
export async function enviarSiBorrador(rendicionId, usuarioId) {
  const { rows } = await q(
    `
    UPDATE rendiciones
       SET estado = 'enviado',
           enviado_en = now()
     WHERE id = $1
       AND usuario_id = $2
       AND estado = 'borrador'
     RETURNING id
    `,
    [rendicionId, usuarioId]
  );

  if (rows.length) {
    await q(
      `INSERT INTO aprobaciones (rendicion_id, actor_id, accion)
       VALUES ($1, $2, 'enviar')`,
      [rendicionId, usuarioId]
    );
    return true; 
  }
  return false; 
}
export async function obtenerPorId(rendicionId) {
  const { rows } = await q(`
    SELECT
      r.id, r.usuario_id, r.area_id, r.estado, r.comentario,
      r.enviado_en, r.aprobado_en, r.rechazado_en, r.motivo_rechazo, r.creado_en,
      u.nombre  AS usuario_nombre,
      u.email   AS usuario_email,
      a.nombre  AS area_nombre
    FROM rendiciones r
    JOIN usuarios u ON u.id = r.usuario_id
    LEFT JOIN areas a ON a.id = COALESCE(r.area_id, u.area_id)
    WHERE r.id = $1::uuid
    LIMIT 1
  `, [rendicionId]);

  return rows[0] || null;
}