// Normalizadores compartidos para parseo de Excel

export function normCuit(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/[^0-9]/g, '');
  return s;
}

// Limpia un texto, convierte vacío a null
export function cleanText(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Convierte número con coma decimal o punto a Number, redondeado a 2 decimales
export function toMoney(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  let s = String(v).trim();
  if (s === '') return 0;
  // Eliminar separadores de miles (puede haber "1.234,56" o "1,234.56")
  if (s.includes(',') && s.includes('.')) {
    // detectar separador decimal por la última posición
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // formato europeo: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // solo coma -> es decimal
    s = s.replace(',', '.');
  }
  const n = Number(s);
  if (isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
}

// Parsea fechas: Date, número de Excel, 'dd/mm/yyyy', 'yyyy-mm-dd' → ISO 'yyyy-mm-dd'
export function parseFecha(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // Excel serial date (días desde 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  // yyyy-mm-dd
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  // dd-mm-yy
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m) {
    const yyyy = '20' + m[3];
    return `${yyyy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

// Extrae la letra de un tipo de comprobante (Factura A, NC B, '1 - Factura A', 'FC A', etc)
export function extractLetra(tipo: string | null): string | null {
  if (!tipo) return null;
  const m = tipo.match(/\b([ABCEM])\b/i);
  return m ? m[1].toUpperCase() : null;
}

// Parsea un Nro. de Comprobante SAP estilo '0009A01180703' → { pv: '0009', letra: 'A', num: '01180703' }
// Tolera variantes con 4 dígitos PV y formato AAAA[L]NNNNNNNN
export function parseNroSap(nro: string): { pv: string; letra: string | null; num: string } {
  const s = String(nro).trim();
  // formato AAAA[L]NNN... (PV 4-5 dígitos, letra opcional, número resto)
  const m = s.match(/^(\d{4,5})([A-Z]?)(\d+)$/i);
  if (m) {
    return { pv: m[1].replace(/^0+/, '') || '0', letra: m[2] ? m[2].toUpperCase() : null, num: m[3].replace(/^0+/, '') || '0' };
  }
  // si no matchea formato esperado, devolver string entera como número
  return { pv: '', letra: null, num: s };
}

// Clave normalizada de matcheo: CUIT-PV-NUM-LETRA (sin ceros a la izquierda)
export function matchKey(p: { cuit: string; punto_venta: string; numero: string; letra: string | null }): string {
  const pv = (p.punto_venta || '').replace(/^0+/, '') || '0';
  const num = (p.numero || '').replace(/^0+/, '') || '0';
  const letra = p.letra || '_';
  return `${p.cuit}|${pv}|${num}|${letra}`;
}
