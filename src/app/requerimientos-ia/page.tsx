'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Copy, Loader2, Plus, RefreshCcw, Trash2, ExternalLink,
  FileSpreadsheet, FileText, Eye, EyeOff,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { exportarSolicitudExcel, exportarSolicitudPDF, exportarListadoExcel, exportarListadoPDF, type SolicitudExport } from '@/lib/reqia/exportar';

type Estado = 'solicitado' | 'analisis' | 'aprobado' | 'rechazado';

type ReqIA = {
  id: string;
  fecha: string | null;
  area: string;
  coordinador: string;
  problema: string;
  resultado: string | null;
  requerimiento: string;
  cantidad_licencias: number | null;
  estado: Estado;
  origen: 'formulario' | 'interno';
  notas: string | null;
};

type Licencia = {
  id: string;
  fecha: string | null;
  plataforma: string;
  area: string;
  necesidad: string;
  usuario: string;
  password: string;
  revision: boolean;
  notas: string | null;
};

const ESTADOS: { value: Estado; label: string; cls: string }[] = [
  { value: 'solicitado', label: 'Solicitado', cls: 'bg-accent/15 text-accent' },
  { value: 'analisis',   label: 'Análisis',   cls: 'bg-warning/15 text-warning' },
  { value: 'aprobado',   label: 'Aprobado',   cls: 'bg-success/15 text-success' },
  { value: 'rechazado',  label: 'Rechazado',  cls: 'bg-danger/15 text-danger' },
];
const estadoMeta = (e: Estado) => ESTADOS.find(x => x.value === e) ?? ESTADOS[0];

type Tab = 'solicitudes' | 'licencias';

