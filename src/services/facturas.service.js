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


export async function listarPorUsuario(usuarioId){
  const sql = `
    SELECT f.*
    FROM facturas f
    JOIN rendiciones r ON r.id = f.rendicion_id
    WHERE r.usuario_id = $1
    ORDER BY f.fecha_emision DESC NULLS LAST, f.id DESC`;
  const { rows } = await q(sql, [usuarioId]);
  return rows;
}

export async function obtenerPorId(id, usuarioId){
  const sql = `
    SELECT f.*
    FROM facturas f
    JOIN rendiciones r ON r.id = f.rendicion_id
    WHERE f.id = $1 AND r.usuario_id = $2`;
  const { rows } = await q(sql, [id, usuarioId]);
  return rows[0] || null;
}

export async function procesarYGuardar({ rendicionId, usuarioId, filePath, mimeType }) {
  const { rows: r } = await q(`SELECT id, usuario_id FROM rendiciones WHERE id=$1`, [rendicionId]);
  if (!r[0] || r[0].usuario_id !== usuarioId) throw Object.assign(new Error('No autorizado'), { status: 403 });

  const extraido = await invoiceAI.extractFromFile(filePath, mimeType);
  const totalRaw = extraido.total ?? extraido.amountDue ?? extraido.invoiceTotal ?? null;

  const proveedor = extraido.proveedor ?? null;
  const ruc       = extraido.ruc ?? null;
  const numero    = extraido.numero ?? null;
  const fecha     = toDateOrNull(extraido.fecha_emision) || toDateOrNull(new Date());
  const total     = toNumberOrNull(totalRaw);

  const moneda = detectCurrency(totalRaw) || 'PEN';
  const tc_usd = await obtenerTipoCambioUSD(fecha);
  const total_usd = total == null ? null : (moneda === 'USD' ? Number(total.toFixed(2)) : Number((total / tc_usd).toFixed(2)));

  const ins = `
    INSERT INTO facturas (rendicion_id, proveedor, ruc, numero, fecha_emision, total, moneda, tc_usd, total_usd, archivo_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`;
  const { rows: f } = await q(ins, [rendicionId, proveedor, ruc, numero, fecha, total, moneda, tc_usd, total_usd, filePath]);

  for (const it of (extraido.items || [])) {
    await q(
      `INSERT INTO items_factura (factura_id, descripcion, cantidad, precio_unitario, total_linea)
       VALUES ($1,$2,$3,$4,$5)`,
      [f[0].id, it.descripcion ?? null, toNumberOrNull(it.cantidad), toNumberOrNull(it.precio_unitario), toNumberOrNull(it.total_linea)]
    );
  }
  return f[0];
}