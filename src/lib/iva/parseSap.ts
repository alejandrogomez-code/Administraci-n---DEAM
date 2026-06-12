// Parser del archivo "DEAM SRL - IVA COMPRAS" exportado desde SAP.
// Particularidades observadas en el archivo real:
//  - Un mismo comprobante ocupa varias filas (una por alícuota: 21%, 10.5%, exento).
//  - CUIT y Razón Social solo figuran en la primera fila del comprobante (hay que hacer ffill).
//  - La última fila es un total general sin fecha ni Nro → descartar.
//  - El Nro. Comprobante tiene formato AAAA[L]NNN...

import * as XLSX from 'xlsx';
import { ComprobanteSap } from './types';
import { cleanText, extractLetra, normCuit, parseFecha, parseNroSap, toMoney } from './normalize';

export async function parseSap(file: File): Promise<{ rows: ComprobanteSap[]; warnings: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // header en la primera fila no vacía
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const row = rawRows[i].map((c) => String(c ?? '').toLowerCase().trim());
    if (row.includes('nro. comprobante') && row.includes('c.u.i.t.')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('No se pudo detectar la fila de encabezados en el archivo SAP.');
  }

  const headers = rawRows[headerIdx].map((h: any) => String(h ?? '').trim());
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iEmision = idx('Emision');
  const iNro = idx('Nro. Comprobante');
  const iTipo = idx('Tipo Comp.');
  const iRazon = idx('Razon Social');
  const iCuit = idx('C.U.I.T.');
  const iTotal = idx('Total');

  const required = [
    ['Emision', iEmision],
    ['Nro. Comprobante', iNro],
    ['C.U.I.T.', iCuit],
    ['Total', iTotal],
  ] as const;
  const missing = required.filter(([, i]) => i === -1).map(([n]) => n);
  if (missing.length) {
    throw new Error('Columnas faltantes en archivo SAP: ' + missing.join(', '));
  }

  // 1) Forward-fill de CUIT, Razón Social y Tipo cuando vienen vacíos en filas continuadoras
  let lastCuit = '';
  let lastRazon: string | null = null;
  let lastTipo: string | null = null;
  let lastEmision: string | null = null;

  type Raw = {
    fila: number;
    fecha: string | null;
    nro: string;
    tipo: string | null;
    cuit: string;
    razon: string | null;
    total: number;
  };
  const raws: Raw[] = [];

  for (let r = headerIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;

    const nro = cleanText(row[iNro]);
    if (!nro) continue;  // descarta filas sin nro (incluida la fila final de total general)

    const cuitVal = normCuit(row[iCuit]);
    const cuit = cuitVal || lastCuit;
    const razon = cleanText(row[iRazon]) ?? lastRazon;
    const tipo = cleanText(row[iTipo]) ?? lastTipo;
    const emi = parseFecha(row[iEmision]) ?? lastEmision;

    if (cuitVal) { lastCuit = cuitVal; lastRazon = cleanText(row[iRazon]); lastTipo = cleanText(row[iTipo]); lastEmision = parseFecha(row[iEmision]); }

    raws.push({
      fila: r + 1,
      fecha: emi,
      nro,
      tipo,
      cuit,
      razon,
      total: toMoney(row[iTotal]),
    });
  }

  // 2) Agrupar por (nro + cuit) sumando totales
  const groups = new Map<string, { fila: number; fecha: string | null; nro: string; tipo: string | null; cuit: string; razon: string | null; total: number }>();
  for (const r of raws) {
    const k = `${r.nro}|${r.cuit}`;
    const ex = groups.get(k);
    if (ex) {
      ex.total = Math.round((ex.total + r.total) * 100) / 100;
    } else {
      groups.set(k, { ...r });
    }
  }

  const warnings: string[] = [];
  const rows: ComprobanteSap[] = [];
  const grupos = Array.from(groups.values());
  for (const g of grupos) {
    if (!g.cuit) {
      warnings.push(`Comprobante ${g.nro} (fila ${g.fila}) sin CUIT — se omite.`);
      continue;
    }
    const parsed = parseNroSap(g.nro);
    rows.push({
      fila: g.fila,
      fecha: g.fecha,
      tipo: g.tipo,
      letra: parsed.letra ?? extractLetra(g.tipo),
      nro_comprobante: g.nro,
      punto_venta: parsed.pv,
      numero: parsed.num,
      cuit: g.cuit,
      razon_social: g.razon,
      importe_total: g.total,
    });
  }

  return { rows, warnings };
}
