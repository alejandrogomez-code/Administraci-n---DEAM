// src/lib/cfpp/types.ts
// Tipos del módulo Costo Financiero Promedio Ponderado.

export type Ejercicio = string; // "YYYY-YYYY"
export type Mes = string;       // "YYYY-MM"

export type Moneda = 'ARS' | 'USD';

export type TipoFuente =
  | 'prestamo'
  | 'adelanto'
  | 'comex'
  | 'proveedores'
  | 'leasing'
  | 'otro';

export type TipoTasa =
  | 'tea'             // efectiva anual
  | 'tna_vencida'     // nominal anual vencida, cap. mensual
  | 'tna_adelantada'  // nominal anual adelantada, cap. mensual
  | 'tem'             // efectiva mensual
  | 'tasa_diaria'     // efectiva diaria
  | 'cft_a';          // CFT anual (equivalente a TEA)

export type Fuente = {
  id: string;
  ejercicio: Ejercicio;
  mes: Mes;
  tipo: TipoFuente;
  descripcion: string;
  moneda: Moneda;
  saldo: number | null;       // saldo capital al cierre del mes
  tipo_tasa: TipoTasa;
  tasa: number | null;        // valor en %, según tipo_tasa
  plazo_dias: number | null;
  notas: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ChequeOp = {
  id: string;
  ejercicio: Ejercicio;
  fecha: string | null;       // YYYY-MM-DD
  entidad: string;
  bruto: number | null;
  neto: number | null;
  plazo_dias: number | null;
  notas: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type Benchmarks = {
  id?: string;
  ejercicio: Ejercicio;
  inflacion: number | null;
  devaluacion: number | null;
  badlar: number | null;
  notas: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

// Catálogos de opciones (para selects)
export const TIPOS_FUENTE: { v: TipoFuente; l: string }[] = [
  { v: 'prestamo',    l: 'Préstamo' },
  { v: 'adelanto',    l: 'Adelanto cta. cte.' },
  { v: 'comex',       l: 'Financ. comex' },
  { v: 'proveedores', l: 'Proveedores' },
  { v: 'leasing',     l: 'Leasing' },
  { v: 'otro',        l: 'Otro' },
];

export const TIPOS_TASA: { v: TipoTasa; l: string }[] = [
  { v: 'tea',            l: 'TEA (efectiva anual)' },
  { v: 'tna_vencida',    l: 'TNA vencida (cap. mensual)' },
  { v: 'tna_adelantada', l: 'TNA adelantada (cap. mensual)' },
  { v: 'tem',            l: 'TEM (efectiva mensual)' },
  { v: 'tasa_diaria',    l: 'Tasa efectiva diaria' },
  { v: 'cft_a',          l: 'CFT-A (anual efectivo)' },
];
