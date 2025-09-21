import { q } from '../db/index.js';
import { canApprove } from '../utils/ownership.js';

export async function crearRendicion(req, res, next){
  try {
    const r = await rendicionesService.crear({ usuarioId: req.user.id, comentario: req.body.comentario });
    res.json(r);
  } catch(e){ next(e); }
}

export async function listarMisRendiciones(req, res, next){
  try {
    const list = await rendicionesService.listarPorUsuario(req.user.id);
    res.json(list);
  } catch(e){ next(e); }
}

export async function enviarRendicion(req, res, next) {
  try{
    const {id} = req.params;

    await q(`
      UPDATE rendiciones r
      SET estado='enviado', enviado_en=now()
      WHERE r.id=$1 AND r.usuario_id=$2 AND r.estado='borrador'
    `, [id, req.user.id]);
    await q(`INSERT INTO aprobaciones(rendicion_id,actor_id,accion) VALUES ($1,$2,'enviar')`, [id, req.user.id]);
    res.json({ ok: true });
  } catch (e){ next(e); }
}
export async function aprobarRendicion(req,res,next){
  try {
    const { id } = req.params;
    const ok = await canApprove(id, req.user.id, req.user.rol==='admin');
    if (!ok) return res.status(403).json({ error: 'No autorizado' });
    await q(`
      UPDATE rendiciones SET estado='aprobado', aprobado_en=now()
      WHERE id=$1 AND estado='enviado'
    `, [id]);
    await q(`INSERT INTO aprobaciones(rendicion_id,actor_id,accion) VALUES ($1,$2,'aprobar')`, [id, req.user.id]);
    res.json({ ok: true });
  } catch (e){ next(e); }
}

export async function rechazarRendicion(req,res,next){
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const ok = await canApprove(id, req.user.id, req.user.rol==='admin');
    if (!ok) return res.status(403).json({ error: 'No autorizado' });
    await q(`
      UPDATE rendiciones SET estado='rechazado', rechazado_en=now(), motivo_rechazo=$2
      WHERE id=$1 AND estado='enviado'
    `, [id, motivo ?? null]);
    await q(`INSERT INTO aprobaciones(rendicion_id,actor_id,accion,comentario) VALUES ($1,$2,'rechazar',$3)`,
      [id, req.user.id, motivo ?? null]);
    res.json({ ok: true });
  } catch (e){ next(e); }
}