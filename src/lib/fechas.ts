// Fechas en formato YYYY-MM-DD calculadas en horario de Argentina,
// así el servidor (UTC) y el navegador coinciden en qué es "hoy".
const TZ = 'America/Argentina/Buenos_Aires';

export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_ABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function diaSemana(iso: string): number {
  return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay();
}

/** "Jueves, 24 de septiembre" */
export function fechaLarga(iso: string): string {
  const d = DIAS[diaSemana(iso)];
  return `${d[0].toUpperCase()}${d.slice(1)}, ${+iso.slice(8, 10)} de ${MESES[+iso.slice(5, 7) - 1]}`;
}

export function nombreMesLargo(mes: number): string {
  const m = MESES[mes - 1] ?? '';
  return m ? m[0].toUpperCase() + m.slice(1) : '';
}

/** Saludo según la hora de Argentina. */
export function saludo(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Texto relativo de vencimiento: "Vencida hace 3 días", "Hoy", "Vence en 2 días", "Sin fecha". */
export function textoVencimiento(fecha: string | null, hoy = hoyISO()): { texto: string; tono: 'vencido' | 'hoy' | 'pronto' | 'futuro' | 'sin' } {
  if (!fecha) return { texto: 'Sin fecha', tono: 'sin' };
  const d = diasEntre(hoy, fecha);
  if (d < 0) return { texto: d === -1 ? 'Vencida ayer' : `Vencida hace ${-d} días`, tono: 'vencido' };
  if (d === 0) return { texto: 'Vence hoy', tono: 'hoy' };
  if (d === 1) return { texto: 'Vence mañana', tono: 'pronto' };
  if (d <= 7) return { texto: `Vence en ${d} días`, tono: 'pronto' };
  return { texto: `Vence en ${d} días`, tono: 'futuro' };
}
