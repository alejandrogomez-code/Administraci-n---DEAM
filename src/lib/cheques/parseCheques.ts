// Parser del Excel modelo de cheques.
// Acepta columnas: Vencimiento, Asignación, Importe, Librador, Banco, CUIT, Tipo, Status
// La columna A (fecha de venta) se ignora — la fecha de venta se ingresa por UI.

import * as XLSX from 'xlsx';
import { cleanText, normCuit, parseFecha, toMoney } from '../iva/normalize';

export type ChequeRow = {
  fila: number;
  vencimiento: string | null;       // ISO
  asignacion: string | null;
  importe: number;
  librador: string | null;
  banco: string | null;
  cuit: string | null;
  tipo: string | null;
  status: number | null;
};

const HEADERS_REQUERIDOS = ['vencimiento', 'importe'];
const POSIBLES = [
  'vencimiento','asignación','asignacion','importe',
  'librador','banco','cuit','tipo','status','estado',
];

export async function parseCheques(file: File): Promise<{ rows: ChequeRow[]; warnings: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // detectar fila de headers en las primeras 10 filas
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = (rawRows[i] ?? []).map((c) => String(c ?? '').toLowerCase().trim());
    const hits = POSIBLES.filter((h) => row.includes(h)).length;
    if (hits >= 3 && row.includes('vencimiento') && row.includes('importe')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('No se pudo detectar la fila de encabezados. Verificá que tenga columnas Vencimiento e Importe.');

  const headers = (rawRows[headerIdx] ?? []).map((h: any) => String(h ?? '').trim());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (i !== -1) return i;
    }
    return -1;
  };

  const iVenc = idx('Vencimiento');
  const iAsig = idx('Asignación', 'Asignacion');
  const iImp  = idx('Importe');
  const iLib  = idx('Librador');
  const iBan  = idx('Banco');
  const iCuit = idx('CUIT');
  const iTipo = idx('Tipo');
  const iSta  = idx('Status', 'Estado');

  if (iVenc === -1 || iImp === -1) {
    throw new Error('Columnas obligatorias faltantes: Vencimiento e Importe.');
  }

  const rows: ChequeRow[] = [];
  const warnings: string[] = [];

  for (let r = headerIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;

    const venc = parseFecha(row[iVenc]);
    const imp = toMoney(row[iImp]);
    if (!venc) { warnings.push(`Fila ${r + 1}: sin fecha de vencimiento — se omite.`); continue; }
    if (!imp) { warnings.push(`Fila ${r + 1}: importe vacío o inválido.`); }

    let status: number | null = null;
    if (iSta !== -1) {
      const v = row[iSta];
      if (v !== null && v !== '') {
        const n = parseInt(String(v).trim(), 10);
        if (!isNaN(n) && n >= 1 && n <= 8) status = n;
      }
    }

    rows.push({
      fila: r + 1,
      vencimiento: venc,
      asignacion: iAsig !== -1 ? cleanText(row[iAsig]) : null,
      importe: imp,
      librador: iLib !== -1 ? cleanText(row[iLib]) : null,
      banco: iBan !== -1 ? cleanText(row[iBan]) : null,
      cuit: iCuit !== -1 ? (normCuit(row[iCuit]) || null) : null,
      tipo: iTipo !== -1 ? cleanText(row[iTipo]) : null,
      status,
    });
  }

  return { rows, warnings };
}
