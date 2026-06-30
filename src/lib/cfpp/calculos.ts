// src/lib/cfpp/calculos.ts
// Funciones puras del módulo CFPP.

import type {
  Ejercicio,
  Mes,
  Moneda,
  Fuente,
  ChequeOp,
  Benchmarks,
  TipoTasa,
} from './types';

// ============ EJERCICIO FISCAL DEAM: ABRIL → MARZO ============
export function mesesDeEjercicio(ej: Ejercicio): Mes[] {
  const [a1, a2] = ej.split('-').map(Number);
  const out: Mes[] = [];
  for (let m = 4; m <= 12; m++) out.push(`${a1}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) out.push(`${a2}-${String(m).padStart(2, '0')}`);
  return out;
}

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function nombreMesAbr(yyyymm: string): string {
  const [a, m] = yyyymm.split('-').map(Number);
  return `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}`;
}

// ============ PARSE / FORMAT NÚMEROS AR ============
export function parseNum(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null;
  if (typeof s === 'number') return isNaN(s) ? null : s;
  const clean = String(s).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

export function fmtPct(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';
}

export function fmtMoney(n: number | null | undefined, moneda: Moneda = 'ARS'): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const prefix = moneda === 'USD' ? 'US$ ' : '$ ';
  return prefix + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtNumLocal(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtPpts(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;
}

// ============ CONVERSIÓN DE TASAS → TEA ============
export function convertirATEA(tasaPct: number | null, tipo: TipoTasa): number | null {
  if (tasaPct === null || isNaN(tasaPct)) return null;
  const t = tasaPct / 100;
  switch (tipo) {
    case 'tea':
    case 'cft_a':
      return tasaPct;
    case 'tna_vencida':
      return (Math.pow(1 + t / 12, 12) - 1) * 100;
    case 'tna_adelantada': {
      const iAdM = t / 12;
      if (iAdM >= 1) return null;
      const iVM = iAdM / (1 - iAdM);
      return (Math.pow(1 + iVM, 12) - 1) * 100;
    }
    case 'tem':
      return (Math.pow(1 + t, 12) - 1) * 100;
    case 'tasa_diaria':
      return (Math.pow(1 + t, 365) - 1) * 100;
    default:
      return tasaPct;
  }
}

// ============ VENTA DE CHEQUES ============
export function calcularTasaDescuentoCheque(c: Pick<ChequeOp, 'bruto' | 'neto'>): number | null {
  const bruto = c.bruto;
  const neto = c.neto;
  if (!bruto || !neto || bruto <= 0) return null;
  return ((bruto - neto) / bruto) * 100;
}

export function calcularTEACheque(
  c: Pick<ChequeOp, 'bruto' | 'neto' | 'plazo_dias'>
): number | null {
  const bruto = c.bruto;
  const neto = c.neto;
  const plazo = c.plazo_dias;
  if (!bruto || !neto || !plazo || neto <= 0 || plazo <= 0) return null;
  return (Math.pow(bruto / neto, 365 / plazo) - 1) * 100;
}

// Distribuye el monto neto del cheque entre los meses pendientes de cobro.
// Devuelve [{ mes: "YYYY-MM", saldoPromedio, diasPendientes }]
export function distribuirCheque(c: ChequeOp): Array<{ mes: Mes; saldoPromedio: number; diasPendientes: number }> {
  const neto = c.neto;
  const plazo = c.plazo_dias;
  if (!c.fecha || !neto || !plazo || plazo <= 0) return [];

  const fechaVenta = new Date(c.fecha + 'T00:00:00');
  if (isNaN(fechaVenta.getTime())) return [];

  const fechaVto = new Date(fechaVenta);
  fechaVto.setDate(fechaVto.getDate() + Math.round(plazo));

  const distribuciones: Array<{ mes: Mes; saldoPromedio: number; diasPendientes: number }> = [];
  let cursorAño = fechaVenta.getFullYear();
  let cursorMes = fechaVenta.getMonth();

  let iter = 0;
  while (iter++ < 60) {
    const inicioMes = new Date(cursorAño, cursorMes, 1);
    const finMes = new Date(cursorAño, cursorMes + 1, 0);
    const diasDelMes = finMes.getDate();

    const inicioPeriodo = fechaVenta > inicioMes ? fechaVenta : inicioMes;
    const finPeriodo = fechaVto < finMes ? fechaVto : finMes;

    if (finPeriodo >= inicioPeriodo) {
      const diasPendientes = Math.floor((finPeriodo.getTime() - inicioPeriodo.getTime()) / 86400000) + 1;
      const saldoPromedio = neto * (diasPendientes / diasDelMes);
      const mesKey = `${cursorAño}-${String(cursorMes + 1).padStart(2, '0')}`;
      distribuciones.push({ mes: mesKey, saldoPromedio, diasPendientes });
    }

    if (inicioMes > fechaVto) break;

    cursorMes++;
    if (cursorMes > 11) { cursorMes = 0; cursorAño++; }
  }

  return distribuciones;
}

// ============ COMPONENTES UNIFICADOS POR MES ============
// Para un mes dado, combina fuentes generales + cheques distribuidos a ese mes.
export type Componente = {
  saldo: number;
  tea: number;
  moneda: Moneda;
  tipo: string;
  entidad: string;
  plazoDias: number | null;
};

export function componentesDelMes(
  mes: Mes,
  fuentes: Fuente[],
  cheques: ChequeOp[]
): Componente[] {
  const out: Componente[] = [];

  // Fuentes generales del mes
  fuentes.filter(f => f.mes === mes).forEach(f => {
    const tea = convertirATEA(f.tasa, f.tipo_tasa);
    if (f.saldo && f.saldo > 0 && tea !== null) {
      out.push({
        saldo: f.saldo,
        tea,
        moneda: f.moneda,
        tipo: f.tipo,
        entidad: (f.descripcion || '').trim() || '(sin nombre)',
        plazoDias: f.plazo_dias,
      });
    }
  });

  // Cheques distribuidos
  cheques.forEach(c => {
    const tea = calcularTEACheque(c);
    if (tea === null) return;
    const dist = distribuirCheque(c);
    const enMes = dist.find(d => d.mes === mes);
    if (enMes && enMes.saldoPromedio > 0) {
      out.push({
        saldo: enMes.saldoPromedio,
        tea,
        moneda: 'ARS',
        tipo: 'cheques',
        entidad: (c.entidad || '').trim() || 'Venta cheques',
        plazoDias: c.plazo_dias,
      });
    }
  });

  return out;
}

// ============ CFPP MENSUAL ============
export type ResumenMes = {
  mes: Mes;
  ars: { saldo: number; cfpp: number | null; plazo: number | null };
  usd: { saldo: number; cfpp: number | null; plazo: number | null };
  nFuentes: number;
};

function ponderar(arr: Componente[]) {
  let numTea = 0, den = 0, numPlazo = 0, denPlazo = 0;
  arr.forEach(c => {
    numTea += c.saldo * c.tea;
    den += c.saldo;
    if (c.plazoDias !== null && !isNaN(c.plazoDias)) {
      numPlazo += c.saldo * c.plazoDias;
      denPlazo += c.saldo;
    }
  });
  return {
    saldo: den,
    cfpp: den > 0 ? numTea / den : null,
    plazo: denPlazo > 0 ? numPlazo / denPlazo : null,
  };
}

export function calcularPorMes(ej: Ejercicio, fuentes: Fuente[], cheques: ChequeOp[]): ResumenMes[] {
  return mesesDeEjercicio(ej).map(mes => {
    const comps = componentesDelMes(mes, fuentes, cheques);
    return {
      mes,
      ars: ponderar(comps.filter(c => c.moneda === 'ARS')),
      usd: ponderar(comps.filter(c => c.moneda === 'USD')),
      nFuentes: comps.length,
    };
  });
}

// ============ CFPP DEL EJERCICIO + SPREADS ============
export type ResumenEjercicio = {
  cfppArs: number | null;
  cfppUsd: number | null;
  plazoArs: number | null;
  cfppReal: number | null;
  spreadInflacion: number | null;
  spreadBadlar: number | null;
  spreadDevaluacion: number | null;
  arsDen: number;
  usdDen: number;
};

export function calcularEjercicio(
  ej: Ejercicio,
  fuentes: Fuente[],
  cheques: ChequeOp[],
  benchmarks: Benchmarks
): ResumenEjercicio {
  let arsNum = 0, arsDen = 0, arsPlazoNum = 0, arsPlazoDen = 0;
  let usdNum = 0, usdDen = 0;

  mesesDeEjercicio(ej).forEach(mes => {
    componentesDelMes(mes, fuentes, cheques).forEach(c => {
      if (c.moneda === 'ARS') {
        arsNum += c.saldo * c.tea;
        arsDen += c.saldo;
        if (c.plazoDias !== null && !isNaN(c.plazoDias)) {
          arsPlazoNum += c.saldo * c.plazoDias;
          arsPlazoDen += c.saldo;
        }
      } else if (c.moneda === 'USD') {
        usdNum += c.saldo * c.tea;
        usdDen += c.saldo;
      }
    });
  });

  const cfppArs = arsDen > 0 ? arsNum / arsDen : null;
  const cfppUsd = usdDen > 0 ? usdNum / usdDen : null;
  const plazoArs = arsPlazoDen > 0 ? arsPlazoNum / arsPlazoDen : null;

  const inflacion = benchmarks.inflacion;
  const badlar = benchmarks.badlar;
  const devaluacion = benchmarks.devaluacion;

  const cfppReal = (cfppArs !== null && inflacion !== null && inflacion > -100)
    ? ((1 + cfppArs / 100) / (1 + inflacion / 100) - 1) * 100
    : null;

  return {
    cfppArs, cfppUsd, plazoArs, cfppReal,
    spreadInflacion: (cfppArs !== null && inflacion !== null) ? cfppArs - inflacion : null,
    spreadBadlar: (cfppArs !== null && badlar !== null) ? cfppArs - badlar : null,
    spreadDevaluacion: (cfppUsd !== null && devaluacion !== null) ? cfppUsd - devaluacion : null,
    arsDen, usdDen,
  };
}

// ============ CONCENTRACIÓN POR ENTIDAD / POR TIPO ============
export type GrupoConcentracion = {
  clave: string;
  saldo: number;
  pct: number;
  tea: number | null;
};

function agrupar(
  ej: Ejercicio,
  fuentes: Fuente[],
  cheques: ChequeOp[],
  moneda: Moneda,
  fnClave: (c: Componente) => string
): GrupoConcentracion[] {
  const map = new Map<string, { saldoTotal: number; teaPond: number }>();
  mesesDeEjercicio(ej).forEach(mes => {
    componentesDelMes(mes, fuentes, cheques)
      .filter(c => c.moneda === moneda)
      .forEach(c => {
        const k = fnClave(c);
        if (!map.has(k)) map.set(k, { saldoTotal: 0, teaPond: 0 });
        const r = map.get(k)!;
        r.saldoTotal += c.saldo;
        r.teaPond += c.saldo * c.tea;
      });
  });
  const total = [...map.values()].reduce((a, b) => a + b.saldoTotal, 0);
  return [...map.entries()].map(([clave, v]) => ({
    clave,
    saldo: v.saldoTotal,
    pct: total > 0 ? (v.saldoTotal / total) * 100 : 0,
    tea: v.saldoTotal > 0 ? v.teaPond / v.saldoTotal : null,
  })).sort((a, b) => b.saldo - a.saldo);
}

export function calcularConcentracion(
  ej: Ejercicio, fuentes: Fuente[], cheques: ChequeOp[], moneda: Moneda = 'ARS'
): GrupoConcentracion[] {
  return agrupar(ej, fuentes, cheques, moneda, c => c.entidad);
}

const ETIQUETAS_TIPO: Record<string, string> = {
  prestamo: 'Préstamo',
  adelanto: 'Adelanto cta. cte.',
  comex: 'Financ. comex',
  proveedores: 'Proveedores',
  leasing: 'Leasing',
  otro: 'Otro',
  cheques: 'Venta cheques',
};

export function calcularPorTipo(
  ej: Ejercicio, fuentes: Fuente[], cheques: ChequeOp[], moneda: Moneda = 'ARS'
): GrupoConcentracion[] {
  return agrupar(ej, fuentes, cheques, moneda, c => ETIQUETAS_TIPO[c.tipo] || c.tipo);
}
