

/* =====================================================================
   TIPOS
   ===================================================================== */

export type Estado = 'sin_iniciar' | 'urgente' | 'en_proceso' | 'completo';
export type Recurrencia = 'no_se_repite' | 'diaria' | 'semanal' | 'mensual' | 'anual';

export type Tarea = {
  id: string;
  numero: number;
  titulo: string;
  estado: Estado;
  vencimiento: string | null;
  responsable_id: string | null;
  recurrencia: Recurrencia;
  url: string | null;
  detalle: string | null;
  created_at: string;
  updated_at: string;
};

export type Subtarea = {
  id: string;
  tarea_id: string;
  titulo: string;
  responsable_id: string | null;
  completa: boolean;
  orden: number;
};

export type Adjunto = {
  id: string;
  tarea_id: string;
  archivo_url: string;
  archivo_nombre: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type Miembro = { id: string; nombre: string };

export type Vista = 'tabla' | 'kanban';
export type Agrupacion = 'ninguna' | 'responsable' | 'estado';
export type FiltroVenc = 'cualquiera' | 'vencidas' | 'hoy' | 'esta_semana' | 'este_mes' | 'sin_fecha';

/* =====================================================================
   CONSTANTES DE ESTADO
   ===================================================================== */

export const ESTADOS: { id: Estado; label: string; color: string; bg: string }[] = [
  { id: 'sin_iniciar', label: 'Sin iniciar', color: 'text-muted',   bg: 'bg-muted/15' },
  { id: 'urgente',     label: 'Urgente',     color: 'text-danger',  bg: 'bg-danger/15' },
  { id: 'en_proceso',  label: 'En proceso',  color: 'text-accent',  bg: 'bg-accent/15' },
  { id: 'completo',    label: 'Completo',    color: 'text-success', bg: 'bg-success/15' },
];

export const RECURRENCIAS: { id: Recurrencia; label: string }[] = [
  { id: 'no_se_repite', label: 'No se repite' },
  { id: 'diaria',       label: 'Diaria' },
  { id: 'semanal',      label: 'Semanal' },
  { id: 'mensual',      label: 'Mensual' },
  { id: 'anual',        label: 'Anual' },
];

export function estadoInfo(id: Estado) { return ESTADOS.find((e) => e.id === id) ?? ESTADOS[0]; }

/* =====================================================================
   HELPERS
   ===================================================================== */

export function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const dias = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${m[3]}-${dias[parseInt(m[2], 10) - 1]}`;
}

export function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
