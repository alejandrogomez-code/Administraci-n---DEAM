'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusChip from '@/components/StatusChip';
import ProgressBar from '@/components/ProgressBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, nombreMes } from '@/lib/format';

type Task = {
  id: string;
  orden: number;
  nombre: string;
  descripcion: string | null;
  responsable_id: string | null;
  fecha_estimada: string | null;
  fecha_estimada_2: string | null;
  fecha_real_finalizacion: string | null;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  observaciones: string | null;
};

type Closing = {
  id: string;
  mes: number;
  anio: number;
  estado: string;
  responsable_principal: string | null;
  fecha_estimada_cierre: string | null;
};

type Profile = { id: string; nombre: string };

export default function CierreDetallePage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [closing, setClosing] = useState<Closing | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroResp, setFiltroResp] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: c } = await supabase.from('accounting_closings').select('*').eq('id', id).single();
    setClosing(c as any);
    const { data: t } = await supabase.from('accounting_closing_tasks').select('*').eq('closing_id', id).order('orden');
    setTasks((t as any) ?? []);
    const { data: p } = await supabase.from('profiles').select('id, nombre').eq('activo', true).order('nombre');
    setProfiles(p ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  const filtradas = useMemo(() => tasks.filter((t) => (!filtroEstado || t.estado === filtroEstado) && (!filtroResp || t.responsable_id === filtroResp)), [tasks, filtroEstado, filtroResp]);
  const total = tasks.length;
  const completadas = tasks.filter((t) => t.estado === 'completado').length;
  const avance = total ? Math.round((completadas / total) * 100) : 0;

  async function cambiarEstadoTarea(t: Task, estado: Task['estado']) {
    const { data: { user } } = await supabase.auth.getUser();
    const upd: any = { estado, updated_by: user?.id };
    if (estado === 'completado') upd.fecha_real_finalizacion = new Date().toISOString().slice(0, 10);
    if (estado !== 'completado') upd.fecha_real_finalizacion = null;
    await supabase.from('accounting_closing_tasks').update(upd).eq('id', t.id);
    // si todas completadas, marcar cierre como completado
    if (estado === 'completado') {
      const otrasPendientes = tasks.filter((x) => x.id !== t.id && x.estado !== 'completado').length;
      if (otrasPendientes === 0) {
        await supabase.from('accounting_closings').update({ estado: 'completado' }).eq('id', id);
      } else {
        await supabase.from('accounting_closings').update({ estado: 'en_proceso' }).eq('id', id);
      }
    } else {
      // si alguna no está completada, marcar el cierre en proceso (si tiene alguna distinta a pendiente)
      const algunaEnProceso = tasks.some((x) => x.id !== t.id && x.estado !== 'pendiente') || estado === 'en_proceso';
      await supabase.from('accounting_closings').update({ estado: algunaEnProceso ? 'en_proceso' : 'pendiente' }).eq('id', id);
    }
    load();
  }

  async function guardarEdit() {
    if (!editing) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('accounting_closing_tasks').update({
      nombre: editing.nombre,
      descripcion: editing.descripcion,
      responsable_id: editing.responsable_id,
      fecha_estimada: editing.fecha_estimada,
      fecha_estimada_2: editing.fecha_estimada_2,
      fecha_real_finalizacion: editing.fecha_real_finalizacion,
      estado: editing.estado,
      observaciones: editing.observaciones,
      updated_by: user?.id,
    }).eq('id', editing.id);
    setEditing(null);
    load();
  }

  async function eliminarTarea(t: Task) {
    if (!confirm(`¿Eliminar la tarea "${t.nombre}"?`)) return;
    await supabase.from('accounting_closing_tasks').delete().eq('id', t.id);
    load();
  }

  async function agregarTarea() {
    const nombre = prompt('Nombre de la nueva tarea:');
    if (!nombre) return;
    const maxOrden = tasks.reduce((m, t) => Math.max(m, t.orden), 0) + 1;
    await supabase.from('accounting_closing_tasks').insert({
      closing_id: id, orden: maxOrden, nombre, estado: 'pendiente',
    });
    load();
  }

  async function duplicarMesAnterior() {
    if (!closing) return;
    // buscar mes anterior
    const mp = closing.mes === 1 ? 12 : closing.mes - 1;
    const ap = closing.mes === 1 ? closing.anio - 1 : closing.anio;
    const { data: prev } = await supabase.from('accounting_closings').select('id').eq('mes', mp).eq('anio', ap).maybeSingle();
    if (!prev) { alert(`No existe cierre de ${nombreMes(mp)} ${ap}.`); return; }
    const { data: prevTasks } = await supabase.from('accounting_closing_tasks').select('*').eq('closing_id', prev.id).order('orden');
    if (!prevTasks?.length) { alert('El mes anterior no tiene tareas.'); return; }
    if (!confirm(`Importar ${prevTasks.length} tareas desde ${nombreMes(mp)} ${ap}?`)) return;
    const nuevas = prevTasks.map((t: any) => ({
      closing_id: id, orden: t.orden, nombre: t.nombre, descripcion: t.descripcion,
      responsable_id: t.responsable_id,
      fecha_estimada: t.fecha_estimada, fecha_estimada_2: t.fecha_estimada_2,
      estado: 'pendiente', template_id: t.template_id,
    }));
    await supabase.from('accounting_closing_tasks').insert(nuevas);
    load();
  }

  async function eliminarCierre() {
    if (!confirm('¿Eliminar este cierre y todas sus tareas? No se puede deshacer.')) return;
    await supabase.from('accounting_closings').delete().eq('id', id);
    router.push('/contabilidad/cierres');
  }

  if (loading) return <AppShell><TopBar titulo="Cargando..." /></AppShell>;
  if (!closing) return <AppShell><TopBar titulo="No encontrado" /></AppShell>;

  return (
    <AppShell>
      <TopBar
        titulo={`Cierre ${nombreMes(closing.mes)} ${closing.anio}`}
        subtitulo={`Fecha estimada: ${fmtFecha(closing.fecha_estimada_cierre)} • ${completadas}/${total} tareas`}
        actions={<>
          <Link href="/contabilidad/cierres" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>
          <button onClick={duplicarMesAnterior} className="btn-secondary"><Copy size={14}/> Duplicar mes anterior</button>
          <button onClick={agregarTarea} className="btn-primary"><Plus size={14}/> Tarea</button>
        </>}
      />
      <div className="p-6 space-y-6">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-muted">Avance</div>
              <div className="text-2xl font-semibold">{avance}%</div>
            </div>
            <div className="flex-1 max-w-md"><ProgressBar value={avance} /></div>
            <StatusChip estado={closing.estado} />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 items-center">
              <select className="input !w-auto" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="completado">Completado</option>
              </select>
              <select className="input !w-auto" value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)}>
                <option value="">Todos los responsables</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <button onClick={eliminarCierre} className="btn-ghost text-danger text-sm"><Trash2 size={14}/> Eliminar cierre</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Tarea</th>
                <th>Responsable</th>
                <th>Fecha objetivo</th>
                <th>Finalizada</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((t) => {
                const resp = profiles.find((p) => p.id === t.responsable_id)?.nombre;
                return (
                  <tr key={t.id}>
                    <td className="text-muted">{t.orden}</td>
                    <td>
                      <div className="font-medium text-sm">{t.nombre}</div>
                      {t.descripcion && <div className="text-xs text-muted">{t.descripcion}</div>}
                      {t.observaciones && <div className="text-xs italic text-muted mt-1">📝 {t.observaciones}</div>}
                    </td>
                    <td className="text-sm">{resp ?? '-'}</td>
                    <td className="text-xs whitespace-nowrap">
                      {t.fecha_estimada && <div>{fmtFecha(t.fecha_estimada)}</div>}
                      {t.fecha_estimada_2 && <div className="text-muted">{fmtFecha(t.fecha_estimada_2)}</div>}
                    </td>
                    <td className="text-xs">{fmtFecha(t.fecha_real_finalizacion)}</td>
                    <td>
                      <select
                        value={t.estado}
                        onChange={(e) => cambiarEstadoTarea(t, e.target.value as Task['estado'])}
                        className="input !w-auto !py-1 text-xs"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="completado">Completado</option>
                      </select>
                    </td>
                    <td className="flex gap-1">
                      <button onClick={() => setEditing(t)} className="text-primary text-xs hover:underline">Editar</button>
                      <button onClick={() => eliminarTarea(t)} className="text-danger text-xs hover:underline">Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Editar tarea</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted">Nombre</label>
                <input className="input" value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted">Descripción</label>
                <textarea className="input min-h-20" value={editing.descripcion ?? ''} onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted">Responsable</label>
                  <select className="input" value={editing.responsable_id ?? ''} onChange={(e) => setEditing({ ...editing, responsable_id: e.target.value || null })}>
                    <option value="">Sin asignar</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted">Estado</label>
                  <select className="input" value={editing.estado} onChange={(e) => setEditing({ ...editing, estado: e.target.value as any })}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted">Fecha estimada 1</label>
                  <input type="date" className="input" value={editing.fecha_estimada ?? ''} onChange={(e) => setEditing({ ...editing, fecha_estimada: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted">Fecha estimada 2</label>
                  <input type="date" className="input" value={editing.fecha_estimada_2 ?? ''} onChange={(e) => setEditing({ ...editing, fecha_estimada_2: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted">Fecha real finalización</label>
                  <input type="date" className="input" value={editing.fecha_real_finalizacion ?? ''} onChange={(e) => setEditing({ ...editing, fecha_real_finalizacion: e.target.value || null })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted">Observaciones</label>
                <textarea className="input min-h-20" value={editing.observaciones ?? ''} onChange={(e) => setEditing({ ...editing, observaciones: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarEdit}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
