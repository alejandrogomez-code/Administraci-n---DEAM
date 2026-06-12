// Formato Argentina: punto miles, coma decimal
export function fmtMoney(n: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (n === null || n === undefined || isNaN(n as number)) return '-';
  const num = Number(n);
  const s = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  if (opts.sign && num > 0) return '+$ ' + s;
  if (num < 0) return '-$ ' + s.replace('-', '');
  return '$ ' + s;
}

export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n as number)) return '-';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(n));
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '-';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

// Período YYYY-MM ↔ {mes, anio}
export function periodoToParts(p: string): { mes: number; anio: number } | null {
  const m = p.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  return { anio: parseInt(m[1], 10), mes: parseInt(m[2], 10) };
}
export function partsToPeriodo(mes: number, anio: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}
