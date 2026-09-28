import { createClient } from '@/lib/supabase/client';
import { descargarDeStorage } from '@/lib/storage/descargar';
import { avisar, confirmar } from '@/components/feedback';
import { BUCKET, Manual, tiposDe } from './tipos';

/** Los PDF se abren en una pestaña nueva; el resto de los archivos se descargan. */
export async function abrirArchivo(m: Manual) {
  if (!m.archivo_url) return;
  const esPdf = /\.pdf$/i.test(m.archivo_nombre ?? m.archivo_url);
  if (!esPdf) {
    const r = await descargarDeStorage(BUCKET, m.archivo_url, m.archivo_nombre);
    if (!r.ok) avisar(r.error ?? 'No se pudo descargar el archivo.', 'error');
    return;
  }
  // La pestaña se abre antes del await para que el navegador no la bloquee como popup.
  const pestana = window.open('', '_blank');
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(m.archivo_url, 300);
  if (error || !data?.signedUrl) {
    pestana?.close();
    avisar('No se pudo abrir el archivo.', 'error');
    return;
  }
  if (pestana) pestana.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

export function abrirLink(m: Manual) {
  if (m.link) window.open(m.link, '_blank', 'noopener,noreferrer');
}

/** Acción principal al hacer clic en el título: el video o link si es lo principal, si no el archivo. */
export function abrir(m: Manual) {
  const tipos = tiposDe(m);
  if (m.link && (tipos.includes('video') || !m.archivo_url)) return abrirLink(m);
  if (m.archivo_url) return abrirArchivo(m);
  avisar('Este manual no tiene archivo ni link cargado.', 'aviso');
}

export async function eliminarManual(m: Manual): Promise<boolean> {
  const ok = await confirmar(`¿Eliminar "${m.titulo}"? También se eliminará el archivo adjunto si existe.`);
  if (!ok) return false;
  const supabase = createClient();
  const { error } = await supabase.from('manuales').delete().eq('id', m.id);
  if (error) { avisar(error.message, 'error'); return false; }
  if (m.archivo_url) await supabase.storage.from(BUCKET).remove([m.archivo_url]);
  avisar('Manual eliminado.');
  return true;
}
