import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import * as facturasService from '../services/facturas.service.js';
import * as rendicionesService from '../services/rendiciones.service.js';


const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const safe = file.originalname.replace(/[^\w.-]+/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});

export const upload = multer({ storage });


export async function subirFactura(req, res, next) {
  try {
    const rendicionId = req.params.id || req.params.rendicionId;

    if (!req.file?.path) {
      return res.status(400).json({ error: 'Archivo requerido (campo "file")' });
    }

    const filePathAbs = req.file.path;                               
    const publicUrl   = `/uploads/${path.basename(req.file.path)}`;  
    const mimeType    = req.file.mimetype;

    const factura = await facturasService.procesarYGuardar({
      rendicionId,
      usuarioId: req.user.id,
      filePathAbs,
      publicUrl,
      mimeType,
    });

    const items = await facturasService.listarItemsPorFactura(factura.id);
    const enviadas = await rendicionesService.enviarSiBorrador(rendicionId, req.user.id);

     return res.json({
      factura_id: factura.id,
      archivo_url: factura.archivo_url,
      factura: {
        proveedor: factura.proveedor ?? '',
        ruc: factura.ruc ?? '',
        numero: factura.numero ?? '',
        fecha_emision: factura.fecha_emision,
        moneda: factura.moneda ?? 'PEN',
        total: factura.total,
      },
      items,
      rendicion: {
        id: rendicionId,
        estado: enviadas ? 'enviado' : 'borrador',
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function listarFacturas(req, res, next) {
  try {
    const rows = await facturasService.listarPorUsuario(req.user.id);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}


export async function obtenerFactura(req, res, next) {
  try {
    const facturaId = req.params.id;
    const row = await facturasService.obtenerPorId(facturaId, req.user.id);
    if (!row) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(row);
  } catch (e) {
    next(e);
  }
}


export async function totalesPorRendicion(req, res, next) {
  try {
    const rows = await facturasService.totalesPorRendicion?.(req.user.id);
    if (rows) return res.json(rows);

    return next(new Error('totalesPorRendicion no implementado en service'));
  } catch (e) {
    next(e);
  }
}
export async function actualizarFactura(req, res, next) {
  try {
    const facturaId = req.params.id;
    const factura = await facturasService.actualizarFactura(facturaId, req.user.id, req.body);
    res.json(factura);
  } catch (e) {
    next(e);
  }
}
export async function listarFacturasPorRendicion(req, res, next) {
  try {
    const { id } = req.params; 
    const rows = await facturasService.listarPorRendicion(id, req.user.id);
    res.json(rows);
  } catch (e) { next(e); }
}
