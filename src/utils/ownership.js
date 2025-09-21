import { q } from '../db/index.js';

export async function canApprove(rendicionId, userId, isAdmin) {
  const { rows } = await q('SELECT aprobador_id FROM rendiciones WHERE id=$1', [rendicionId]);
  return !!rows[0] && (isAdmin || rows[0].aprobador_id === userId);
}