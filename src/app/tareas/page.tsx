'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Calendar, Check, ChevronDown, Clock, Download, Eye, EyeOff,
  ExternalLink, FileText, Kanban, LayoutList, Link as LinkIcon, Loader2,
  Paperclip, Plus, RefreshCcw, Search, Trash2, Upload, X,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha } from '@/lib/format';

/* =====================================================================
   TIPOS
   ===================================================================== */

type Estado = 'sin_iniciar' | 'urgente' | 'en_proceso' | 'completo';
type Recurrencia = 'no_se_repite' | 'diaria' | 'semanal' | 'mensual' | 'anual';

type Tarea = {
  id: string;
  numero: number;
  titulo: string;
  estado: Estado;
  vencimiento: string | null;
  responsable_id: string | null;
  recurrencia: Recurrencia;
  url: string | null;
  detalle: string | null;
  created_at: string;
  updated_at: string;
};

type Subtarea = {
  id: string;
  tarea_id: string;
  titulo: string;
  responsable_id: string | null;
  completa: boolean;
  orden: number;
};

type Adjunto = {
  id: string;
  tarea_id: string;
  archivo_url: string;
  archivo_nombre: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Miembro = { id: string; nombre: string };

type Vista = 'tabla' | 'kanban';
type Agrupacion = 'ninguna' | 'responsable' | 'estado';
type FiltroVenc = 'cualquiera' | 'vencidas' | 'hoy' | 'esta_semana' | 'este_mes' | 'sin_fecha';

/* =====================================================================
   CONSTANTES DE ESTADO
   ===================================================================== */

const ESTADOS: { id: Estado; label: string; color: string; bg: string }[] = [
  { id: 'sin_iniciar', label: 'Sin iniciar', color: 'text-muted',   bg: 'bg-muted/15' },
  { id: 'urgente',     label: 'Urgente',     color: 'text-danger',  bg: 'bg-danger/15' },
  { id: 'en_proceso',  label: 'En proceso',  color: 'text-accent',  bg: 'bg-accent/15' },
  { id: 'completo',    label: 'Completo',    color: 'text-success', bg: 'bg-success/15' },
];

const RECURRENCIAS: { id: Recurrencia; label: string }[] = [
  { id: 'no_se_repite', label: 'No se repite' },
  { id: 'diaria',       label: 'Diaria' },
  { id: 'semanal',      label: 'Semanal' },
  { id: 'mensual',      label: 'Mensual' },
  { id: 'anual',        label: 'Anual' },
];

function estadoInfo(id: Estado) { return ESTADOS.find((e) => e.id === id) ?? ESTADOS[0]; }

/* =====================================================================
   PÁGINA PRINCIPAL
   ===================================================================== */

export default function TareasPage() {
  const supabase = createClient();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [subtareas, setSubtareas] = useState<Subtarea[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>('tabla');
  const [showCompletadas, setShowCompletadas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroResp, setFiltroResp] = useState<string>('');
  const [filtroVenc, setFiltroVenc] = useState<FiltroVenc>('cualquiera');
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('ninguna');
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: s }, { data: m }] = await Promise.all([
      supabase.from('tareas').select('*').order('numero', { ascending: false }),
      supabase.from('tareas_subtareas').select('*').order('orden'),
      supabase.from('team_members').select('id, nombre').eq('activo', true).order('orden').order('nombre'),
    ]);
    setTareas((t as any) ?? []);
    setSubtareas((s as any) ?? []);
    setMiembros(m ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    // recargar cuando se cierre el modal, por si hubo cambios
    if (editingId === null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hoyIso = hoy.toISOString().slice(0, 10);
    const finSemana = new Date(hoy); finSemana.setDate(finSemana.getDate() + (7 - finSemana.getDay()));
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    return tareas.filter((t) => {
      if (!showCompletadas && t.estado === 'completo') return false;
      if (filtroEstado && t.estado !== filtroEstado) return false;
      if (filtroResp && t.responsable_id !== filtroResp) return false;
      if (q && !t.titulo.toLowerCase().includes(q) && !String(t.numero).includes(q)) return false;
      if (filtroVenc === 'vencidas' && (!t.vencimiento || t.vencimiento >= hoyIso)) return false;
      if (filtroVenc === 'hoy' && t.vencimiento !== hoyIso) return false;
      if (filtroVenc === 'esta_semana' && (!t.vencimiento || t.vencimiento < hoyIso || t.vencimiento > finSemana.toISOString().slice(0, 10))) return false;
      if (filtroVenc === 'este_mes' && (!t.vencimiento || t.vencimiento < hoyIso || t.vencimiento > finMes.toISOString().slice(0, 10))) return false;
      if (filtroVenc === 'sin_fecha' && t.vencimiento) return false;
      return true;
    });
  }, [tareas, busqueda, filtroEstado, filtroResp, filtroVenc, showCompletadas]);

  async function nuevaTarea() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('tareas').insert({
      titulo: 'Nueva tarea',
      estado: 'sin_iniciar',
      recurrencia: 'no_se_repite',
      created_by: user?.id,
    }).select('id').single();
    if (error) { alert(error.message); return; }
    setEditingId(data.id);
  }

  async function actualizarEstado(t: Tarea, estado: Estado) {
    await supabase.from('tareas').update({ estado }).eq('id', t.id);
    setTareas((arr) => arr.map((x) => x.id === t.id ? { ...x, estado } : x));
  }

  const subtareasPorTarea = useMemo(() => {
    const map = new Map<string, Subtarea[]>();
    for (const s of subtareas) {
      const arr = map.get(s.tarea_id) ?? [];
      arr.push(s);
      map.set(s.tarea_id, arr);
    }
    return map;
  }, [subtareas]);

  const totalCompletadas = tareas.filter((t) => t.estado === 'completo').length;

  return (
    <AppShell>
      <TopBar
        titulo="Gestor de tareas"
        subtitulo={`${filtradas.length} tarea${filtradas.length === 1 ? '' : 's'}${!showCompletadas && totalCompletadas > 0 ? ` (${totalCompletadas} completada${totalCompletadas === 1 ? '' : 's'} oculta${totalCompletadas === 1 ? '' : 's'})` : ''}`}
        actions={<button onClick={nuevaTarea} className="btn-primary"><Plus size={14}/> Nueva tarea</button>}
      />
      <div className="p-6 space-y-4">
        {/* Selector de vista */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 bg-surface-2 p-1 rounded text-sm">
            <button onClick={() => setVista('tabla')} className={`px-3 py-1.5 rounded flex items-center gap-2 ${vista==='tabla' ? 'bg-surface shadow-soft font-medium' : ''}`}>
              <LayoutList size={14}/> Tabla
            </button>
            <button onClick={() => setVista('kanban')} className={`px-3 py-1.5 rounded flex items-center gap-2 ${vista==='kanban' ? 'bg-surface shadow-soft font-medium' : ''}`}>
              <Kanban size={14}/> Kanban
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setShowCompletadas((v) => !v)} className="btn-ghost text-sm">
              {showCompletadas ? <EyeOff size={14}/> : <Eye size={14}/>}
              {showCompletadas ? 'Ocultar completadas' : 'Ver completadas'}
            </button>
            <button onClick={load} className="btn-ghost"><RefreshCcw size={14}/></button>
          </div>
        </div>

        {/* Filtros */}
        <div className="card p-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-56">
            <label className="text-xs text-muted">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"/>
              <input className="input pl-8" placeholder="Buscar tarea..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Estado</label>
            <select className="input !w-auto" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Responsable</label>
            <select className="input !w-auto" value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)}>
              <option value="">Todos</option>
              {miembros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Vencimiento</label>
            <select className="input !w-auto" value={filtroVenc} onChange={(e) => setFiltroVenc(e.target.value as FiltroVenc)}>
              <option value="cualquiera">Cualquiera</option>
              <option value="vencidas">Vencidas</option>
              <option value="hoy">Hoy</option>
              <option value="esta_semana">Esta semana</option>
              <option value="este_mes">Este mes</option>
              <option value="sin_fecha">Sin fecha</option>
            </select>
          </div>
          {vista === 'tabla' && (
            <div>
              <label className="text-xs text-muted">Agrupar por</label>
              <select className="input !w-auto" value={agrupacion} onChange={(e) => setAgrupacion(e.target.value as Agrupacion)}>
                <option value="ninguna">Sin agrupar</option>
                <option value="responsable">Responsable</option>
                <option value="estado">Estado</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="card p-10 text-center text-muted">Cargando...</div>
        ) : vista === 'tabla' ? (
          <TablaView
            tareas={filtradas}
            miembros={miembros}
            subtareasPorTarea={subtareasPorTarea}
            agrupacion={agrupacion}
            onEditar={setEditingId}
            onCambiarEstado={actualizarEstado}
          />
        ) : (
          <KanbanView
            tareas={filtradas}
            miembros={miembros}
            subtareasPorTarea={subtareasPorTarea}
            onEditar={setEditingId}
            onCambiarEstado={actualizarEstado}
          />
        )}
      </div>

      {editingId && (
        <TareaModal
          tareaId={editingId}
          miembros={miembros}
          onClose={() => setEditingId(null)}
        />
      )}
    </AppShell>
  );
}

