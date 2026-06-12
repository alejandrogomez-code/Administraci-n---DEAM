// Parser del archivo "Mis Comprobantes Recibidos" descargado de ARCA/AFIP
// La primera fila es un título; los headers están en la fila 2.

import * as XLSX from 'xlsx';
import { ComprobanteAfip } from './types';
import { cleanText, extractLetra, normCuit, parseFecha, toMoney } from './normalize';

const POSIBLES_CABECERAS = ['fecha', 'tipo', 'punto de venta', 'número desde', 'nro. doc. emisor', 'imp. total'];

export async function parseAfip(file: File): Promise<{ rows: ComprobanteAfip[]; warnings: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Detectar fila de headers: buscar la primera fila que contenga 'Nro. Doc. Emisor' o 'Imp. Total'
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i].map((c) => String(c ?? '').toLowerCase().trim());
    const hits = POSIBLES_CABECERAS.filter((h) => row.includes(h)).length;
    if (hits >= 3) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('No se pudo detectar la fila de encabezados en el archivo AFIP.');
  }

  const headers = rawRows[headerIdx].map((h: any) => String(h ?? '').trim());
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iFecha = idx('Fecha');
  const iTipo = idx('Tipo');
  const iPv = idx('Punto de Venta');
  const iNum = idx('Número Desde');
  const iCuit = idx('Nro. Doc. Emisor');
  const iRazon = idx('Denominación Emisor');
  const iTotal = idx('Imp. Total');

  const required = [
    ['Fecha', iFecha],
    ['Tipo', iTipo],
    ['Punto de Venta', iPv],
    ['Número Desde', iNum],
    ['Nro. Doc. Emisor', iCuit],
    ['Imp. Total', iTotal],
  ] as const;
  const missing = required.filter(([, i]) => i === -1).map(([n]) => n);
  if (missing.length) {
    throw new Error('Columnas faltantes en archivo AFIP: ' + missing.join(', '));
  }

  const rows: ComprobanteAfip[] = [];
  const warnings: string[] = [];
  for (let r = headerIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;

    const cuit = normCuit(row[iCuit]);
    if (!cuit) continue;  // skip filas sin CUIT (no son comprobantes válidos)

    const tipo = cleanText(row[iTipo]);
    const letra = extractLetra(tipo);
    const pvRaw = row[iPv];
    const numRaw = row[iNum];

    rows.push({
      fila: r + 1,
      fecha: parseFecha(row[iFecha]),
      tipo,
      letra,
      punto_venta: String(pvRaw ?? '').trim(),
      numero: String(numRaw ?? '').trim(),
      cuit,
      razon_social: cleanText(row[iRazon]),
      importe_total: toMoney(row[iTotal]),
    });
  }

  return { rows, warnings };
}
