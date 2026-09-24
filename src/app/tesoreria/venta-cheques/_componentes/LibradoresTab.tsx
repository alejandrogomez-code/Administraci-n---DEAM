'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { avisar, confirmar } from '@/components/feedback';
import { Librador } from './tipos';

/* ============================================================
   TAB 4: LIBRADORES (base de quienes nos libran cheques)
   ============================================================ */
export function LibradoresTab({ libradores, reload }: { libradores: Librador[]; reload: () => void }) {
  const supabase = createClient();
  const [busqueda, setBusqueda] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [editing, setEditing] = useState<Librador | null>(null);
  const [busy, setBusy] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return libradores.filter((l) => {
      if (soloActivos && !l.activo) return false;
      if (!q) return true;
      return l.nombre.toUpperCase().includes(q) || (l.cuit ?? '').includes(q);
    });
  }, [libradores, busqueda, soloActivos]);

  function nuevo() {
    setEditing({ id: '', nombre: '', cuit: '', observaciones: '', activo: true });
  }

  async function guardar() {
    if (!editing) return;
    if (!editing.nombre.trim()) { avisar('El nombre es obligatorio.'); return; }
    setBusy(true);
    try {
      const cuit = (editing.cuit ?? '').replace(/[^0-9]/g, '') || null;
      const payload = {
        nombre: editing.nombre.trim(),
        cuit,
        observaciones: editing.observaciones?.trim() || null,
        activo: editing.activo,
      };
      if (editing.id) {
        const { error } = await supabase.from('libradores').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('libradores').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      setEditing(null);
      reload();
    } catch (err: any) {
      avisar(err.message ?? 'Error al guardar.');
    } finally { setBusy(false); }
  }

  async function eliminar(l: Librador) {
    if (!(await confirmar(`¿Eliminar "${l.nombre}" de los libradores?`))) return;
    const { error } = await supabase.from('libradores').delete().eq('id', l.id);
    if (error) { avisar(error.message); return; }
    reload();
  }

  async function toggleActivo(l: Librador) {
    await supabase.from('libradores').update({ activo: !l.activo }).eq('id', l.id);
    reload();
  }

  // Detección de duplicados de CUIT (informativo)
  const cuitsRepetidos = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of libradores) if (l.cuit) c.set(l.cuit, (c.get(l.cuit) ?? 0) + 1);
    return new Set(Array.from(c.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [libradores]);

  return (
    <>
      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-64">
          <label className="text-xs text-muted">Buscar por nombre o CUIT</label>
          <input className="input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej: SANATORIO, 30..." />
        </div>
        <label className="flex items-center gap-2 text-sm pb-1.5">
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
          Sólo activos
        </label>
        <button className="btn-primary" onClick={nuevo}><Plus size={14}/> Nuevo librador</button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between text-sm">
          <div>{filtrados.length} de {libradores.length} libradores</div>
          <button onClick={reload} className="btn-ghost text-sm"><RefreshCcw size={14}/></button>
        </div>
        {filtrados.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
            {libradores.length === 0 ? <>Sin libradores. <button className="text-primary" onClick={nuevo}>Agregar el primero</button>.</> : 'Sin resultados.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[700px]">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>CUIT</th>
                  <th>Observaciones</th>
                  <th>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => (
                  <tr key={l.id} className={!l.activo ? 'opacity-50' : ''}>
                    <td className="font-medium text-sm">{l.nombre}</td>
                    <td className="font-mono text-xs">
                      {l.cuit ?? <span className="text-muted">—</span>}
                      {l.cuit && cuitsRepetidos.has(l.cuit) && (
                        <span className="ml-1 chip bg-warning/15 text-warning" title="CUIT compartido con otro librador">repetido</span>
                      )}
                    </td>
                    <td className="text-xs max-w-xs truncate">{l.observaciones ?? '—'}</td>
                    <td>
                      <input type="checkbox" checked={l.activo} onChange={() => toggleActivo(l)} className="cursor-pointer" />
                    </td>
                    <td><div className="flex gap-3 text-xs whitespace-nowrap">
                      <button className="text-primary" onClick={() => setEditing(l)}>Editar</button>
                      <button className="text-danger" onClick={() => eliminar(l)}><Trash2 size={12} className="inline"/></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-muted">
        Al cargar un cheque manualmente o importar desde Excel, si el nombre del librador coincide con uno de esta lista y tiene un único CUIT, se autocompleta el CUIT del cheque.
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">{editing.id ? 'Editar librador' : 'Nuevo librador'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted">Nombre *</label>
                <input className="input" value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted">CUIT</label>
                <input className="input" value={editing.cuit ?? ''} onChange={(e) => setEditing({ ...editing, cuit: e.target.value })} placeholder="11 dígitos" />
              </div>
              <div>
                <label className="text-xs text-muted">Observaciones</label>
                <textarea className="input min-h-20" value={editing.observaciones ?? ''} onChange={(e) => setEditing({ ...editing, observaciones: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.activo} onChange={(e) => setEditing({ ...editing, activo: e.target.checked })} />
                Activo
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-primary" disabled={busy} onClick={guardar}>
                {busy ? <><Loader2 className="animate-spin" size={14}/> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
