import { q } from '../db/index.js';

export async function canApprove(rendicionId, aprobadorId, isAdmin) {
  if (isAdmin) return true;

  const r = await q(`
    SELECT r.area_id, u.area_id AS solicitante_area, r.estado
    FROM rendiciones r
    JOIN usuarios u ON u.id = r.usuario_id
    WHERE r.id = $1::uuid
  `, [rendicionId]);
  if (r.rowCount === 0) return false;
  if (r.rows[0].estado !== 'enviado') return false;

  const ap = await q('SELECT area_id FROM usuarios WHERE id=$1::uuid', [aprobadorId]);
  const areaAprobador = ap.rows[0]?.area_id;

  const areaRend = r.rows[0].area_id ?? r.rows[0].solicitante_area;
  return !!areaAprobador && !!areaRend && areaAprobador === areaRend;
}
