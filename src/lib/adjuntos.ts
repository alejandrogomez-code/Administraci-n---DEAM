import { createClient } from '@/lib/supabase/client';

/**
 * Unificación de adjuntos entre la auditoría trimestral y el gestor de tareas.
 *
 * Contexto: un trigger en la base copia cada fila de `audit_trimestre_tasks`
 * a la tabla `tareas` del gestor. Los adjuntos, sin embargo, viven en dos
 * lugares distintos:
 *   - auditoría → tabla `audit_task_attachments` (task_id → audit_trimestre_tasks.id)
 *   - gestor    → tabla `tareas_adjuntos`        (tarea_id → tareas.id)
 *
 * Para que la auditoría muestre TAMBIÉN los adjuntos subidos desde el gestor,
 * necesitamos mapear cada tarea de auditoría con su tarea-espejo en `tareas`.
 * Como el nombre de la columna de vínculo depende de cómo esté hecho el
 * trigger, este helper lo descubre probando los candidatos más habituales.
 */

// Posibles columnas en `tareas` que apuntan a la tarea de auditoría de origen.
const CANDIDATAS_EN_TAREAS = [
  'audit_task_id', 'audit_trimestre_task_id', 'origen_id', 'source_id',
  'external_id', 'ref_id', 'audit_id', 'origen_task_id',
];

export type AdjuntoUnificado = {
  id: string;
  task_id: string;              // id de la tarea de auditoría (para agrupar)
  archivo_url: string;
  archivo_nombre: string;
  mime_type: string | null;
  size_bytes: number | null;
  origen: 'auditoria' | 'gestor';
};

/**
 * Dado un conjunto de ids de tareas de auditoría, devuelve un Map
 *   auditTaskId → tareaGestorId
 * resolviendo el vínculo del trigger. Devuelve Map vacío si no lo encuentra.
 */
export async function mapearTareasGestor(auditTaskIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (auditTaskIds.length === 0) return out;
  const supabase = createClient();

  for (const col of CANDIDATAS_EN_TAREAS) {
    const { data, error } = await supabase
      .from('tareas')
      .select(`id, ${col}`)
      .in(col, auditTaskIds);
    // Si la columna no existe, Supabase devuelve error → probamos la siguiente.
    if (error) continue;
    if (data && data.length > 0) {
      for (const row of data as any[]) {
        if (row[col]) out.set(row[col] as string, row.id as string);
      }
      if (out.size > 0) return out; // encontramos la columna correcta
    }
  }
  return out;
}

/**
 * Trae adjuntos del gestor (`tareas_adjuntos`) para las tareas-espejo,
 * re-etiquetados con el id de la tarea de AUDITORÍA para poder agruparlos
 * junto a los adjuntos propios.
 */
export async function adjuntosDelGestor(
  mapaAuditAGestor: Map<string, string>,
): Promise<AdjuntoUnificado[]> {
  if (mapaAuditAGestor.size === 0) return [];
  const supabase = createClient();

  const gestorIds = Array.from(mapaAuditAGestor.values());
  const gestorToAudit = new Map<string, string>();
  for (const [auditId, gestorId] of mapaAuditAGestor.entries()) {
    gestorToAudit.set(gestorId, auditId);
  }

  const { data, error } = await supabase
    .from('tareas_adjuntos')
    .select('*')
    .in('tarea_id', gestorIds);
  if (error || !data) return [];

  return (data as any[]).map((a) => ({
    id: a.id,
    task_id: gestorToAudit.get(a.tarea_id) ?? a.tarea_id,
    archivo_url: a.archivo_url,
    archivo_nombre: a.archivo_nombre,
    mime_type: a.mime_type ?? null,
    size_bytes: a.size_bytes ?? null,
    origen: 'gestor' as const,
  }));
}

/**
 * Genera un enlace firmado para descargar un adjunto, eligiendo el bucket
 * según el origen: `audit-files` para auditoría, `tarea-files` para gestor.
 */
export async function urlFirmada(archivoUrl: string, origen: 'auditoria' | 'gestor'): Promise<string | null> {
  const supabase = createClient();
  const bucket = origen === 'gestor' ? 'tarea-files' : 'audit-files';
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(archivoUrl, 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
