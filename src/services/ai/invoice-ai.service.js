import fs from 'fs';
import axios from 'axios';
import mime from 'mime-types';

const ENDPOINT = process.env.AZURE_ENDPOINT; 
const KEY = process.env.AZURE_KEY;
const V = process.env.AZURE_API_VERSION || '2024-07-31';

const URLS = [
  `${ENDPOINT}documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=${V}`,
  `${ENDPOINT}formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`
];

export async function extractFromFile(filePath, mimeType) {
  const type = mimeType || mime.lookup(filePath) || 'application/octet-stream';
  const fileBuffer = fs.readFileSync(filePath);

  let lastErr;
  for (const url of URLS) {
    try {
      const resp = await axios.post(url, fileBuffer, {
        headers: { 'Content-Type': type, 'Ocp-Apim-Subscription-Key': KEY },
        validateStatus: s => (s >= 200 && s < 300) || s === 202
      });

      let op = resp.headers['operation-location'];
      let data = resp.data;
      if (data?.status === 'succeeded' || data?.analyzeResult) return mapAzureInvoice(data);
      if (!op) throw new Error('No se obtuvo operation-location');

      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const poll = await axios.get(op, { headers: { 'Ocp-Apim-Subscription-Key': KEY } });
        const st = poll.data?.status || poll.data?.analyzeResult?.status;
        if (st === 'succeeded') return mapAzureInvoice(poll.data);
        if (st === 'failed') throw new Error('Análisis fallido');
      }
      throw new Error('Timeout de análisis');
    } catch (e) {
      lastErr = e;
      if (e?.response?.status === 404) continue; 
      break;
    }
  }
  console.error('Azure error:', lastErr?.response?.status, lastErr?.response?.data || lastErr?.message);
  return { proveedor: null, ruc: null, numero: null, fecha_emision: null, total: null, items: [] };
}

function mapAzureInvoice(resp) {
  const doc = resp?.documents?.[0] || resp?.analyzeResult?.documents?.[0] || null;
  const f = doc?.fields || {};
  const get = n => f?.[n]?.value ?? f?.[n]?.content ?? null;
  const items = (f?.Items?.values || []).map(v => {
    const p = v?.properties || {};
    const gp = n => p?.[n]?.value ?? p?.[n]?.content ?? null;
    return { descripcion: gp('Description'), cantidad: gp('Quantity'), precio_unitario: gp('UnitPrice'), total_linea: gp('Amount') };
  });
  return {
    proveedor: get('VendorName') || get('SupplierName') || null,
    ruc: get('VendorTaxId') || get('SupplierTaxId') || null,
    numero: get('InvoiceId') || get('InvoiceNumber') || null,
    fecha_emision: get('InvoiceDate') || null,
    total: get('Total') ?? get('AmountDue') ?? get('InvoiceTotal') ?? null,
    items
  };
}
