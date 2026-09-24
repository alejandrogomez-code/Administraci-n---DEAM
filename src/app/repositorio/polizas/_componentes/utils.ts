

export const BUCKET = 'repo-files';
export const DIAS_AVISO = 30; // ventana de "próximo a vencer" / "próximo aviso de baja"

export type Jurisdiccion = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
};

export type Poliza = {
  id: string;
  jurisdiccion_id: string;
  fecha_alta: string | null;      // YYYY-MM-DD
  empresa: string;
  monto_asegurado: number | null;
  vencimiento: string | null;     // YYYY-MM-DD
  fecha_revision: string | null;  // YYYY-MM-DD (revisión de vencimiento)
  aviso_baja: string | null;      // YYYY-MM-DD
  baja_link: string | null;       // link al mail de baja enviado
  poliza_url: string | null;
  poliza_nombre: string | null;
  cert_url: string | null;
  cert_nombre: string | null;
  factura_url: string | null;
  factura_nombre: string | null;
  detalle: string | null;
  finalizada: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
};

export type Estado = 'vigente' | 'vencido' | 'sin_vencimiento';

// ---------- helpers de fecha / estado ----------
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function hoy0(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
export function estadoDe(p: Poliza): Estado {
  if (!p.vencimiento) return 'sin_vencimiento';
  if (parseISODate(p.vencimiento) < hoy0()) return 'vencido';
  return 'vigente';
}

export function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Limpia el nombre para usarlo como clave en Supabase Storage
export function sanitizeKey(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : '';
  const base = dot > 0 ? name.slice(0, dot) : name;
  const clean = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const cleanExt = ext
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.]+/g, '');
  return (clean || 'archivo') + cleanExt;
}

export const ADJUNTOS = [
  { key: 'poliza', urlKey: 'poliza_url', nomKey: 'poliza_nombre', label: 'Póliza' },
  { key: 'cert', urlKey: 'cert_url', nomKey: 'cert_nombre', label: 'Certificación' },
  { key: 'factura', urlKey: 'factura_url', nomKey: 'factura_nombre', label: 'Factura' },
] as const;
export type AdjuntoKey = (typeof ADJUNTOS)[number]['key'];
