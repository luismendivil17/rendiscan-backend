import { q } from '../db/index.js';
import { canApprove } from '../utils/ownership.js';
import * as rendicionesService from '../services/rendiciones.service.js';
import { validate as uuidValidate } from 'uuid';



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
  try {
    const { id } = req.params;

    const u = await q('SELECT area_id FROM usuarios WHERE id=$1::uuid', [req.user.id]);
    const areaSolic = u.rows[0]?.area_id ?? null;

    await q(`
      UPDATE rendiciones r
      SET estado='enviado',
          enviado_en=now(),
          area_id = COALESCE(r.area_id, $3::uuid)   -- 👈 rellena
      WHERE r.id=$1::uuid AND r.usuario_id=$2::uuid AND r.estado='borrador'
    `, [id, req.user.id, areaSolic]);

    await q(`
      INSERT INTO aprobaciones (rendicion_id, actor_id, accion)
      VALUES ($1::uuid, $2::uuid, 'enviar')
    `, [id, req.user.id]);

    res.json({ ok: true });
  } catch (e) { next(e); }
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
export async function listarPorAprobador(aprobadorId) {
  const ap = await q('SELECT area_id FROM usuarios WHERE id=$1::uuid', [aprobadorId]);
  const areaId = ap.rows[0]?.area_id;
  if (!areaId) return []; 

  const { rows } = await q(`
    SELECT
      r.*,
      a.nombre AS area_nombre,
      u.nombre AS usuario_nombre
    FROM rendiciones r
    LEFT JOIN areas a   ON a.id = r.area_id
    JOIN usuarios u     ON u.id = r.usuario_id
    WHERE r.estado = 'enviado'
      AND (r.area_id = $1::uuid OR u.area_id = $1::uuid)  -- 👈 cubre rendiciones sin r.area_id
    ORDER BY r.enviado_en DESC NULLS LAST, r.creado_en DESC
  `, [areaId]);

  return rows;
}

export async function listarPorUsuario(usuarioId) {
  const { rows } = await q(`
    SELECT id, usuario_id, comentario, estado,
           aprobador_id, enviado_en, aprobado_en, rechazado_en,
           motivo_rechazo, creado_en
      FROM rendiciones
     WHERE usuario_id=$1
     ORDER BY creado_en DESC
  `, [usuarioId]);
  return rows;
}
export async function listarPendientes(req, res, next) {
  try {
    const aprobadorId = req.user.id;
    const ap = await q('SELECT id, rol, area_id FROM usuarios WHERE id=$1::uuid', [aprobadorId]);
    const me = ap.rows[0] || {};
    const areaId = me.area_id;

    if (!areaId) {
      console.log('PENDIENTES sin área -> []', { aprobadorId, rol: me.rol });
      return res.json({ data: [] });
    }

    const { rows } = await q(`
      SELECT
        r.id, r.estado, r.enviado_en, r.area_id, r.usuario_id,
        u.nombre AS usuario_nombre, u.email AS usuario_email,
        a.nombre AS area_nombre
      FROM rendiciones r
      JOIN usuarios u ON u.id = r.usuario_id
      LEFT JOIN areas a ON a.id = COALESCE(r.area_id, u.area_id)
      WHERE r.estado = 'enviado'
        AND COALESCE(r.area_id, u.area_id) = $1::uuid
      ORDER BY r.enviado_en DESC NULLS LAST, r.creado_en DESC
    `, [areaId]);

    console.log('PENDIENTES OK', { aprobadorId, areaId, count: rows.length });
    res.json({ data: rows });
  } catch (e) { next(e); }
}
export async function stats(req, res, next) {
  try {
    const uid = req.user.id;

    const rend = await q(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado='borrador')::int  AS borrador,
        COUNT(*) FILTER (WHERE estado='enviado')::int   AS enviado,
        COUNT(*) FILTER (WHERE estado='aprobado')::int  AS aprobado,
        COUNT(*) FILTER (WHERE estado='rechazado')::int AS rechazado,
        COALESCE(AVG(EXTRACT(EPOCH FROM (enviado_en  - creado_en))*1000), 0)::bigint AS t_envio_ms,
        COALESCE(AVG(EXTRACT(EPOCH FROM (aprobado_en - enviado_en))*1000), 0)::bigint AS t_aprob_ms,
        COALESCE(AVG(EXTRACT(EPOCH FROM (rechazado_en - enviado_en))*1000), 0)::bigint AS t_rechazo_ms
      FROM rendiciones
      WHERE usuario_id = $1::uuid
    `, [uid]);

    const fact = await q(`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(AVG(ocr_ms), 0)::bigint AS avg_ocr_ms,
        COALESCE(AVG(precision), 0)::float AS avg_precision
      FROM facturas
      WHERE usuario_id = $1::uuid
    `, [uid]);

    const r = rend.rows[0] || {};
    const f = fact.rows[0] || {};

    return res.json({
      rendiciones: {
        total: r.total ?? 0,
        porEstado: {
          borrador:  r.borrador  ?? 0,
          enviado:   r.enviado   ?? 0,
          aprobado:  r.aprobado  ?? 0,
          rechazado: r.rechazado ?? 0,
        },
        tiemposPromedioMs: {
          hastaEnvio: Number(r.t_envio_ms ?? 0),
          aprobacion: Number(r.t_aprob_ms ?? 0),
          rechazo:    Number(r.t_rechazo_ms ?? 0),
        },
      },
      facturas: {
        total: f.total ?? 0,
        avgOcrMs: Number(f.avg_ocr_ms ?? 0),
        avgPrecision: f.avg_precision ?? 0.0, // 0..1
      }
    });
  } catch (e) {
    next(e);
  }
}
export async function obtenerRendicion(req, res, next) {
  try {
    const { id } = req.params;

    if (!uuidValidate(id)) {
      return res.status(400).json({ error: 'id inválido: debe ser UUID' });
    }

    const r = await rendicionesService.obtenerPorId(id);
    if (!r) return res.status(404).json({ error: 'Rendición no encontrada' });

    const me = req.user || {};
    const rol = (me.rol || '').toLowerCase();
    const esAdmin = rol === 'admin';
    const esDueno = r.usuario_id === me.id;
    const esAprobador = rol === 'aprobador';

    if (!(esAdmin || esDueno)) {
      if (esAprobador) {
        const ap = await q('SELECT area_id FROM usuarios WHERE id=$1::uuid', [me.id]);
        const areaAprobador = ap.rows[0]?.area_id;
        const areaRend = r.area_id;
        if (!areaAprobador || !areaRend || areaAprobador !== areaRend) {
          return res.status(403).json({ error: 'No autorizado' });
        }
      } else {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    return res.json({ data: r });
  } catch (e) {
    next(e);
  }
}