import { type Ejercicio, type Benchmarks } from '@/lib/cfpp/types';

export type Tab = 'datos' | 'resultados' | 'ayuda';

export const EJERCICIOS_DEFAULT: Ejercicio[] = ['2026-2027'];

export const BENCHMARKS_VACIO = (ej: Ejercicio): Benchmarks => ({
  ejercicio: ej,
  inflacion: null,
  devaluacion: null,
  badlar: null,
  sofr: null,
  riesgo_perfil: 'pyme_buena',
  riesgo_spread: 3.0,
  notas: '',
});
