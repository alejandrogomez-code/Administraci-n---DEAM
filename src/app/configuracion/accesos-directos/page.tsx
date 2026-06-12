'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';

type Acceso = {
  id: string;
  titulo: string;
  url: string;
  descripcion: string | null;
  color: string;
  orden: number;
  activo: boolean;
};

const COLORES = [
  { id: 'primary', label: 'Primario' },
  { id: 'accent',  label: 'Acento' },
  { id: 'success', label: 'Verde' },
  { id: 'warning', label: 'Naranja' },
  { id: 'danger',  label: 'Rojo' },
  { id: 'muted',   label: 'Gris' },
];

export default function AccesosDirectosConfigPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Acceso[]>([]);
  const [editing, setEditing] = useState<Acceso | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: p } = await supabase.from('profiles').select('rol').eq('id', user!.id).single();
    setEsAdmin(p?.rol === 'admin');
    const { data } = await supabase.from('accesos_directos').select('*').order('orden').order('titulo');
    setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function nuevo() {
    setEditing({
      id: '', titulo: '', url: '', descripcion: '',
      color: 'primary', orden: (items.reduce((m, x) => Math.max(m, x.orden), 0) + 1),
      activo: true,
    });
  }

  async function guardar() {
    if (!editing) return;
    if (!editing.titulo.trim()) { alert('El título es obligatorio.'); return; }
    if (!editing.url.trim()) { alert('El link es obligatorio.'); return; }
    let url = editing.url.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) url = 'https://' + url;
    setBusy(true);
    try {
      const payload = {
        titulo: editing.titulo.trim(),
        url,
        descripcion: editing.descripcion?.trim() || null,
        color: editing.color,
        orden: editing.orden,
        activo: editing.activo,
      };
      if (editing.id) {
        await supabase.from('accesos_directos').update(payload).eq('id', editing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('accesos_directos').insert({ ...payload, created_by: user?.id });
      }
      setEditing(null);
      load();
    } catch (err: any) {
      alert(err.message ?? 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function eliminar(a: Acceso) {
    if (!confirm(`¿Eliminar "${a.titulo}"?`)) return;
    await supabase.from('accesos_directos').delete().eq('id', a.id);
    load();
  }

  return (
    <AppShell>
      <TopBar
        titulo="Accesos directos"
        subtitulo={esAdmin ? 'Cargá los botones que van a aparecer en la app' : 'Solo el administrador puede editar'}
        actions={<>
          <Link href="/configuracion" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>
          {esAdmin && <button onClick={nuevo} className="btn-primary"><Plus size={14}/> Nuevo</button>}
        </>}
      />
      <div className="p-6 max-w-4xl space-y-4">
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">
              {esAdmin ? <>Sin accesos directos. <button className="text-primary" onClick={nuevo}>Crear el primero</button>.</> : 'Sin accesos directos cargados.'}
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Título</th>
                  <th>URL</th>
                  <th>Color</th>
                  <th>Activo</th>
                  {esAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className={!a.activo ? 'opacity-50' : ''}>
                    <td className="text-muted">{a.orden}</td>
                    <td>
                      <div className="font-medium text-sm">{a.titulo}</div>
                      {a.descripcion && <div className="text-xs text-muted">{a.descripcion}</div>}
                    </td>
                    <td>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs inline-flex items-center gap-1 hover:underline">
                        <ExternalLink size={12}/> <span className="truncate max-w-72 inline-block">{a.url}</span>
                      </a>
                    </td>
                    <td><span className={`chip bg-${a.color}/15 text-${a.color}`}>{a.color}</span></td>
                    <td>{a.activo ? '✓' : '—'}</td>
                    {esAdmin && (
                      <td className="flex gap-3 text-xs whitespace-nowrap">
                        <button className="text-primary" onClick={() => setEditing(a)}>Editar</button>
                        <button className="text-danger" onClick={() => eliminar(a)}><Trash2 size={12} className="inline"/></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-muted">
          Los accesos directos se ven en la sección Accesos directos (sidebar) y como botones rápidos en el Dashboard.
        </p>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">{editing.id ? 'Editar' : 'Nuevo'} acceso directo</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted">Título *</label>
                <input className="input" value={editing.titulo} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} placeholder="SAP / Drive contable / etc." />
              </div>
              <div>
                <label className="text-xs text-muted">URL *</label>
                <input className="input" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-muted">Descripción (opcional)</label>
                <input className="input" value={editing.descripcion ?? ''} onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted">Color</label>
                  <select className="input" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })}>
                    {COLORES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted">Orden</label>
                  <input type="number" className="input" value={editing.orden} onChange={(e) => setEditing({ ...editing, orden: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.activo} onChange={(e) => setEditing({ ...editing, activo: e.target.checked })} />
                Activo (visible)
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
    </AppShell>
  );
}
