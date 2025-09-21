import * as facturasService from '../services/facturas.service.js';



export async function subirFactura(req, res, next){
  try {
    const { rendicionId } = req.params;
    const filePath = req.file?.path;
    if (!filePath) return res.status(400).json({ error: 'Archivo requerido' });

    const factura = await facturasService.procesarYGuardar({
      rendicionId,
      usuarioId: req.user.id,
      filePath
    });

    res.json({ ok: true, factura });
  } catch (e) { next(e); }
}

export async function procesarYGuardar({ rendicionId, usuarioId, filePath, mimeType }) {

  const extraido = await invoiceAI.extractFromFile(filePath, mimeType); 

  const ins = `
    INSERT INTO facturas (rendicion_id, proveedor, ruc, numero, fecha_emision, total, archivo_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
  const { rows: f } = await q(ins, [
    rendicionId,
    emptyToNull(extraido.proveedor),
    emptyToNull(extraido.ruc),
    emptyToNull(extraido.numero),
    emptyToNull(extraido.fecha_emision),
    emptyToNull(extraido.total),
    filePath
  ]);

  for (const it of (extraido.items || [])) {
    await q(
      `INSERT INTO items_factura (factura_id, descripcion, cantidad, precio_unitario, total_linea)
       VALUES ($1,$2,$3,$4,$5)`,
      [f[0].id, emptyToNull(it.descripcion), it.cantidad ?? null, it.precio_unitario ?? null, it.total_linea ?? null]
    );
  }

  return f[0];
}

function emptyToNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : v;
}

import { q } from '../db/index.js';

export async function listarFacturas(req, res, next) {
  try {
    const sql = `
      SELECT f.*
      FROM facturas f
      JOIN rendiciones r ON r.id = f.rendicion_id
      WHERE r.usuario_id = $1
      ORDER BY f.fecha_emision DESC NULLS LAST, f.id DESC`;
    const { rows } = await q(sql, [req.user.id]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}


export async function totalesPorRendicion(req, res, next) {
  try {
    const sql = `
      SELECT
        r.id               AS rendicion_id,
        COALESCE(SUM(f.total_usd), 0) AS total_usd,
        COALESCE(SUM(CASE WHEN f.moneda = 'PEN' THEN f.total ELSE 0 END), 0) AS total_pen,
        COALESCE(SUM(CASE WHEN f.moneda = 'USD' THEN f.total ELSE 0 END), 0) AS total_usd_origen,
        COUNT(f.id)        AS cant_facturas
      FROM rendiciones r
      LEFT JOIN facturas f ON f.rendicion_id = r.id
      WHERE r.usuario_id = $1
      GROUP BY r.id
      ORDER BY r.id;
    `;
    const { rows } = await q(sql, [req.user.id]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function obtenerFactura(req, res, next) {
  try {
    const facturaId = req.params.id;

    const sql = `
      SELECT f.*, r.usuario_id
      FROM facturas f
      JOIN rendiciones r ON r.id = f.rendicion_id
      WHERE f.id = $1 AND r.usuario_id = $2
    `;
    const { rows } = await q(sql, [facturaId, req.user.id]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}