export default function RequerimientosIAPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [tab, setTab] = useState<Tab>('solicitudes');

  const [rows, setRows] = useState<ReqIA[]>([]);
  const [lics, setLics] = useState<Licencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'' | Estado>('');
  const [busqueda, setBusqueda] = useState('');
  const [verPass, setVerPass] = useState<Record<string, boolean>>({});

  // ====== Guard: solo admin ======
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) { setReady(true); setAutorizado(false); } return; }
      const { data: prof } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
      if (!active) return;
      const ok = (prof as any)?.rol === 'admin';
      setAutorizado(ok);
      setReady(true);
      if (!ok) router.replace('/dashboard');
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    if (!autorizado) return;
    setLoading(true);
    const [{ data: sols, error: e1 }, { data: ls, error: e2 }] = await Promise.all([
      supabase.from('req_ia').select('*')
        .order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('req_ia_licencias').select('*')
        .order('fecha', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    if (e1) alert('Error al cargar solicitudes: ' + e1.message);
    if (e2) alert('Error al cargar licencias: ' + e2.message);
    setRows((sols as any) ?? []);
    setLics((ls as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { if (autorizado) loadData(); /* eslint-disable-next-line */ }, [autorizado]);

  // ---------- Solicitudes ----------
  async function agregar() {
    const nuevo = {
      fecha: new Date().toISOString().slice(0, 10),
      area: '', coordinador: '', problema: '', resultado: '', requerimiento: '',
      cantidad_licencias: null, estado: 'solicitado' as Estado,
      origen: 'interno' as const, notas: '',
    };
    const { data, error } = await supabase.from('req_ia').insert(nuevo).select('*').single();
    if (error) { alert('Error al crear: ' + error.message); return; }
    setRows(prev => [data as any, ...prev]);
  }
  async function actualizar(id: string, cambios: Partial<ReqIA>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...cambios } as ReqIA : r));
    const { error } = await supabase.from('req_ia').update(cambios).eq('id', id);
    if (error) alert('Error al guardar: ' + error.message);
  }
  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este requerimiento?')) return;
    const { error } = await supabase.from('req_ia').delete().eq('id', id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function toExport(r: ReqIA): SolicitudExport {
    return {
      fecha: r.fecha, area: r.area, coordinador: r.coordinador, problema: r.problema,
      resultado: r.resultado,
      requerimiento: r.requerimiento, cantidad_licencias: r.cantidad_licencias,
      estado: estadoMeta(r.estado).label,
      origen: r.origen === 'formulario' ? 'Formulario' : 'Interno',
      notas: r.notas,
    };
  }

  // ---------- Licencias ----------
  async function agregarLic() {
    const nueva = {
      fecha: new Date().toISOString().slice(0, 10),
      plataforma: '', area: '', necesidad: '', usuario: '', password: '',
      revision: false, notas: '',
    };
    const { data, error } = await supabase.from('req_ia_licencias').insert(nueva).select('*').single();
    if (error) { alert('Error al crear: ' + error.message); return; }
    setLics(prev => [data as any, ...prev]);
  }
  async function actualizarLic(id: string, cambios: Partial<Licencia>) {
    setLics(prev => prev.map(l => l.id === id ? { ...l, ...cambios } as Licencia : l));
    const { error } = await supabase.from('req_ia_licencias').update(cambios).eq('id', id);
    if (error) alert('Error al guardar: ' + error.message);
  }
  async function eliminarLic(id: string) {
    if (!confirm('¿Eliminar esta licencia?')) return;
    const { error } = await supabase.from('req_ia_licencias').delete().eq('id', id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    setLics(prev => prev.filter(l => l.id !== id));
  }

  function copiarLinkFormulario() {
    const url = `${window.location.origin}/solicitud-ia`;
    navigator.clipboard.writeText(url);
    alert('Link del formulario copiado:\n' + url);
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter(r => {
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (!q) return true;
      return [r.area, r.coordinador, r.problema, r.resultado, r.requerimiento]
        .some(v => (v ?? '').toLowerCase().includes(q));
    });
  }, [rows, filtroEstado, busqueda]);

  const conteos = useMemo(() => {
    const c: Record<string, number> = { solicitado: 0, analisis: 0, aprobado: 0, rechazado: 0 };
    for (const r of rows) c[r.estado] = (c[r.estado] ?? 0) + 1;
    return c;
  }, [rows]);

  if (!ready) return <AppShell><div className="p-10 text-center text-muted">Cargando...</div></AppShell>;

  if (!autorizado) {
    return (
      <AppShell>
        <TopBar titulo="Acceso denegado" />
        <div className="p-6 max-w-xl">
          <div className="card p-6 border-l-4 border-l-danger">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-danger shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-semibold">No tenés permisos para acceder a esta sección</div>
                <p className="text-sm text-muted mt-1">Requerimientos de Sistemas: IA está restringido al rol administrador.</p>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar
        titulo="Requerimientos de Sistemas: IA"
        subtitulo="Solicitudes de acceso y registro de licencias vigentes"
        actions={
          <>
            <button onClick={copiarLinkFormulario} className="btn-secondary" title="Copiar link del formulario público">
              <Copy size={16} /> Link formulario
            </button>
            <a href="/solicitud-ia" target="_blank" rel="noreferrer" className="btn-ghost" title="Abrir formulario">
              <ExternalLink size={16} />
            </a>
            <button onClick={loadData} className="btn-ghost" title="Refrescar"><RefreshCcw size={16} /></button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* Pestañas */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            onClick={() => setTab('solicitudes')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === 'solicitudes' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
          >
            Solicitudes {rows.length > 0 && <span className="text-xs text-muted">({rows.length})</span>}
          </button>
          <button
            onClick={() => setTab('licencias')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === 'licencias' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
          >
            Licencias vigentes {lics.length > 0 && <span className="text-xs text-muted">({lics.length})</span>}
          </button>
        </div>

        {/* ================= SOLICITUDES ================= */}
        {tab === 'solicitudes' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ESTADOS.map(e => (
                <button
                  key={e.value}
                  onClick={() => setFiltroEstado(filtroEstado === e.value ? '' : e.value)}
                  className={`card p-3 text-left transition ${filtroEstado === e.value ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="text-xs text-muted">{e.label}</div>
                  <div className="text-2xl font-semibold">{conteos[e.value] ?? 0}</div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input max-w-xs"
                placeholder="Buscar por área, coordinador, problema..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              {filtroEstado && (
                <button onClick={() => setFiltroEstado('')} className="btn-ghost text-xs">Quitar filtro de estado</button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => exportarListadoPDF(filtradas.map(toExport))}
                  disabled={filtradas.length === 0}
                  className="btn-secondary disabled:opacity-50"
                  title="Descargar todas en PDF"
                >
                  <FileText size={16} /> PDF
                </button>
                <button
                  onClick={() => exportarListadoExcel(filtradas.map(toExport))}
                  disabled={filtradas.length === 0}
                  className="btn-secondary disabled:opacity-50"
                  title="Descargar todas en Excel"
                >
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button onClick={agregar} className="btn-primary"><Plus size={16} /> Nueva solicitud</button>
              </div>
            </div>

            <div className="card overflow-x-auto">
              {loading ? (
                <div className="p-10 text-center text-muted flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={18} /> Cargando...
                </div>
              ) : filtradas.length === 0 ? (
                <div className="p-10 text-center text-muted">
                  No hay solicitudes {filtroEstado || busqueda ? 'con esos filtros' : 'todavía'}.
                </div>
              ) : (
                <table className="tbl min-w-[1350px]">
                  <thead>
                    <tr>
                      <th className="w-32">Fecha</th>
                      <th className="w-36">Área solicitante</th>
                      <th className="w-36">Coordinador</th>
                      <th>Proyecto / automatización</th>
                      <th>Resultado esperado</th>
                      <th>Requerimiento / Plataforma</th>
                      <th className="w-20">Lic.</th>
                      <th className="w-36">Estado</th>
                      <th className="w-24">Origen</th>
                      <th className="w-28 text-center">Descargar</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(r => (
                      <tr key={r.id} className="align-top">
                        <td>
                          <input type="date" className="input py-1 text-sm" value={r.fecha ?? ''}
                            onChange={e => actualizar(r.id, { fecha: e.target.value || null })} />
                        </td>
                        <td>
                          <input className="input py-1 text-sm" value={r.area}
                            onChange={e => actualizar(r.id, { area: e.target.value })} />
                        </td>
                        <td>
                          <input className="input py-1 text-sm" value={r.coordinador}
                            onChange={e => actualizar(r.id, { coordinador: e.target.value })} />
                        </td>
                        <td>
                          <textarea rows={2} className="input py-1 text-sm resize-y" value={r.problema}
                            onChange={e => actualizar(r.id, { problema: e.target.value })} />
                        </td>
                        <td>
                          <textarea rows={2} className="input py-1 text-sm resize-y" value={r.resultado ?? ''}
                            onChange={e => actualizar(r.id, { resultado: e.target.value })} />
                        </td>
                        <td>
                          <textarea rows={2} className="input py-1 text-sm resize-y" value={r.requerimiento}
                            onChange={e => actualizar(r.id, { requerimiento: e.target.value })} />
                        </td>
                        <td>
                          <input type="number" min={0} className="input py-1 text-sm"
                            value={r.cantidad_licencias ?? ''}
                            onChange={e => actualizar(r.id, {
                              cantidad_licencias: e.target.value === '' ? null : Number(e.target.value),
                            })} />
                        </td>
                        <td>
                          <select
                            className={`input py-1 text-sm font-medium ${estadoMeta(r.estado).cls}`}
                            value={r.estado}
                            onChange={e => actualizar(r.id, { estado: e.target.value as Estado })}
                          >
                            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <span className={`chip ${r.origen === 'formulario' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted'}`}>
                            {r.origen === 'formulario' ? 'Formulario' : 'Interno'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => exportarSolicitudPDF(toExport(r))}
                              className="btn-ghost p-1.5" title="Descargar PDF">
                              <FileText size={16} />
                            </button>
                            <button onClick={() => exportarSolicitudExcel(toExport(r))}
                              className="btn-ghost p-1.5" title="Descargar Excel">
                              <FileSpreadsheet size={16} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <button onClick={() => eliminar(r.id)} className="btn-ghost p-1.5 text-danger" title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ================= LICENCIAS VIGENTES ================= */}
        {tab === 'licencias' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted">Registro de licencias de IA activas.</p>
              <button onClick={agregarLic} className="btn-primary ml-auto"><Plus size={16} /> Nueva licencia</button>
            </div>

            <div className="card overflow-x-auto">
              {loading ? (
                <div className="p-10 text-center text-muted flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={18} /> Cargando...
                </div>
              ) : lics.length === 0 ? (
                <div className="p-10 text-center text-muted">No hay licencias registradas todavía.</div>
              ) : (
                <table className="tbl min-w-[1100px]">
                  <thead>
                    <tr>
                      <th className="w-32">Fecha</th>
                      <th className="w-36">Plataforma</th>
                      <th className="w-32">Área</th>
                      <th>Necesidad</th>
                      <th className="w-44">Usuario</th>
                      <th className="w-52">Contraseña</th>
                      <th className="w-28 text-center">Revisión</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lics.map(l => (
                      <tr key={l.id} className="align-top">
                        <td>
                          <input type="date" className="input py-1 text-sm" value={l.fecha ?? ''}
                            onChange={e => actualizarLic(l.id, { fecha: e.target.value || null })} />
                        </td>
                        <td>
                          <input className="input py-1 text-sm" placeholder="ChatGPT, Claude..." value={l.plataforma}
                            onChange={e => actualizarLic(l.id, { plataforma: e.target.value })} />
                        </td>
                        <td>
                          <input className="input py-1 text-sm" value={l.area}
                            onChange={e => actualizarLic(l.id, { area: e.target.value })} />
                        </td>
                        <td>
                          <textarea rows={2} className="input py-1 text-sm resize-y" value={l.necesidad}
                            onChange={e => actualizarLic(l.id, { necesidad: e.target.value })} />
                        </td>
                        <td>
                          <input className="input py-1 text-sm" value={l.usuario}
                            onChange={e => actualizarLic(l.id, { usuario: e.target.value })} />
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <input
                              type={verPass[l.id] ? 'text' : 'password'}
                              className="input py-1 text-sm font-mono"
                              value={l.password}
                              onChange={e => actualizarLic(l.id, { password: e.target.value })}
                            />
                            <button
                              onClick={() => setVerPass(s => ({ ...s, [l.id]: !s[l.id] }))}
                              className="btn-ghost p-1.5 shrink-0"
                              title={verPass[l.id] ? 'Ocultar' : 'Mostrar'}
                            >
                              {verPass[l.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => actualizarLic(l.id, { revision: !l.revision })}
                              className={`chip ${l.revision ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}
                              title="Alternar revisión"
                            >
                              {l.revision ? 'Sí' : 'No'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <button onClick={() => eliminarLic(l.id)} className="btn-ghost p-1.5 text-danger" title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
