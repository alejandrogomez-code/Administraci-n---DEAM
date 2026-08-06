import { createClient } from '@/lib/supabase/client';

/**
 * Unificación de adjuntos entre la auditoría trimestral y el gestor de tareas.
 *
 * Vínculo real (confirmado en la base): la tabla `audit_trimestre_tasks` tiene
 * una columna `tarea_id` que apunta a la fila espejo en `tareas`. El trigger
 * `auto_crear_tarea_desde_audit` la completa al crear la tarea de auditoría.
 *
 * Los adjuntos viven en dos tablas:
 *   - auditoría → `audit_task_attachments` (task_id → audit_trimestre_tasks.id)
 *   - gestor    → `tareas_adjuntos`         (tarea_id → tareas.id)
 *
 * Para mostrar en la auditoría también los adjuntos subidos desde el gestor,
 * cruzamos por `tarea_id`.
 */

export type AdjuntoUnificado = {
  id: string;
  task_id: string;              // id de la tarea de AUDITORÍA (para agrupar en la UI)
  archivo_url: string;
  archivo_nombre: string;
  mime_type: string | null;
  size_bytes: number | null;
  origen: 'auditoria' | 'gestor';
};

/**
 * Trae los adjuntos del gestor para un conjunto de tareas de auditoría,
 * re-etiquetados con el id de la tarea de auditoría correspondiente.
 *
 * @param pares lista de { auditTaskId, tareaId } — tareaId puede ser null
 *              si esa tarea todavía no tiene espejo en el gestor.
 */
export async function adjuntosDelGestor(
  pares: { auditTaskId: string; tareaId: string | null }[],
): Promise<AdjuntoUnificado[]> {
  const validos = pares.filter((p) => p.tareaId) as { auditTaskId: string; tareaId: string }[];
  if (validos.length === 0) return [];

  const supabase = createClient();
  const gestorToAudit = new Map<string, string>();
  for (const p of validos) gestorToAudit.set(p.tareaId, p.auditTaskId);

  const { data, error } = await supabase
    .from('tareas_adjuntos')
    .select('*')
    .in('tarea_id', Array.from(gestorToAudit.keys()));
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
