import { createClient } from '@/lib/supabase/client';

/**
 * Descarga un archivo de Supabase Storage forzando el diálogo "Guardar como"
 * y respetando el nombre original.
 *
 * Por qué no usamos el signed URL + <a download>:
 * el atributo `download` se IGNORA cuando el enlace apunta a otro dominio
 * (la app vive en un dominio y Storage en *.supabase.co). El navegador
 * termina navegando al archivo y, con Excel/Word, Edge intenta mostrarlo
 * embebido → "No se pudo cargar el complemento".
 *
 * Solución: bajamos el archivo como Blob con la sesión del usuario (respeta
 * las mismas políticas RLS que createSignedUrl) y lo guardamos desde una URL
 * local `blob:`, que sí es del mismo origen y sí respeta `download`.
 */
export async function descargarDeStorage(
  bucket: string,
  path: string,
  nombre: string | null | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo descargar el archivo.' };
  }

  const nombreFinal = nombre?.trim() || path.split('/').pop() || 'archivo';
  const blobUrl = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = nombreFinal;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Liberar memoria después de que el navegador tomó el archivo
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  return { ok: true };
}
