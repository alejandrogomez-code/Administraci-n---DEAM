'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { avisar, confirmar, pedirTexto } from '@/components/feedback';
import { BUCKET, Documento, Jurisdiccion, slugify } from './utils';

export function GestionarModal({
  supabase, jurs, docs, onClose, onChanged, tab, setTab,
}: {
  supabase: ReturnType<typeof createClient>;
  jurs: Jurisdiccion[];
  docs: Documento[];
  onClose: () => void;
  onChanged: () => void;
  tab: string;
  setTab: (t: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [busy, setBusy] = useState(false);

  async function agregar() {
    const n = nombre.trim();
    if (!n) return;
    setBusy(true);
    try {
      const slug = slugify(n);
      const orden = (jurs.reduce((mx, j) => Math.max(mx, j.orden), -1)) + 1;
      const { error } = await supabase.from('repo_jurisdicciones').insert({ nombre: n, slug, orden });
      if (error) throw error;
      setNombre('');
      onChanged();
    } catch (err: any) {
      avisar(err.message ?? 'Error al agregar.');
    } finally { setBusy(false); }
  }

  async function renombrar(j: Jurisdiccion) {
    const n = (await pedirTexto('Nuevo nombre:', j.nombre));
    if (!n || !n.trim() || n.trim() === j.nombre) return;
    await supabase.from('repo_jurisdicciones').update({ nombre: n.trim() }).eq('id', j.id);
    onChanged();
  }

  async function eliminar(j: Jurisdiccion) {
    const cant = docs.filter((d) => d.jurisdiccion_id === j.id).length;
    const msg = cant > 0
      ? `"${j.nombre}" tiene ${cant} documento(s). Si la eliminás se borran también esos documentos. ¿Continuar?`
      : `¿Eliminar "${j.nombre}"?`;
    if (!(await confirmar(msg))) return;
    // borrar archivos del storage de esos documentos
    const archivos = docs.filter((d) => d.jurisdiccion_id === j.id && d.archivo_url).map((d) => d.archivo_url!) as string[];
    if (archivos.length) await supabase.storage.from(BUCKET).remove(archivos);
    await supabase.from('repo_jurisdicciones').delete().eq('id', j.id);
    if (tab === j.id) setTab('vencimientos');
    onChanged();
  }

  async function mover(j: Jurisdiccion, dir: -1 | 1) {
    const ordenados = [...jurs].sort((a, b) => a.orden - b.orden);
    const i = ordenados.findIndex((x) => x.id === j.id);
    const swap = ordenados[i + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from('repo_jurisdicciones').update({ orden: swap.orden }).eq('id', j.id),
      supabase.from('repo_jurisdicciones').update({ orden: j.orden }).eq('id', swap.id),
    ]);
    onChanged();
  }

  const ordenados = [...jurs].sort((a, b) => a.orden - b.orden);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">Gestionar jurisdicciones</h3>

        <div className="space-y-1.5 mb-4">
          {ordenados.map((j, i) => (
            <div key={j.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5 text-sm">
              <span className="flex-1 truncate">{j.nombre}</span>
              <span className="text-xs text-muted">{docs.filter((d) => d.jurisdiccion_id === j.id).length}</span>
              <button className="text-muted hover:text-text disabled:opacity-30" disabled={i === 0} onClick={() => mover(j, -1)} title="Subir">↑</button>
              <button className="text-muted hover:text-text disabled:opacity-30" disabled={i === ordenados.length - 1} onClick={() => mover(j, 1)} title="Bajar">↓</button>
              <button className="text-primary text-xs hover:underline" onClick={() => renombrar(j)}>Renombrar</button>
              <button className="text-danger" onClick={() => eliminar(j)}><Trash2 size={13} /></button>
            </div>
          ))}
          {ordenados.length === 0 && <div className="text-xs text-muted">No hay jurisdicciones todavía.</div>}
        </div>

        <div className="flex items-center gap-2">
          <input className="input" placeholder="Nueva jurisdicción (ej: Santa Fe)" value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }} />
          <button className="btn-primary shrink-0" disabled={busy || !nombre.trim()} onClick={agregar}>
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Agregar
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
