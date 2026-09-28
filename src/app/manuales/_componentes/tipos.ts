export type Seccion = 'odoo' | 'interno';

export type Modulo = {
  id: string;
  seccion: Seccion;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
};

export type Manual = {
  id: string;
  titulo: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  link: string | null;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  modulo_id: string | null;
  tema: string | null;
  descripcion: string | null;
  tipos: string[] | null;
  palabras_clave: string | null;
};

export type TipoRecurso = 'pdf' | 'excel' | 'video' | 'link' | 'archivo';

export const TIPO_LABEL: Record<TipoRecurso, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  video: 'Video',
  link: 'Link',
  archivo: 'Archivo',
};

/** Tipos que se pueden marcar a mano en el formulario. */
export const TIPOS_ELEGIBLES: TipoRecurso[] = ['pdf', 'excel', 'video', 'link'];

export const SECCION_LABEL: Record<Seccion, string> = {
  odoo: 'Odoo',
  interno: 'Manuales internos',
};

export const BUCKET = 'manual-files';

const LINK_VIDEO = /youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.(mp4|webm|mov)(\?|$)/i;
const EXT_VIDEO = ['mp4', 'mov', 'webm', 'm4v', 'avi'];
const EXT_EXCEL = ['xlsx', 'xls', 'xlsm', 'xlsb', 'csv'];

/** Deduce el tipo a partir del archivo y el link (se usa si el manual no tiene tipos cargados). */
export function deducirTipos(archivoNombre: string | null | undefined, link: string | null | undefined): TipoRecurso[] {
  const t: TipoRecurso[] = [];
  if (archivoNombre) {
    const ext = archivoNombre.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') t.push('pdf');
    else if (EXT_EXCEL.includes(ext)) t.push('excel');
    else if (EXT_VIDEO.includes(ext)) t.push('video');
    else t.push('archivo');
  }
  if (link?.trim()) {
    const tipo: TipoRecurso = LINK_VIDEO.test(link) ? 'video' : 'link';
    if (!t.includes(tipo)) t.push(tipo);
  }
  return t;
}

export function tiposDe(m: Pick<Manual, 'tipos' | 'archivo_nombre' | 'link'>): TipoRecurso[] {
  if (m.tipos && m.tipos.length) return m.tipos as TipoRecurso[];
  return deducirTipos(m.archivo_nombre, m.link);
}

/** Minúsculas y sin tildes, para buscar "conciliacion" y encontrar "Conciliación". */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Todas las palabras buscadas tienen que aparecer en algún campo del manual. */
export function coincide(m: Manual, busqueda: string, modulo?: Modulo): boolean {
  const q = normalizar(busqueda).trim();
  if (!q) return true;
  const texto = normalizar(
    [m.titulo, m.descripcion, m.tema, m.palabras_clave, m.observaciones, m.archivo_nombre, modulo?.nombre]
      .filter(Boolean)
      .join(' '),
  );
  return q.split(/\s+/).every((p) => texto.includes(p));
}

export function manualVacio(moduloId: string | null = null): Manual {
  return {
    id: '', titulo: '', archivo_url: null, archivo_nombre: null, link: '', observaciones: '',
    activo: true, created_at: '', updated_at: '',
    modulo_id: moduloId, tema: '', descripcion: '', tipos: [], palabras_clave: '',
  };
}

/** Temas ya usados en cada módulo, para sugerirlos en el formulario. */
export function temasPorModulo(items: Manual[]): Record<string, string[]> {
  const r: Record<string, Set<string>> = {};
  for (const m of items) {
    if (!m.modulo_id || !m.tema?.trim()) continue;
    (r[m.modulo_id] ??= new Set()).add(m.tema.trim());
  }
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.from(v).sort()]));
}
