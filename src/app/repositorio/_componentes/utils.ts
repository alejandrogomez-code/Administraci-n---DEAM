

export const BUCKET = 'repo-files';
export const DIAS_AVISO = 30; // ventana de "próximo a vencer"

export type Jurisdiccion = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
};

export type Documento = {
  id: string;
  jurisdiccion_id: string;
  documento: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  url: string | null;
  vencimiento: string | null; // YYYY-MM-DD
  detalle: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
};

export type Estado = 'vigente' | 'vencido' | 'sin_documento';

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
export function tieneDocumento(d: Documento): boolean {
  return !!d.archivo_url || !!(d.url && d.url.trim());
}
export function estadoDe(d: Documento): Estado {
  if (!tieneDocumento(d)) return 'sin_documento';
  if (d.vencimiento && parseISODate(d.vencimiento) < hoy0()) return 'vencido';
  return 'vigente';
}

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

// Normaliza para buscar sin distinguir acentos ni mayúsculas
export function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'jurisdiccion';
}
