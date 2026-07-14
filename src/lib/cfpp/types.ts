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

export type PerfilRiesgo =
  | 'muy_solida'
  | 'pyme_buena'
  | 'mayor_riesgo'
  | 'personalizado';

export type Fuente = {
  id: string;
  ejercicio: Ejercicio;
  mes: Mes;
  tipo: TipoFuente;
  descripcion: string;
  moneda: Moneda;
  saldo: number | null;
  tipo_tasa: TipoTasa;
  tasa: number | null;
  plazo_dias: number | null;
  notas: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ChequeOp = {
  id: string;
  ejercicio: Ejercicio;
  fecha: string | null;
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
  sofr: number | null;
  riesgo_perfil: PerfilRiesgo;
  riesgo_spread: number | null;
  notas: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

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

// Perfiles de riesgo empresario para la referencia SOFR + spread.
// El "spread" es el add-on que se suma a SOFR.
export const PERFILES_RIESGO: { v: PerfilRiesgo; l: string; spread: number | null; desc: string }[] = [
  { v: 'muy_solida',    l: 'Empresa muy sólida', spread: 1.5, desc: 'Corporativa AAA/AA con acceso a mercado internacional' },
  { v: 'pyme_buena',    l: 'PyME buena',         spread: 3.0, desc: 'PyME con historial sólido y buen rating crediticio' },
  { v: 'mayor_riesgo',  l: 'Mayor riesgo',       spread: 5.0, desc: 'Empresa con mayor volatilidad o menor historial' },
  { v: 'personalizado', l: 'Personalizado',      spread: null, desc: 'Definí manualmente el spread sobre SOFR' },
];
