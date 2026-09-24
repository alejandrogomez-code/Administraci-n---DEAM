'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Kanban, LayoutList, Plus, RefreshCcw, Search } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { avisar } from '@/components/feedback';
import { refrescarResumen } from '@/lib/sesion';
import { Cargando } from '@/components/Cargando';
import { KanbanView } from './_componentes/KanbanView';
import { TablaView } from './_componentes/TablaView';
import { TareaModal } from './_componentes/TareaModal';
import { Agrupacion, ESTADOS, Estado, FiltroVenc, Miembro, Subtarea, Tarea, Vista } from './_componentes/tipos';

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

  async function load(silencioso = false) {
    if (!silencioso) setLoading(true);
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
  // Primera carga + parámetros de la URL: ?abrir=<id> abre una tarea, ?nueva=1 crea una.
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    const abrir = q.get('abrir');
    if (abrir) setEditingId(abrir);
    else if (q.get('nueva') === '1') nuevaTarea();
    if (abrir || q.get('nueva')) window.history.replaceState(null, '', '/tareas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cerrar el modal, recargar en segundo plano (sin esqueleto) y actualizar contadores
  const [modalUsado, setModalUsado] = useState(false);
  useEffect(() => {
    if (editingId) { setModalUsado(true); return; }
    if (modalUsado) { load(true); refrescarResumen(); }
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
    if (error) { avisar(error.message); return; }
    setEditingId(data.id);
  }

  async function actualizarEstado(t: Tarea, estado: Estado) {
    const { error } = await supabase.from('tareas').update({ estado }).eq('id', t.id);
    if (error) { avisar(`No se pudo cambiar el estado: ${error.message}`, 'error'); return; }
    setTareas((arr) => arr.map((x) => x.id === t.id ? { ...x, estado } : x));
    refrescarResumen();
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
        actions={<button onClick={nuevaTarea} className="btn-primary"><Plus size={16}/> Nueva tarea</button>}
      />
      <div className="px-4 sm:px-6 py-5 space-y-4">
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
            <button onClick={() => load()} className="btn-ghost"><RefreshCcw size={14}/></button>
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
          <Cargando filas={6} enTarjeta />
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