/* =====================================================================
   VISTA TABLA
   ===================================================================== */

function TablaView({ tareas, miembros, subtareasPorTarea, agrupacion, onEditar, onCambiarEstado }: {
  tareas: Tarea[];
  miembros: Miembro[];
  subtareasPorTarea: Map<string, Subtarea[]>;
  agrupacion: Agrupacion;
  onEditar: (id: string) => void;
  onCambiarEstado: (t: Tarea, e: Estado) => void;
}) {
  // Agrupar
  const grupos = useMemo(() => {
    if (agrupacion === 'ninguna') return [{ key: '', label: '', tareas }];
    if (agrupacion === 'estado') {
      return ESTADOS.map((e) => ({
        key: e.id, label: e.label,
        tareas: tareas.filter((t) => t.estado === e.id),
      })).filter((g) => g.tareas.length > 0);
    }
    // por responsable
    const map = new Map<string, Tarea[]>();
    for (const t of tareas) {
      const k = t.responsable_id ?? '__sin__';
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([k, ts]) => ({
      key: k,
      label: k === '__sin__' ? 'Sin responsable' : (miembros.find((m) => m.id === k)?.nombre ?? '-'),
      tareas: ts,
    }));
  }, [tareas, agrupacion, miembros]);

  if (tareas.length === 0) {
    return <div className="card p-10 text-center text-muted text-sm">Sin tareas con esos filtros.</div>;
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.key} className="card overflow-hidden">
          {g.label && (
            <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wide text-muted font-medium bg-surface-2">
              {g.label} ({g.tareas.length})
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="tbl min-w-[900px]">
              <thead>
                <tr>
                  <th className="w-12">N°</th>
                  <th className="w-24">Creada</th>
                  <th>Tarea</th>
                  <th className="w-40">Estado</th>
                  <th className="w-24">Vence</th>
                  <th className="w-36">Responsable</th>
                  <th className="w-16">URL</th>
                  <th className="w-16">Adjunto</th>
                </tr>
              </thead>
              <tbody>
                {g.tareas.map((t) => {
                  const respNombre = miembros.find((m) => m.id === t.responsable_id)?.nombre;
                  const subs = subtareasPorTarea.get(t.id) ?? [];
                  const subsCompl = subs.filter((s) => s.completa).length;
                  const vencida = t.vencimiento && t.estado !== 'completo' && t.vencimiento < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={t.id} className="cursor-pointer" onClick={() => onEditar(t.id)}>
                      <td className="text-muted text-xs">{t.numero}</td>
                      <td className="text-xs text-muted whitespace-nowrap">{fmtFechaCorta(t.created_at)}</td>
                      <td>
                        <div className="font-medium text-sm">{t.titulo}</div>
                        {subs.length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-24 h-1 bg-surface-2 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${(subsCompl / subs.length) * 100}%` }}/>
                            </div>
                            <span className="text-xs text-muted">{subsCompl}/{subs.length}</span>
                          </div>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <EstadoSelect estado={t.estado} onChange={(e) => onCambiarEstado(t, e)} />
                      </td>
                      <td className={`text-xs whitespace-nowrap ${vencida ? 'text-danger font-medium' : ''}`}>
                        {fmtFechaCorta(t.vencimiento)}
                      </td>
                      <td className="text-sm">{respNombre ?? <span className="text-muted">—</span>}</td>
                      <td>{t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary"><LinkIcon size={14}/></a> : <span className="text-muted text-xs">—</span>}</td>
                      <td><IconAdjunto tareaId={t.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   VISTA KANBAN (con drag & drop nativo)
   ===================================================================== */

function KanbanView({ tareas, miembros, subtareasPorTarea, onEditar, onCambiarEstado }: {
  tareas: Tarea[];
  miembros: Miembro[];
  subtareasPorTarea: Map<string, Subtarea[]>;
  onEditar: (id: string) => void;
  onCambiarEstado: (t: Tarea, e: Estado) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Estado | null>(null);

  function onDrop(e: React.DragEvent, estado: Estado) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setOverCol(null);
    setDraggingId(null);
    if (!id) return;
    const t = tareas.find((x) => x.id === id);
    if (!t || t.estado === estado) return;
    onCambiarEstado(t, estado);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-2">
        {ESTADOS.map((e) => {
          const ts = tareas.filter((t) => t.estado === e.id);
          return (
            <div key={e.id}
              onDragOver={(ev) => { ev.preventDefault(); setOverCol(e.id); }}
              onDragLeave={() => setOverCol((c) => c === e.id ? null : c)}
              onDrop={(ev) => onDrop(ev, e.id)}
              className={`w-72 shrink-0 rounded border ${overCol === e.id ? 'border-primary bg-primary/5' : 'border-border bg-surface-2/50'} transition`}
            >
              <div className={`px-3 py-2 rounded-t ${e.bg} flex items-center justify-between`}>
                <span className={`font-medium text-sm ${e.color}`}>{e.label}</span>
                <span className="text-xs text-muted">{ts.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-64">
                {ts.length === 0 ? (
                  <div className="text-xs text-muted text-center py-4">Sin tareas</div>
                ) : ts.map((t) => {
                  const respNombre = miembros.find((m) => m.id === t.responsable_id)?.nombre;
                  const subs = subtareasPorTarea.get(t.id) ?? [];
                  const subsCompl = subs.filter((s) => s.completa).length;
                  const vencida = t.vencimiento && t.estado !== 'completo' && t.vencimiento < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={t.id}
                      draggable
                      onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', t.id); setDraggingId(t.id); }}
                      onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                      onClick={() => onEditar(t.id)}
                      className={`card p-3 cursor-pointer hover:shadow-card ${draggingId === t.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-1">
                        <span className="text-xs text-muted">#{t.numero}</span>
                        <div className="font-medium text-sm flex-1">{t.titulo}</div>
                      </div>
                      {subs.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Check size={12} className="text-muted"/>
                          <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(subsCompl / subs.length) * 100}%` }}/>
                          </div>
                          <span className="text-xs text-muted">{subsCompl}/{subs.length}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs">
                        {t.vencimiento ? (
                          <span className={`inline-flex items-center gap-1 ${vencida ? 'text-danger font-medium' : 'text-muted'}`}>
                            <Calendar size={12}/> {fmtFechaCorta(t.vencimiento)}
                          </span>
                        ) : <span/>}
                        {respNombre && (
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-fg flex items-center justify-center text-xs font-bold" title={respNombre}>
                            {iniciales(respNombre)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
   COMPONENTES AUXILIARES
   ===================================================================== */

function EstadoSelect({ estado, onChange }: { estado: Estado; onChange: (e: Estado) => void }) {
  const info = estadoInfo(estado);
  return (
    <select
      value={estado}
      onChange={(e) => onChange(e.target.value as Estado)}
      className={`text-xs px-2 py-1 rounded border-0 outline-none cursor-pointer ${info.bg} ${info.color} font-medium`}
    >
      {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
    </select>
  );
}

function IconAdjunto({ tareaId }: { tareaId: string }) {
  const supabase = createClient();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    supabase.from('tareas_adjuntos').select('id', { count: 'exact', head: true }).eq('tarea_id', tareaId)
      .then(({ count }) => setCount(count ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId]);
  if (count === null || count === 0) return <span className="text-muted text-xs">—</span>;
  return <span className="inline-flex items-center gap-1 text-primary text-xs"><Paperclip size={12}/> {count}</span>;
}

/* =====================================================================
   MODAL DE DETALLE DE TAREA
   ===================================================================== */

function TareaModal({ tareaId, miembros, onClose }: {
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
    if (!confirm(`¿Eliminar la tarea "${tarea.titulo}" y todas sus subtareas y adjuntos?`)) return;
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
    if (error) { alert(error.message); return; }
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
      alert(e.message ?? 'Error al subir el archivo.');
    } finally {
      setUploading(false);
    }
  }

  async function descargarAdjunto(a: Adjunto) {
    const { data, error } = await supabase.storage.from('tarea-files').createSignedUrl(a.archivo_url, 60);
    if (error || !data?.signedUrl) { alert('No se pudo generar el enlace.'); return; }
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = a.archivo_nombre;
    link.click();
  }

  async function eliminarAdjunto(a: Adjunto) {
    if (!confirm(`¿Eliminar el adjunto "${a.archivo_nombre}"?`)) return;
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
            <label className="text-xs text-muted uppercase tracking-wide">Estado</label>
            <select className="input" value={tarea.estado} onChange={(e) => actualizar({ estado: e.target.value as Estado })}>
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Vencimiento</label>
            <input type="date" className="input" defaultValue={tarea.vencimiento ?? ''}
              onBlur={(e) => actualizar({ vencimiento: e.target.value || null })} />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Responsable</label>
            <select className="input" value={tarea.responsable_id ?? ''} onChange={(e) => actualizar({ responsable_id: e.target.value || null })}>
              <option value="">— sin asignar —</option>
              {miembros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Recurrencia</label>
            <select className="input" value={tarea.recurrencia} onChange={(e) => actualizar({ recurrencia: e.target.value as Recurrencia })}>
              {RECURRENCIAS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted uppercase tracking-wide">URL</label>
            <input type="url" className="input" placeholder="https://..." defaultValue={tarea.url ?? ''}
              onBlur={(e) => actualizar({ url: e.target.value.trim() || null })} />
          </div>
        </div>

        {/* Subtareas */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted uppercase tracking-wide">Subtareas</label>
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
          <label className="text-xs text-muted uppercase tracking-wide">Detalle</label>
          <textarea
            className="input min-h-24"
            placeholder="Notas, contexto, pasos..."
            defaultValue={tarea.detalle ?? ''}
            onBlur={(e) => { if (e.target.value !== (tarea.detalle ?? '')) actualizar({ detalle: e.target.value || null }); }}
          />
        </div>

        {/* Adjuntos */}
        <div className="mt-4">
          <label className="text-xs text-muted uppercase tracking-wide">Adjuntos (PDF / foto / Excel / cualquiera)</label>
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

/* =====================================================================
   HELPERS
   ===================================================================== */

function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const dias = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${m[3]}-${dias[parseInt(m[2], 10) - 1]}`;
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
