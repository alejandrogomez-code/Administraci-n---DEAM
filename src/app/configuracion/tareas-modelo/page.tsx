'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';

type Template = {
  id: string;
  orden: number;
  nombre: string;
  descripcion: string | null;
  dia_objetivo_1: number | null;
  dia_objetivo_2: number | null;
  activo: boolean;
};

export default function TareasModeloPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('closing_task_templates').select('*').order('orden');
    setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function nuevo() {
    setEditing({
      id: '', orden: (items.reduce((m, x) => Math.max(m, x.orden), 0) + 1),
      nombre: '', descripcion: '', dia_objetivo_1: null, dia_objetivo_2: null, activo: true,
    });
  }

  async function guardar() {
    if (!editing) return;
    if (!editing.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    const payload = {
      orden: editing.orden,
      nombre: editing.nombre,
      descripcion: editing.descripcion,
      dia_objetivo_1: editing.dia_objetivo_1,
      dia_objetivo_2: editing.dia_objetivo_2,
      activo: editing.activo,
    };
    if (editing.id) {
      await supabase.from('closing_task_templates').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('closing_task_templates').insert(payload);
    }
    setEditing(null);
    load();
  }

  async function eliminar(t: Template) {
    if (!confirm(`Eliminar la tarea modelo "${t.nombre}"?`)) return;
    await supabase.from('closing_task_templates').delete().eq('id', t.id);
    load();
  }

  return (
    <AppShell>
      <TopBar
        titulo="Tareas modelo del cierre mensual"
        subtitulo="Plantilla de tareas que se crean al abrir un nuevo cierre"
        actions={<>
          <Link href="/configuracion" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>
          <button onClick={nuevo} className="btn-primary"><Plus size={14}/> Nueva</button>
        </>}
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Día obj. 1</th>
                  <th>Día obj. 2</th>
                  <th>Activa</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="text-muted">{t.orden}</td>
                    <td>
                      <div className="font-medium text-sm">{t.nombre}</div>
                      {t.descripcion && <div className="text-xs text-muted">{t.descripcion}</div>}
                    </td>
                    <td className="text-sm">{t.dia_objetivo_1 ?? '-'}</td>
                    <td className="text-sm">{t.dia_objetivo_2 ?? '-'}</td>
                    <td>{t.activo ? '✓' : '—'}</td>
                    <td className="flex gap-3 text-xs">
                      <button className="text-primary" onClick={() => setEditing(t)}>Editar</button>
                      <button className="text-danger" onClick={() => eliminar(t)}><Trash2 size={12} className="inline"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-muted mt-3">
          Los “días objetivo” son del mes <b>siguiente</b> al cierre (ej: día 5 = al 5to día del mes siguiente).
        </p>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="card max-w-xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">{editing.id ? 'Editar tarea modelo' : 'Nueva tarea modelo'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted">Orden</label>
                  <input type="number" className="input" value={editing.orden} onChange={(e) => setEditing({ ...editing, orden: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted">Nombre</label>
                  <input className="input" value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted">Descripción</label>
                <textarea className="input min-h-20" value={editing.descripcion ?? ''} onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted">Día objetivo 1 (mes siguiente)</label>
                  <input type="number" min={1} max={31} className="input" value={editing.dia_objetivo_1 ?? ''} onChange={(e) => setEditing({ ...editing, dia_objetivo_1: e.target.value ? parseInt(e.target.value) : null })} />
                </div>
                <div>
                  <label className="text-xs text-muted">Día objetivo 2 (mes siguiente)</label>
                  <input type="number" min={1} max={31} className="input" value={editing.dia_objetivo_2 ?? ''} onChange={(e) => setEditing({ ...editing, dia_objetivo_2: e.target.value ? parseInt(e.target.value) : null })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.activo} onChange={(e) => setEditing({ ...editing, activo: e.target.checked })} />
                Activa (se incluye al crear nuevos cierres)
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
