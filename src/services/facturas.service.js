import { q } from '../db/index.js';
import * as invoiceAI from './ai/invoice-ai.service.js';


function toNumberOrNull(v) {
  if (v === undefined || v === null) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function detectCurrency(rawText) {
  const s = String(rawText || '').toUpperCase();
  if (/\bUSD\b|\$\s?\d|US\$/.test(s)) return 'USD';
  if (/\bPEN\b|S\/\s?|\bS\.\b/.test(s)) return 'PEN';
  return 'PEN';
}

async function obtenerTipoCambioUSD() {
  return 3.55;
}


export async function verificarRendicionDelUsuario(rendicionId, usuarioId) {
  const { rows } = await q(
    `SELECT 1 FROM rendiciones WHERE id=$1::uuid AND usuario_id=$2::uuid`,
    [rendicionId, usuarioId]
  );
  return rows.length > 0;
}

export async function listarPorUsuario(usuarioId) {
  const sql = `
    SELECT f.*
      FROM facturas f
      JOIN rendiciones r ON r.id = f.rendicion_id
     WHERE r.usuario_id = $1::uuid
     ORDER BY f.fecha_emision DESC NULLS LAST, f.id DESC`;
  const { rows } = await q(sql, [usuarioId]);
  return rows;
}

export async function obtenerPorId(id, usuarioId) {
  const sql = `
    SELECT f.*
      FROM facturas f
      JOIN rendiciones r ON r.id = f.rendicion_id
     WHERE f.id = $1::uuid AND r.usuario_id = $2::uuid`;
  const { rows } = await q(sql, [id, usuarioId]);
  return rows[0] || null;
}

export async function listarItemsPorFactura(facturaId) {
  const { rows } = await q(
    `SELECT id, factura_id, descripcion, cantidad, precio_unitario, total_linea
       FROM items_factura
      WHERE factura_id = $1::uuid
      ORDER BY id`,
    [facturaId]
  );
  return rows;
}


export async function procesarYGuardar({
  rendicionId,
  usuarioId,
  filePathAbs, 
  publicUrl,   
  mimeType,
}) {
  const allowed = await verificarRendicionDelUsuario(rendicionId, usuarioId);
  if (!allowed) throw Object.assign(new Error('No autorizado'), { status: 403 });

  const extraido = await invoiceAI.extractFromFile(filePathAbs, mimeType);

  const proveedor = extraido.proveedor ?? null;
  const ruc       = extraido.ruc ?? null;
  const numero    = extraido.numero ?? null;
  const fecha     = toDateOrNull(extraido.fecha_emision) || toDateOrNull(new Date());

  const totalRaw  = extraido.total ?? extraido.amountDue ?? extraido.invoiceTotal ?? null;
  const total     = toNumberOrNull(totalRaw);
  const moneda    = detectCurrency(totalRaw) || 'PEN';
  const tc_usd    = await obtenerTipoCambioUSD(fecha);
  const total_usd = total == null
    ? null
    : (moneda === 'USD' ? Number(total.toFixed(2)) : Number((total / tc_usd).toFixed(2)));

  const sql = `
    INSERT INTO facturas (
      id, rendicion_id, usuario_id,
      proveedor, ruc, numero, fecha_emision, total, moneda, tc_usd, total_usd, archivo_url
    )
    SELECT
      uuid_generate_v4(), $1::uuid, r.usuario_id,
      $2, $3, $4, $5::date, $6, $7, $8, $9, $10
    FROM rendiciones r
    WHERE r.id = $1::uuid
    RETURNING *;
  `;
  const vals = [
    rendicionId,
    proveedor, ruc, numero, fecha, total, moneda, tc_usd, total_usd, publicUrl,
  ];
  const ins = await q(sql, vals);

  if (ins.rowCount === 0) {
    const err = new Error('Rendición no encontrada');
    err.status = 404;
    throw err;
  }

  const factura = ins.rows[0];

  if (Array.isArray(extraido.items)) {
    for (const it of extraido.items) {
      await q(
        `INSERT INTO items_factura (factura_id, descripcion, cantidad, precio_unitario, total_linea)
         VALUES ($1::uuid,$2,$3,$4,$5)`,
        [
          factura.id,
          it.descripcion ?? null,
          toNumberOrNull(it.cantidad),
          toNumberOrNull(it.precio_unitario),
          toNumberOrNull(it.total_linea),
        ]
      );
    }
  }

  return factura;
}

export async function actualizarFactura(facturaId, usuarioId, data) {
  const { rows: check } = await q(
    `SELECT f.id
       FROM facturas f
       JOIN rendiciones r ON r.id = f.rendicion_id
      WHERE f.id = $1::uuid AND r.usuario_id = $2::uuid`,
    [facturaId, usuarioId]
  );
  if (check.length === 0) throw Object.assign(new Error('No autorizado'), { status: 403 });

  const {
    proveedor, ruc, numero, fecha_emision, moneda, total, items
  } = data;

  const tc_usd = await obtenerTipoCambioUSD(fecha_emision);
  const total_usd = total == null
    ? null
    : (moneda === 'USD' ? Number(Number(total).toFixed(2))
                        : Number((Number(total) / Number(tc_usd)).toFixed(2)));

  const upd = `
    UPDATE facturas
       SET proveedor=$1, ruc=$2, numero=$3,
           fecha_emision=$4::date, moneda=$5,
           total=$6, tc_usd=$7, total_usd=$8
     WHERE id=$9::uuid
     RETURNING *`;
  const { rows } = await q(upd, [
    proveedor, ruc, numero, fecha_emision, moneda, total, tc_usd, total_usd, facturaId
  ]);

  const factura = rows[0];

  if (Array.isArray(items)) {
    await q(`DELETE FROM items_factura WHERE factura_id=$1::uuid`, [facturaId]);
    for (const it of items) {
      await q(
        `INSERT INTO items_factura (factura_id, descripcion, cantidad, precio_unitario, total_linea)
         VALUES ($1::uuid,$2,$3,$4,$5)`,
        [facturaId, it.descripcion, it.cantidad, it.precio_unitario, it.total_linea]
      );
    }
  }

  return factura;
}

export async function listarPorRendicion(rendicionId, usuarioId) {
  const { rows: owns } = await q(
    `SELECT 1 FROM rendiciones WHERE id=$1::uuid AND usuario_id=$2::uuid`,
    [rendicionId, usuarioId]
  );
  if (owns.length === 0) {
    const e = new Error('No autorizado');
    e.status = 403;
    throw e;
  }

  const { rows } = await q(
    `SELECT f.*
       FROM facturas f
      WHERE f.rendicion_id = $1::uuid
      ORDER BY f.fecha_emision DESC NULLS LAST, f.creado_en DESC`,
    [rendicionId]
  );
  return rows;
}
