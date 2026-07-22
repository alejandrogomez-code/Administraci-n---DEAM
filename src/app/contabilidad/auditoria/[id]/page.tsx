'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink, Loader2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusChip from '@/components/StatusChip';
import ProgressBar from '@/components/ProgressBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha } from '@/lib/format';

type Task = {
  id: string;
  orden: number;
  rubro: string | null;
  nombre: string;
  descripcion: string | null;
  responsable_id: string | null;
  fecha_vencimiento: string | null;
  fecha_finalizacion: string | null;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  observaciones: string | null;
  url: string | null;
};

type Trimestre = {
  id: string;
  trimestre: number;
  anio: number;
  estado: string;
  responsable_principal: string | null;
  fecha_estimada_cierre: string | null;
  auditor_externo: string | null;
  observaciones: string | null;
};

type Adjunto = {
  id: string;
  task_id: string;
  archivo_url: string;
  archivo_nombre: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type Miembro = { id: string; nombre: string };

const NOMBRES_TRIM = ['', '1° Trimestre (Abr-Jun)', '2° Trimestre (Jul-Sep)', '3° Trimestre (Oct-Dic)', '4° Trimestre (Ene-Mar)'];

export default function TrimestreDetallePage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [trimestreObj, setTrimestreObj] = useState<Trimestre | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroResp, setFiltroResp] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [adjuntosTaskId, setAdjuntosTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: t }, { data: a }, { data: p }] = await Promise.all([
      supabase.from('audit_trimestres').select('*').eq('id', id).single(),
      supabase.from('audit_trimestre_tasks').select('*').eq('trimestre_id', id).order('orden'),
      supabase.from('audit_task_attachments').select('*').in('task_id',
        // truco: cargamos primero las tasks, después los adjuntos
        // pero para reducir queries, hacemos join manual con IN. Como aún no tenemos tasks,
        // usamos una query aparte más abajo.
        []
      ),
      supabase.from('team_members').select('id, nombre').eq('activo', true).order('orden').order('nombre'),
    ]);
    setTrimestreObj(c as any);
    const tasksArr = ((t as any) ?? []) as Task[];
    setTasks(tasksArr);
    setMiembros(p ?? []);
    // ahora que tenemos las tasks, cargar adjuntos
    if (tasksArr.length > 0) {
      const { data: adj } = await supabase
        .from('audit_task_attachments')
        .select('*')
        .in('task_id', tasksArr.map((x) => x.id));
      setAdjuntos((adj as any) ?? []);
    } else {
      setAdjuntos([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  const filtradas = useMemo(() => tasks.filter((t) =>
    (!filtroEstado || t.estado === filtroEstado)
    && (!filtroResp || t.responsable_id === filtroResp)
  ), [tasks, filtroEstado, filtroResp]);

  // Agrupar tareas filtradas por rubro
  const gruposTareas = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of filtradas) {
      const k = t.rubro ?? '';
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([rubro, items]) => ({ rubro, items }));
  }, [filtradas]);

  const total = tasks.length;
  const completadas = tasks.filter((t) => t.estado === 'completado').length;
  const avance = total ? Math.round((completadas / total) * 100) : 0;

  const adjuntosPorTask = useMemo(() => {
    const map = new Map<string, Adjunto[]>();
    for (const a of adjuntos) {
      const arr = map.get(a.task_id) ?? [];
      arr.push(a);
      map.set(a.task_id, arr);
    }
    return map;
  }, [adjuntos]);

  async function actualizarTarea(t: Task, cambios: Partial<Task>, opciones?: { recalcularTrimestre?: boolean }) {
    const { data: { user } } = await supabase.auth.getUser();
    const upd: any = { ...cambios, updated_by: user?.id };

    if ('estado' in cambios) {
      if (cambios.estado === 'completado') upd.fecha_finalizacion = new Date().toISOString().slice(0, 10);
      else upd.fecha_finalizacion = null;
    }

    await supabase.from('audit_trimestre_tasks').update(upd).eq('id', t.id);
    setTasks((arr) => arr.map((x) => x.id === t.id ? { ...x, ...upd } as any : x));

    if (opciones?.recalcularTrimestre) {
      const futuras = tasks.map((x) => x.id === t.id ? { ...x, ...upd } as Task : x);
      const todasCompl = futuras.every((x) => x.estado === 'completado');
      const algunaIniciada = futuras.some((x) => x.estado !== 'pendiente');
      const nuevoEstado = todasCompl ? 'completado' : (algunaIniciada ? 'en_proceso' : 'pendiente');
      await supabase.from('audit_trimestres').update({ estado: nuevoEstado }).eq('id', id);
      setTrimestreObj((c) => c ? { ...c, estado: nuevoEstado } : c);
    }
  }

  async function guardarEdit() {
    if (!editing) return;
    await actualizarTarea(editing, {
      nombre: editing.nombre,
      descripcion: editing.descripcion,
      responsable_id: editing.responsable_id,
      fecha_vencimiento: editing.fecha_vencimiento,
      fecha_finalizacion: editing.fecha_finalizacion,
      estado: editing.estado,
      observaciones: editing.observaciones,
      url: editing.url,
    }, { recalcularTrimestre: true });
    setEditing(null);
  }

  async function eliminarTarea(t: Task) {
    if (!confirm(`¿Eliminar la tarea "${t.nombre}"?`)) return;
    await supabase.from('audit_trimestre_tasks').delete().eq('id', t.id);
    load();
  }

  async function eliminarTrimestre() {
    if (!confirm('¿Eliminar este trimestre y todas sus tareas y adjuntos? No se puede deshacer.')) return;
    await supabase.from('audit_trimestres').delete().eq('id', id);
    router.push('/contabilidad/auditoria');
  }

  if (loading) return <AppShell><TopBar titulo="Cargando..." /></AppShell>;
  if (!trimestreObj) return <AppShell><TopBar titulo="No encontrado" /></AppShell>;

  const respPrincipal = miembros.find((m) => m.id === trimestreObj.responsable_principal)?.nombre;

  return (
    <AppShell>
      <TopBar
        titulo={`${NOMBRES_TRIM[trimestreObj.trimestre]} · ${trimestreObj.anio}`}
        subtitulo={`${trimestreObj.auditor_externo ? trimestreObj.auditor_externo + ' • ' : ''}Fecha estimada: ${fmtFecha(trimestreObj.fecha_estimada_cierre)} • ${completadas}/${total} tareas${respPrincipal ? ' • Responsable: ' + respPrincipal : ''}`}
        actions={<Link href="/contabilidad/auditoria" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6 space-y-6">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-muted">Avance</div>
              <div className="text-2xl font-semibold">{avance}%</div>
            </div>
            <div className="flex-1 max-w-md"><ProgressBar value={avance} /></div>
            <StatusChip estado={trimestreObj.estado} />
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
                {miembros.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <button onClick={eliminarTrimestre} className="btn-ghost text-danger text-sm"><Trash2 size={14}/> Eliminar trimestre</button>
          </div>

          <div className="overflow-x-auto">
            {gruposTareas.map((g) => (
              <div key={g.rubro}>
                <div className="px-4 py-2 text-xs uppercase tracking-wide text-primary font-semibold bg-surface-2 border-b border-border">
                  {g.rubro || 'Sin rubro'} · {g.items.length} tarea{g.items.length === 1 ? '' : 's'}
                </div>
                <table className="tbl min-w-[1100px]">
                  <thead className="sr-only">
                    <tr>
                      <th>#</th><th>Tarea</th><th>Responsable</th><th>Vencimiento</th>
                      <th>Finalizada</th><th>Estado</th><th>URL</th><th>Adjuntos</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((t) => {
                      const resp = miembros.find((p) => p.id === t.responsable_id)?.nombre;
                      const adjCount = adjuntosPorTask.get(t.id)?.length ?? 0;
                      return (
                        <tr key={t.id}>
                          <td className="text-muted w-10">{t.orden}</td>
                          <td>
                            <div className="font-medium text-sm">{t.nombre}</div>
                            {t.descripcion && <div className="text-xs text-muted">{t.descripcion}</div>}
                            {t.observaciones && <div className="text-xs italic text-muted mt-1">📝 {t.observaciones}</div>}
                          </td>
                          <td className="w-40">
                            <select
                              value={t.responsable_id ?? ''}
                              onChange={(e) => actualizarTarea(t, { responsable_id: e.target.value || null })}
                              className="input !w-auto !py-1 text-xs"
                            >
                              <option value="">Sin asignar</option>
                              {miembros.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          </td>
                          <td className="w-32">
                            <input
                              type="date"
                              value={t.fecha_vencimiento ?? ''}
                              onChange={(e) => actualizarTarea(t, { fecha_vencimiento: e.target.value || null })}
                              className="input !w-auto !py-1 text-xs"
                            />
                          </td>
                          <td className="text-xs w-24">{fmtFecha(t.fecha_finalizacion)}</td>
                          <td className="w-36">
                            <select
                              value={t.estado}
                              onChange={(e) => actualizarTarea(t, { estado: e.target.value as Task['estado'] }, { recalcularTrimestre: true })}
                              className="input !w-auto !py-1 text-xs"
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="en_proceso">En proceso</option>
                              <option value="completado">Completado</option>
                            </select>
                          </td>
                          <td className="w-16 text-center">
                            {t.url ? (
                              <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 text-xs">
                                <ExternalLink size={12}/>
                              </a>
                            ) : <span className="text-muted text-xs">—</span>}
                          </td>
                          <td className="w-20">
                            <button onClick={() => setAdjuntosTaskId(t.id)} className="text-primary text-xs inline-flex items-center gap-1 hover:underline">
                              <Paperclip size={12}/> {adjCount}
                            </button>
                          </td>
                          <td className="flex gap-3 whitespace-nowrap w-32">
                            <button onClick={() => setEditing(t)} className="text-primary text-xs hover:underline">Editar</button>
                            <button onClick={() => eliminarTarea(t)} className="text-danger text-xs hover:underline">Eliminar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
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
                    {miembros.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
                  <label className="text-xs text-muted">Vencimiento</label>
                  <input type="date" className="input" value={editing.fecha_vencimiento ?? ''} onChange={(e) => setEditing({ ...editing, fecha_vencimiento: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted">Fecha finalización</label>
                  <input type="date" className="input" value={editing.fecha_finalizacion ?? ''} onChange={(e) => setEditing({ ...editing, fecha_finalizacion: e.target.value || null })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted">URL</label>
                <input type="url" className="input" placeholder="https://..." value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value || null })} />
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

      {adjuntosTaskId && (
        <AdjuntosModal
          taskId={adjuntosTaskId}
          task={tasks.find((t) => t.id === adjuntosTaskId)!}
          onClose={() => { setAdjuntosTaskId(null); load(); }}
        />
      )}
    </AppShell>
  );
}

/* =====================================================================
   MODAL DE ADJUNTOS DE UNA TAREA
   ===================================================================== */
function AdjuntosModal({ taskId, task, onClose }: {
  taskId: string;
  task: Task;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('audit_task_attachments').select('*').eq('task_id', taskId).order('created_at');
    setAdjuntos((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [taskId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function subir(file: File) {
    setUploading(true);
    try {
      const ts = Date.now();
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${taskId}/${ts}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('audit-files').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('audit_task_attachments').insert({
        task_id: taskId,
        archivo_url: path,
        archivo_nombre: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user?.id,
      }).select('*').single();
      if (error) throw error;
      setAdjuntos((arr) => [...arr, data as any]);
    } catch (e: any) {
      alert(e.message ?? 'Error al subir.');
    } finally {
      setUploading(false);
    }
  }

  async function descargar(a: Adjunto) {
    const { data, error } = await supabase.storage.from('audit-files').createSignedUrl(a.archivo_url, 60);
    if (error || !data?.signedUrl) { alert('No se pudo generar el enlace.'); return; }
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = a.archivo_nombre;
    link.click();
  }

  async function eliminar(a: Adjunto) {
    if (!confirm(`¿Eliminar "${a.archivo_nombre}"?`)) return;
    await supabase.storage.from('audit-files').remove([a.archivo_url]);
    await supabase.from('audit_task_attachments').delete().eq('id', a.id);
    setAdjuntos((arr) => arr.filter((x) => x.id !== a.id));
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">Adjuntos</h3>
            <div className="text-xs text-muted mt-1">{task.nombre}</div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X size={16}/></button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-muted"><Loader2 className="animate-spin inline" size={16}/></div>
        ) : (
          <div className="space-y-1 mb-3">
            {adjuntos.length === 0 && (
              <div className="text-sm text-muted text-center py-4">Sin adjuntos todavía.</div>
            )}
            {adjuntos.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5 text-sm">
                <Paperclip size={14} className="text-muted"/>
                <span className="flex-1 truncate">{a.archivo_nombre}</span>
                <span className="text-xs text-muted whitespace-nowrap">{a.size_bytes ? (a.size_bytes / 1024).toFixed(0) + ' KB' : ''}</span>
                <button onClick={() => descargar(a)} className="text-primary hover:opacity-70" title="Descargar"><Download size={12}/></button>
                <button onClick={() => eliminar(a)} className="text-danger hover:opacity-70" title="Eliminar"><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 border border-dashed border-border rounded px-3 py-3 text-sm cursor-pointer hover:border-primary">
          {uploading ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14} className="text-muted"/>}
          <span className={uploading ? 'text-muted' : ''}>{uploading ? 'Subiendo...' : 'Subir archivo (PDF, Excel, foto, cualquiera)'}</span>
          <input type="file" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }}
          />
        </label>
      </div>
    </div>
  );
}
