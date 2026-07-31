'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Copy, Download, Loader2, Plus, RefreshCcw, Trash2, ExternalLink,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';

type Estado = 'solicitado' | 'analisis' | 'aprobado' | 'rechazado';

type ReqIA = {
  id: string;
  fecha: string | null;
  area: string;
  coordinador: string;
  problema: string;
  requerimiento: string;
  cantidad_licencias: number | null;
  estado: Estado;
  origen: 'formulario' | 'interno';
  notas: string | null;
  created_at?: string;
  updated_at?: string;
};

const ESTADOS: { value: Estado; label: string; cls: string }[] = [
  { value: 'solicitado', label: 'Solicitado', cls: 'bg-accent/15 text-accent' },
  { value: 'analisis',   label: 'Análisis',   cls: 'bg-warning/15 text-warning' },
  { value: 'aprobado',   label: 'Aprobado',   cls: 'bg-success/15 text-success' },
  { value: 'rechazado',  label: 'Rechazado',  cls: 'bg-danger/15 text-danger' },
];

function estadoMeta(e: Estado) {
  return ESTADOS.find(x => x.value === e) ?? ESTADOS[0];
}

export default function RequerimientosIAPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [autorizado, setAutorizado] = useState(false);

  const [rows, setRows] = useState<ReqIA[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'' | Estado>('');
  const [busqueda, setBusqueda] = useState('');

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
    const { data, error } = await supabase
      .from('req_ia')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { alert('Error al cargar: ' + error.message); setLoading(false); return; }
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { if (autorizado) loadData(); /* eslint-disable-next-line */ }, [autorizado]);

  async function agregar() {
    const nuevo = {
      fecha: new Date().toISOString().slice(0, 10),
      area: '', coordinador: '', problema: '', requerimiento: '',
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

  function copiarLinkFormulario() {
    const url = `${window.location.origin}/solicitud-ia`;
    navigator.clipboard.writeText(url);
    alert('Link del formulario copiado:\n' + url);
  }

  function exportarCSV() {
    const cols = ['Fecha', 'Área solicitante', 'Coordinador', 'Problema', 'Requerimiento / Plataforma', 'Licencias', 'Estado', 'Origen'];
    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lineas = [cols.join(',')];
    for (const r of filtradas) {
      lineas.push([
        r.fecha ?? '', r.area, r.coordinador, r.problema, r.requerimiento,
        r.cantidad_licencias ?? '', estadoMeta(r.estado).label, r.origen,
      ].map(esc).join(','));
    }
    const blob = new Blob(['\ufeff' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requerimientos-ia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter(r => {
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (!q) return true;
      return [r.area, r.coordinador, r.problema, r.requerimiento]
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
        subtitulo="Solicitudes de acceso a plataformas de IA de las áreas"
        actions={
          <>
            <button onClick={copiarLinkFormulario} className="btn-secondary" title="Copiar link del formulario público">
              <Copy size={16} /> Link formulario
            </button>
            <a href="/solicitud-ia" target="_blank" rel="noreferrer" className="btn-ghost" title="Abrir formulario">
              <ExternalLink size={16} />
            </a>
            <button onClick={exportarCSV} className="btn-secondary"><Download size={16} /> CSV</button>
            <button onClick={loadData} className="btn-ghost" title="Refrescar"><RefreshCcw size={16} /></button>
            <button onClick={agregar} className="btn-primary"><Plus size={16} /> Nuevo</button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* Resumen por estado */}
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

        {/* Filtros */}
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
          <div className="text-xs text-muted ml-auto">{filtradas.length} de {rows.length}</div>
        </div>

        {/* Tabla */}
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-muted flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={18} /> Cargando requerimientos...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-10 text-center text-muted">
              No hay requerimientos {filtroEstado || busqueda ? 'con esos filtros' : 'todavía'}.
            </div>
          ) : (
            <table className="tbl min-w-[1050px]">
              <thead>
                <tr>
                  <th className="w-32">Fecha</th>
                  <th className="w-40">Área solicitante</th>
                  <th className="w-40">Coordinador</th>
                  <th>Problema a abordar</th>
                  <th>Requerimiento / Plataforma</th>
                  <th className="w-24">Licencias</th>
                  <th className="w-40">Estado</th>
                  <th className="w-24">Origen</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(r => (
                  <tr key={r.id} className="align-top">
                    <td>
                      <input
                        type="date"
                        className="input py-1 text-sm"
                        value={r.fecha ?? ''}
                        onChange={e => actualizar(r.id, { fecha: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        className="input py-1 text-sm"
                        value={r.area}
                        onChange={e => actualizar(r.id, { area: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input py-1 text-sm"
                        value={r.coordinador}
                        onChange={e => actualizar(r.id, { coordinador: e.target.value })}
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        className="input py-1 text-sm resize-y"
                        value={r.problema}
                        onChange={e => actualizar(r.id, { problema: e.target.value })}
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        className="input py-1 text-sm resize-y"
                        value={r.requerimiento}
                        onChange={e => actualizar(r.id, { requerimiento: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="input py-1 text-sm"
                        value={r.cantidad_licencias ?? ''}
                        onChange={e => actualizar(r.id, {
                          cantidad_licencias: e.target.value === '' ? null : Number(e.target.value),
                        })}
                      />
                    </td>
                    <td>
                      <select
                        className={`input py-1 text-sm font-medium ${estadoMeta(r.estado).cls}`}
                        value={r.estado}
                        onChange={e => actualizar(r.id, { estado: e.target.value as Estado })}
                      >
                        {ESTADOS.map(e => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`chip ${r.origen === 'formulario' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted'}`}>
                        {r.origen === 'formulario' ? 'Formulario' : 'Interno'}
                      </span>
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
      </div>
    </AppShell>
  );
}
