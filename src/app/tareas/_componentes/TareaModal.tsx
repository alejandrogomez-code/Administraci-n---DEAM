'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { avisar, confirmar } from '@/components/feedback';
import { Adjunto, ESTADOS, Estado, Miembro, RECURRENCIAS, Recurrencia, Subtarea, Tarea } from './tipos';

/* =====================================================================
   MODAL DE DETALLE DE TAREA
   ===================================================================== */

export function TareaModal({ tareaId, miembros, onClose }: {
  tareaId: string;
  miembros: Miembro[];
  onClose: () => void;
}) {
  const supabase = createClient();
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [subs, setSubs] = useState<Subtarea[]>([]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaSub, setNuevaSub] = useState('');
  const [savingHint, setSavingHint] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: s }, { data: a }] = await Promise.all([
      supabase.from('tareas').select('*').eq('id', tareaId).single(),
      supabase.from('tareas_subtareas').select('*').eq('tarea_id', tareaId).order('orden'),
      supabase.from('tareas_adjuntos').select('*').eq('tarea_id', tareaId).order('created_at'),
    ]);
    setTarea(t as any);
    setSubs((s as any) ?? []);
    setAdjuntos((a as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tareaId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function actualizar(cambios: Partial<Tarea>) {
    if (!tarea) return;
    setSavingHint(true);
    await supabase.from('tareas').update(cambios).eq('id', tarea.id);
    setTarea({ ...tarea, ...cambios });
    setTimeout(() => setSavingHint(false), 400);
  }

  async function eliminarTarea() {
    if (!tarea) return;
    if (!(await confirmar(`¿Eliminar la tarea "${tarea.titulo}" y todas sus subtareas y adjuntos?`))) return;
    // borrar adjuntos de storage
    if (adjuntos.length > 0) {
      const paths = adjuntos.map((a) => a.archivo_url);
      await supabase.storage.from('tarea-files').remove(paths);
    }
    await supabase.from('tareas').delete().eq('id', tarea.id);
    onClose();
  }

  async function agregarSubtarea() {
    if (!nuevaSub.trim()) return;
    const orden = subs.length ? Math.max(...subs.map((s) => s.orden)) + 1 : 0;
    const { data, error } = await supabase.from('tareas_subtareas').insert({
      tarea_id: tareaId, titulo: nuevaSub.trim(), orden, completa: false,
    }).select('*').single();
    if (error) { avisar(error.message); return; }
    setSubs((arr) => [...arr, data as any]);
    setNuevaSub('');
  }

  async function actualizarSub(s: Subtarea, cambios: Partial<Subtarea>) {
    await supabase.from('tareas_subtareas').update(cambios).eq('id', s.id);
    setSubs((arr) => arr.map((x) => x.id === s.id ? { ...x, ...cambios } : x));
  }

  async function eliminarSub(s: Subtarea) {
    await supabase.from('tareas_subtareas').delete().eq('id', s.id);
    setSubs((arr) => arr.filter((x) => x.id !== s.id));
  }

  async function subirAdjunto(file: File) {
    setUploading(true);
    try {
      const ts = Date.now();
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${tareaId}/${ts}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('tarea-files').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('tareas_adjuntos').insert({
        tarea_id: tareaId,
        archivo_url: path,
        archivo_nombre: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user?.id,
      }).select('*').single();
      if (error) throw error;
      setAdjuntos((arr) => [...arr, data as any]);
    } catch (e: any) {
      avisar(e.message ?? 'Error al subir el archivo.');
    } finally {
      setUploading(false);
    }
  }

  async function descargarAdjunto(a: Adjunto) {
    const { data, error } = await supabase.storage.from('tarea-files').createSignedUrl(a.archivo_url, 60);
    if (error || !data?.signedUrl) { avisar('No se pudo generar el enlace.'); return; }
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = a.archivo_nombre;
    link.click();
  }

  async function eliminarAdjunto(a: Adjunto) {
    if (!(await confirmar(`¿Eliminar el adjunto "${a.archivo_nombre}"?`))) return;
    await supabase.storage.from('tarea-files').remove([a.archivo_url]);
    await supabase.from('tareas_adjuntos').delete().eq('id', a.id);
    setAdjuntos((arr) => arr.filter((x) => x.id !== a.id));
  }

  if (loading || !tarea) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="card p-6"><Loader2 className="animate-spin" size={20}/></div>
      </div>
    );
  }

  const subsCompl = subs.filter((s) => s.completa).length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-3xl w-full p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4 pb-3 border-b border-border">
          <span className="text-xs text-muted mt-1.5">#{tarea.numero}</span>
          <input
            className="flex-1 text-lg font-semibold bg-transparent outline-none border-0 px-0"
            defaultValue={tarea.titulo}
            onBlur={(e) => { if (e.target.value.trim() && e.target.value !== tarea.titulo) actualizar({ titulo: e.target.value.trim() }); }}
          />
          {savingHint && <span className="text-xs text-success mt-2">✓ guardado</span>}
          <button onClick={onClose} className="btn-ghost p-2"><X size={16}/></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted">Estado</label>
            <select className="input" value={tarea.estado} onChange={(e) => actualizar({ estado: e.target.value as Estado })}>
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Vencimiento</label>
            <input type="date" className="input" defaultValue={tarea.vencimiento ?? ''}
              onBlur={(e) => actualizar({ vencimiento: e.target.value || null })} />
          </div>
          <div>
            <label className="text-xs text-muted">Responsable</label>
            <select className="input" value={tarea.responsable_id ?? ''} onChange={(e) => actualizar({ responsable_id: e.target.value || null })}>
              <option value="">— sin asignar —</option>
              {miembros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Recurrencia</label>
            <select className="input" value={tarea.recurrencia} onChange={(e) => actualizar({ recurrencia: e.target.value as Recurrencia })}>
              {RECURRENCIAS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted">URL</label>
            <input type="url" className="input" placeholder="https://..." defaultValue={tarea.url ?? ''}
              onBlur={(e) => actualizar({ url: e.target.value.trim() || null })} />
          </div>
        </div>

        {/* Subtareas */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted">Subtareas</label>
            {subs.length > 0 && <span className="text-xs text-muted">{subsCompl}/{subs.length} listas</span>}
          </div>
          <div className="space-y-1">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5">
                <input type="checkbox" checked={s.completa} onChange={(e) => actualizarSub(s, { completa: e.target.checked })} className="cursor-pointer"/>
                <input
                  className={`flex-1 bg-transparent outline-none text-sm ${s.completa ? 'line-through text-muted' : ''}`}
                  defaultValue={s.titulo}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== s.titulo) actualizarSub(s, { titulo: e.target.value.trim() }); }}
                />
                <select
                  value={s.responsable_id ?? ''}
                  onChange={(e) => actualizarSub(s, { responsable_id: e.target.value || null })}
                  className="text-xs bg-transparent border-0 outline-none text-muted"
                >
                  <option value="">Sin asignar</option>
                  {miembros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <button onClick={() => eliminarSub(s)} className="text-danger hover:opacity-70"><Trash2 size={12}/></button>
              </div>
            ))}
            <div className="flex items-center gap-2 border border-dashed border-border rounded px-2 py-1.5">
              <Plus size={14} className="text-muted"/>
              <input
                className="flex-1 bg-transparent outline-none text-sm"
                placeholder="Agregar subtarea y Enter..."
                value={nuevaSub}
                onChange={(e) => setNuevaSub(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') agregarSubtarea(); }}
              />
            </div>
          </div>
        </div>

        {/* Detalle */}
        <div className="mt-4">
          <label className="text-xs text-muted">Detalle</label>
          <textarea
            className="input min-h-24"
            placeholder="Notas, contexto, pasos..."
            defaultValue={tarea.detalle ?? ''}
            onBlur={(e) => { if (e.target.value !== (tarea.detalle ?? '')) actualizar({ detalle: e.target.value || null }); }}
          />
        </div>

        {/* Adjuntos */}
        <div className="mt-4">
          <label className="text-xs text-muted">Adjuntos (PDF / foto / Excel / cualquiera)</label>
          <div className="space-y-1 mt-1">
            {adjuntos.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5 text-sm">
                <FileText size={14} className="text-muted"/>
                <span className="flex-1 truncate">{a.archivo_nombre}</span>
                <span className="text-xs text-muted whitespace-nowrap">{a.size_bytes ? (a.size_bytes / 1024).toFixed(0) + ' KB' : ''}</span>
                <button onClick={() => descargarAdjunto(a)} className="text-primary text-xs hover:underline"><Download size={12} className="inline"/></button>
                <button onClick={() => eliminarAdjunto(a)} className="text-danger text-xs hover:opacity-70"><Trash2 size={12}/></button>
              </div>
            ))}
            <label className="flex items-center gap-2 border border-dashed border-border rounded px-2 py-2 text-sm cursor-pointer hover:border-primary">
              {uploading ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14} className="text-muted"/>}
              <span className={uploading ? 'text-muted' : ''}>{uploading ? 'Subiendo...' : '+ Subir archivo'}</span>
              <input type="file" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirAdjunto(f); e.target.value = ''; }}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-between mt-6 pt-4 border-t border-border">
          <button onClick={eliminarTarea} className="text-danger text-sm hover:underline"><Trash2 size={12} className="inline"/> Eliminar tarea</button>
          <button onClick={onClose} className="btn-primary">Listo</button>
        </div>
      </div>
    </div>
  );
}
