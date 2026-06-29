'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, Download, FileCheck2, FileDown, FileText, Loader2,
  Plus, RefreshCcw, Trash2, Upload, X,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, fmtMoney } from '@/lib/format';
import { parseCheques } from '@/lib/cheques/parseCheques';
import { calcularResumen, diasEntre } from '@/lib/cheques/calculos';
import { descargarPlantillaCheques } from '@/lib/cheques/plantilla';
import * as XLSX from 'xlsx';

type Cheque = {
  id: string;
  vencimiento: string;
  asignacion: string | null;
  importe: number;
  librador: string | null;
  banco: string | null;
  cuit: string | null;
  tipo: string | null;
  status: number | null;
  observaciones: string | null;
  propuesta_id: string | null;
};

type Propuesta = {
  id: string;
  nombre: string;
  fecha_venta: string | null;
  tasa: number | null;
  banco_operacion: string | null;
  notas: string | null;
  estado: string;
  created_at: string;
  // Snapshot
  snap_cantidad: number | null;
  snap_total_a_vender: number | null;
  snap_aproximado_a_percibir: number | null;
  snap_costo_aproximado: number | null;
  snap_cft_pct: number | null;
  snap_plazo_promedio: number | null;
  snap_finalizada_en: string | null;
};

type ClienteProblema = {
  id: string;
  librador: string;
  cuit: string;
  motivo: string | null;
  activo: boolean;
};

type Librador = {
  id: string;
  nombre: string;
  cuit: string | null;
  observaciones: string | null;
  activo: boolean;
};

type Tab = 'cheques' | 'propuestas' | 'libradores' | 'problemas';

export default function VentaChequesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('cheques');

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [problemas, setProblemas] = useState<ClienteProblema[]>([]);
  const [libradores, setLibradores] = useState<Librador[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: ch }, { data: pr }, { data: pb }, { data: lb }] = await Promise.all([
      supabase.from('cheques').select('*').order('vencimiento').order('importe', { ascending: false }),
      supabase.from('propuestas_cheques').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes_problemas').select('*').eq('activo', true).order('librador'),
      supabase.from('libradores').select('*').order('nombre'),
    ]);
    setCheques((ch as any) ?? []);
    setPropuestas((pr as any) ?? []);
    setProblemas((pb as any) ?? []);
    setLibradores((lb as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const cuitsProblema = useMemo(() => new Set(problemas.map((p) => p.cuit)), [problemas]);

  return (
    <AppShell>
      <TopBar
        titulo="Venta de cheques"
        subtitulo="Carga, simulador, propuestas y clientes con problemas"
        actions={<Link href="/tesoreria" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-1 border-b border-border">
          <TabBtn active={tab==='cheques'} onClick={() => setTab('cheques')}>
            Cheques ({cheques.length})
          </TabBtn>
          <TabBtn active={tab==='propuestas'} onClick={() => setTab('propuestas')}>
            Propuestas / Simulador ({propuestas.length})
          </TabBtn>
          <TabBtn active={tab==='libradores'} onClick={() => setTab('libradores')}>
            Libradores ({libradores.length})
          </TabBtn>
          <TabBtn active={tab==='problemas'} onClick={() => setTab('problemas')}>
            Clientes con problemas ({problemas.length})
          </TabBtn>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-muted">Cargando...</div>
        ) : (
          <>
            {tab === 'cheques' && <ChequesTab cheques={cheques} propuestas={propuestas} cuitsProblema={cuitsProblema} problemas={problemas} libradores={libradores} reload={load} />}
            {tab === 'propuestas' && <PropuestasTab propuestas={propuestas} cheques={cheques} reload={load} router={router} />}
            {tab === 'libradores' && <LibradoresTab libradores={libradores} reload={load} />}
            {tab === 'problemas' && <ProblemasTab problemas={problemas} reload={load} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>
      {children}
    </button>
  );
}

/* ============================================================
   TAB 1: CHEQUES (lista, filtros, importar Excel, asignar a propuesta)
   ============================================================ */
function ChequesTab({ cheques, propuestas, cuitsProblema, problemas, libradores, reload }: {
  cheques: Cheque[];
  propuestas: Propuesta[];
  cuitsProblema: Set<string>;
  problemas: ClienteProblema[];
  libradores: Librador[];
  reload: () => void;
}) {
  const supabase = createClient();
  const [showImport, setShowImport] = useState(false);
  const [showNuevoCheque, setShowNuevoCheque] = useState(false);
  const [showLimpiar, setShowLimpiar] = useState(false);
  const [fechaVenta, setFechaVenta] = useState<string>('');
  const [filtros, setFiltros] = useState({
    busqueda: '', banco: '', cuit: '', status: '', soloDisponibles: true, soloProblemas: false,
    vencDesde: '', vencHasta: '',
  });
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const filtrados = useMemo(() => {
    const q = filtros.busqueda.toLowerCase().trim();
    return cheques.filter((c) => {
      if (filtros.soloDisponibles && c.propuesta_id) return false;
      if (filtros.soloProblemas && (!c.cuit || !cuitsProblema.has(c.cuit))) return false;
      if (filtros.banco && (c.banco ?? '').toLowerCase() !== filtros.banco.toLowerCase()) return false;
      if (filtros.cuit && !(c.cuit ?? '').includes(filtros.cuit)) return false;
      if (filtros.status !== '' && c.status !== parseInt(filtros.status)) return false;
      if (filtros.vencDesde && c.vencimiento < filtros.vencDesde) return false;
      if (filtros.vencHasta && c.vencimiento > filtros.vencHasta) return false;
      if (q && !(
        (c.librador ?? '').toLowerCase().includes(q) ||
        (c.banco ?? '').toLowerCase().includes(q) ||
        (c.cuit ?? '').includes(q) ||
        (c.asignacion ?? '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [cheques, filtros, cuitsProblema]);

  const totalSeleccion = useMemo(() =>
    filtrados.filter((c) => seleccion.has(c.id)).reduce((acc, c) => acc + c.importe, 0),
    [filtrados, seleccion]
  );

  const totalFiltrado = useMemo(() =>
    filtrados.reduce((acc, c) => acc + c.importe, 0), [filtrados]);

  function toggleSel(id: string) {
    setSeleccion((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  }

  function toggleAllVisibles() {
    if (filtrados.every((c) => seleccion.has(c.id))) {
      setSeleccion(new Set());
    } else {
      setSeleccion(new Set(filtrados.map((c) => c.id)));
    }
  }

  async function asignarAPropuesta(propuestaId: string) {
    if (seleccion.size === 0) return;
    if (!confirm(`Asignar ${seleccion.size} cheque${seleccion.size === 1 ? '' : 's'} a la propuesta seleccionada?`)) return;
    const { error } = await supabase.from('cheques').update({ propuesta_id: propuestaId }).in('id', Array.from(seleccion));
    if (error) { alert(error.message); return; }
    setSeleccion(new Set());
    reload();
  }

  async function nuevaPropuestaConSeleccion() {
    if (seleccion.size === 0) return;
    const nombre = prompt('Nombre de la nueva propuesta:', `Propuesta ${new Date().toLocaleDateString('es-AR')}`);
    if (!nombre) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prop, error } = await supabase.from('propuestas_cheques').insert({
      nombre, fecha_venta: fechaVenta || null, estado: 'borrador', created_by: user?.id,
    }).select('id').single();
    if (error) { alert(error.message); return; }
    await supabase.from('cheques').update({ propuesta_id: prop.id }).in('id', Array.from(seleccion));
    setSeleccion(new Set());
    reload();
    alert(`Propuesta creada con ${seleccion.size} cheque${seleccion.size === 1 ? '' : 's'}.`);
  }

  async function eliminarSeleccionados() {
    if (seleccion.size === 0) return;
    if (!confirm(`¿Eliminar ${seleccion.size} cheque(s)?`)) return;
    await supabase.from('cheques').delete().in('id', Array.from(seleccion));
    setSeleccion(new Set());
    reload();
  }

  function obsCheque(c: Cheque): string | null {
    if (c.cuit && cuitsProblema.has(c.cuit)) {
      const p = problemas.find((x) => x.cuit === c.cuit);
      return `⚠️ Problemas para negociar${p?.motivo ? ' — ' + p.motivo : ''}`;
    }
    return c.observaciones ?? null;
  }

  // bancos únicos para filtro
  const bancosUnicos = useMemo(() => Array.from(new Set(cheques.map((c) => c.banco).filter((b): b is string => !!b))).sort(), [cheques]);

  return (
    <>
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Fecha de venta:</span>
            <input type="date" className="input !w-auto !py-1 text-sm" value={fechaVenta} onChange={(e) => setFechaVenta(e.target.value)} />
            <span className="text-xs text-muted">(para calcular los días al vencimiento)</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowLimpiar(true)} className="btn-ghost text-sm text-danger" title="Vaciar la cartera de cheques"><Trash2 size={14}/> Limpiar cartera</button>
            <button onClick={() => setShowNuevoCheque(true)} className="btn-secondary text-sm"><Plus size={14}/> Cheque manual</button>
            <button onClick={() => setShowImport(true)} className="btn-primary text-sm"><Upload size={14}/> Importar Excel</button>
          </div>
        </div>
      </div>

      <div className="card p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
        <div>
          <label className="text-xs text-muted">Buscar</label>
          <input className="input !py-1.5" placeholder="Librador, banco, CUIT..." value={filtros.busqueda} onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted">Banco</label>
          <select className="input !py-1.5" value={filtros.banco} onChange={(e) => setFiltros({ ...filtros, banco: e.target.value })}>
            <option value="">Todos</option>
            {bancosUnicos.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">CUIT</label>
          <input className="input !py-1.5" value={filtros.cuit} onChange={(e) => setFiltros({ ...filtros, cuit: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted">Status</label>
          <select className="input !py-1.5" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}>
            <option value="">Todos</option>
            {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">Vence desde</label>
          <input type="date" className="input !py-1.5" value={filtros.vencDesde} onChange={(e) => setFiltros({ ...filtros, vencDesde: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted">Vence hasta</label>
          <input type="date" className="input !py-1.5" value={filtros.vencHasta} onChange={(e) => setFiltros({ ...filtros, vencHasta: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={filtros.soloDisponibles} onChange={(e) => setFiltros({ ...filtros, soloDisponibles: e.target.checked })} />
          Sólo disponibles (no asignados)
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={filtros.soloProblemas} onChange={(e) => setFiltros({ ...filtros, soloProblemas: e.target.checked })} />
          Sólo con problemas
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            {filtrados.length} cheque{filtrados.length === 1 ? '' : 's'} · Total {fmtMoney(totalFiltrado)}
            {seleccion.size > 0 && <span className="ml-2 text-primary">· {seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'} ({fmtMoney(totalSeleccion)})</span>}
          </div>
          {seleccion.size > 0 && (
            <div className="flex gap-2 items-center">
              <select className="input !w-auto !py-1 text-xs" onChange={(e) => e.target.value && asignarAPropuesta(e.target.value)} defaultValue="">
                <option value="" disabled>Asignar a propuesta existente...</option>
                {propuestas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <button onClick={nuevaPropuestaConSeleccion} className="btn-primary text-xs"><Plus size={12}/> Nueva propuesta</button>
              <button onClick={eliminarSeleccionados} className="btn-ghost text-xs text-danger"><Trash2 size={12}/></button>
              <button onClick={() => setSeleccion(new Set())} className="btn-ghost text-xs"><X size={12}/></button>
            </div>
          )}
          <button onClick={reload} className="btn-ghost text-sm"><RefreshCcw size={14}/></button>
        </div>

        {filtrados.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
            {cheques.length === 0 ? <>Sin cheques cargados. <button className="text-primary" onClick={() => setShowImport(true)}>Importar Excel</button>.</> : 'Sin resultados con esos filtros.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[1100px]">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" checked={filtrados.length > 0 && filtrados.every((c) => seleccion.has(c.id))} onChange={toggleAllVisibles} />
                  </th>
                  <th>Vencimiento</th>
                  <th>Días</th>
                  <th>Asignación</th>
                  <th className="text-right">Importe</th>
                  <th>Librador</th>
                  <th>Banco</th>
                  <th>CUIT</th>
                  <th>Status</th>
                  <th>Propuesta</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const dias = diasEntre(fechaVenta || null, c.vencimiento);
                  const propNombre = propuestas.find((p) => p.id === c.propuesta_id)?.nombre;
                  const obs = obsCheque(c);
                  const tieneProblema = c.cuit && cuitsProblema.has(c.cuit);
                  return (
                    <tr key={c.id} className={`${tieneProblema ? 'bg-warning/5' : ''} ${c.propuesta_id ? 'opacity-70' : ''}`}>
                      <td><input type="checkbox" checked={seleccion.has(c.id)} onChange={() => toggleSel(c.id)} /></td>
                      <td className="whitespace-nowrap">{fmtFecha(c.vencimiento)}</td>
                      <td className="text-xs text-muted">{dias != null ? dias : '-'}</td>
                      <td className="text-xs">{c.asignacion ?? '-'}</td>
                      <td className="text-right font-medium">{fmtMoney(c.importe)}</td>
                      <td className="text-xs max-w-48 truncate">{c.librador ?? '-'}</td>
                      <td className="text-xs max-w-40 truncate">{c.banco ?? '-'}</td>
                      <td className="text-xs">{c.cuit ?? '-'}</td>
                      <td><span className="chip bg-surface-2 text-text">{c.status ?? '-'}</span></td>
                      <td className="text-xs">{propNombre ?? <span className="text-muted">—</span>}</td>
                      <td className="text-xs">
                        {tieneProblema ? (
                          <span className="text-warning inline-flex items-center gap-1"><AlertTriangle size={12}/> {obs}</span>
                        ) : (obs ?? <span className="text-muted">—</span>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && <ImportModal libradores={libradores} onClose={() => setShowImport(false)} onDone={reload} />}
      {showNuevoCheque && <NuevoChequeModal libradores={libradores} onClose={() => setShowNuevoCheque(false)} onDone={reload} />}
      {showLimpiar && <LimpiarCarteraModal cheques={cheques} propuestas={propuestas} onClose={() => setShowLimpiar(false)} onDone={reload} />}
    </>
  );
}

/* ============================================================
   TAB 2: PROPUESTAS / SIMULADOR
   ============================================================ */
function PropuestasTab({ propuestas, cheques, reload, router }: {
  propuestas: Propuesta[];
  cheques: Cheque[];
  reload: () => void;
  router: any;
}) {
  const supabase = createClient();

  async function crear() {
    const nombre = prompt('Nombre de la nueva propuesta:', `Propuesta ${new Date().toLocaleDateString('es-AR')}`);
    if (!nombre) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('propuestas_cheques').insert({ nombre, estado: 'borrador', created_by: user?.id }).select('id').single();
    if (error) { alert(error.message); return; }
    router.push(`/tesoreria/venta-cheques/propuestas/${data.id}`);
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="text-sm">{propuestas.length} propuesta{propuestas.length === 1 ? '' : 's'}</div>
        <button onClick={crear} className="btn-primary text-sm"><Plus size={14}/> Nueva propuesta</button>
      </div>
      {propuestas.length === 0 ? (
        <div className="p-10 text-center text-muted text-sm">
          Sin propuestas. <button className="text-primary" onClick={crear}>Crear la primera</button> o asignar cheques desde la solapa Cheques.
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha venta</th>
              <th>Tasa</th>
              <th>Banco</th>
              <th>Cheques</th>
              <th className="text-right">Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {propuestas.map((p) => {
              const usaSnap = !!p.snap_finalizada_en;
              const chs = cheques.filter((c) => c.propuesta_id === p.id);
              const resumenLive = calcularResumen(chs, p.fecha_venta, p.tasa);
              const cantidad = usaSnap ? (p.snap_cantidad ?? 0) : chs.length;
              const total = usaSnap ? Number(p.snap_total_a_vender ?? 0) : resumenLive.total_a_vender;
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.nombre}</td>
                  <td className="text-xs">{fmtFecha(p.fecha_venta)}</td>
                  <td className="text-xs">{p.tasa != null ? p.tasa + '%' : '-'}</td>
                  <td className="text-xs">{p.banco_operacion ?? '-'}</td>
                  <td className="text-xs">{cantidad}</td>
                  <td className="text-right font-medium">{fmtMoney(total)}</td>
                  <td><span className={`chip ${p.estado === 'finalizada' ? 'chip-completado' : p.estado === 'cancelada' ? 'chip-falta-sap' : 'chip-en-proceso'}`}>{p.estado}</span></td>
                  <td><Link className="text-primary text-sm" href={`/tesoreria/venta-cheques/propuestas/${p.id}`}>Ver →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ============================================================
   TAB 3: CLIENTES CON PROBLEMAS
   ============================================================ */
function ProblemasTab({ problemas, reload }: { problemas: ClienteProblema[]; reload: () => void }) {
  const supabase = createClient();
  const [librador, setLibrador] = useState('');
  const [cuit, setCuit] = useState('');
  const [motivo, setMotivo] = useState('');

  async function agregar() {
    if (!librador.trim() || !cuit.trim()) { alert('Librador y CUIT son obligatorios.'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const cuitClean = cuit.replace(/[^0-9]/g, '');
    const { error } = await supabase.from('clientes_problemas').insert({
      librador: librador.trim(), cuit: cuitClean, motivo: motivo.trim() || null,
      created_by: user?.id,
    });
    if (error) { alert(error.message); return; }
    setLibrador(''); setCuit(''); setMotivo('');
    reload();
  }

  async function actualizar(p: ClienteProblema, cambios: Partial<ClienteProblema>) {
    await supabase.from('clientes_problemas').update(cambios).eq('id', p.id);
    reload();
  }

  async function eliminar(p: ClienteProblema) {
    if (!confirm(`Eliminar "${p.librador}" de la lista?`)) return;
    await supabase.from('clientes_problemas').delete().eq('id', p.id);
    reload();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="card p-4">
        <div className="text-sm font-medium mb-3">Agregar a la lista</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted">Librador</label>
            <input className="input" value={librador} onChange={(e) => setLibrador(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">CUIT</label>
            <input className="input" value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="30..." />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={agregar}><Plus size={14}/> Agregar</button>
          </div>
          <div className="sm:col-span-4">
            <label className="text-xs text-muted">Motivo (opcional)</label>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: incumplimiento previo, observado por banco, etc." />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm">{problemas.length} cliente{problemas.length === 1 ? '' : 's'} con problemas</div>
        {problemas.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">Sin registros todavía.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Librador</th>
                <th>CUIT</th>
                <th>Motivo</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {problemas.map((p) => (
                <tr key={p.id} className={!p.activo ? 'opacity-50' : ''}>
                  <td>
                    <input className="input !py-1 text-sm" defaultValue={p.librador}
                      onBlur={(e) => { if (e.target.value && e.target.value !== p.librador) actualizar(p, { librador: e.target.value }); }} />
                  </td>
                  <td className="font-mono text-xs">{p.cuit}</td>
                  <td>
                    <input className="input !py-1 text-sm" defaultValue={p.motivo ?? ''}
                      onBlur={(e) => { if (e.target.value !== (p.motivo ?? '')) actualizar(p, { motivo: e.target.value || null }); }} />
                  </td>
                  <td>
                    <input type="checkbox" checked={p.activo} onChange={(e) => actualizar(p, { activo: e.target.checked })} />
                  </td>
                  <td><button className="text-danger text-xs" onClick={() => eliminar(p)}><Trash2 size={12} className="inline"/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-muted">
        Cuando un cheque tenga el CUIT de alguien de esta lista, en la solapa <b>Cheques</b> va a aparecer la observación <i>"Problemas para negociar"</i> y la fila se resalta.
      </div>
    </div>
  );
}

/* ============================================================
   TAB 4: LIBRADORES (base de quienes nos libran cheques)
   ============================================================ */
function LibradoresTab({ libradores, reload }: { libradores: Librador[]; reload: () => void }) {
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
    if (!editing.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
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
      alert(err.message ?? 'Error al guardar.');
    } finally { setBusy(false); }
  }

  async function eliminar(l: Librador) {
    if (!confirm(`¿Eliminar "${l.nombre}" de los libradores?`)) return;
    const { error } = await supabase.from('libradores').delete().eq('id', l.id);
    if (error) { alert(error.message); return; }
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
                    <td className="flex gap-3 text-xs whitespace-nowrap">
                      <button className="text-primary" onClick={() => setEditing(l)}>Editar</button>
                      <button className="text-danger" onClick={() => eliminar(l)}><Trash2 size={12} className="inline"/></button>
                    </td>
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

/* ============================================================
   MODALES
   ============================================================ */
function LimpiarCarteraModal({ cheques, propuestas, onClose, onDone }: {
  cheques: Cheque[];
  propuestas: Propuesta[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponibles = cheques.filter((c) => !c.propuesta_id);
  const asignados = cheques.filter((c) => c.propuesta_id);
  const propuestasAfectadas = new Set(asignados.map((c) => c.propuesta_id)).size;

  async function limpiar(modo: 'disponibles' | 'todos') {
    setBusy(true); setError(null);
    try {
      let query = supabase.from('cheques').delete();
      if (modo === 'disponibles') {
        query = query.is('propuesta_id', null);
      } else {
        query = query.gte('importe', -Infinity);  // matchea todos
      }
      const { error } = await query;
      if (error) throw error;
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Error al limpiar.');
      setBusy(false);
    }
  }

  async function confirmarTodos() {
    if (asignados.length === 0) {
      await limpiar('todos');
      return;
    }
    if (!confirm(`Vas a eliminar ${cheques.length} cheques en total, incluidos ${asignados.length} asignados a ${propuestasAfectadas} propuesta${propuestasAfectadas === 1 ? '' : 's'}.\n\nLas propuestas se mantienen pero quedan sin cheques.\n\n¿Confirmar?`)) return;
    await limpiar('todos');
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-danger">
          <AlertTriangle size={18}/> Limpiar cartera de cheques
        </h3>

        <p className="text-sm text-muted mb-4">
          Vaciar la cartera para arrancar de cero antes de importar una nueva. Esta acción no se puede deshacer.
        </p>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between p-2 bg-surface-2 rounded">
            <span>Cheques disponibles (sin asignar)</span>
            <span className="font-semibold">{disponibles.length}</span>
          </div>
          <div className="flex justify-between p-2 bg-surface-2 rounded">
            <span>Cheques asignados a propuestas</span>
            <span className="font-semibold">{asignados.length}</span>
          </div>
          <div className="flex justify-between p-2 bg-primary/5 rounded">
            <span className="font-medium">Total en la cartera</span>
            <span className="font-semibold">{cheques.length}</span>
          </div>
        </div>

        {error && <div className="text-sm text-danger mb-3">{error}</div>}

        {cheques.length === 0 ? (
          <div className="text-sm text-muted text-center py-4">La cartera ya está vacía.</div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => limpiar('disponibles')}
              disabled={busy || disponibles.length === 0}
              className="btn-secondary w-full justify-start"
            >
              {busy ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>}
              Limpiar sólo disponibles ({disponibles.length})
              <span className="text-xs text-muted ml-auto">Recomendado</span>
            </button>
            <button
              onClick={confirmarTodos}
              disabled={busy}
              className="btn-danger w-full justify-start"
            >
              {busy ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>}
              Limpiar TODA la cartera ({cheques.length})
            </button>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button className="btn-ghost text-sm" disabled={busy} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ libradores, onClose, onDone }: { libradores: Librador[]; onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [cuitsAutocompletados, setCuitsAutocompletados] = useState(0);

  // Mapa de librador -> cuit (por nombre normalizado)
  function buildLookup(): Map<string, string> {
    const map = new Map<string, string>();
    // primero recorrer todos y agrupar por nombre
    const grupos = new Map<string, Set<string>>();
    for (const l of libradores) {
      if (!l.cuit) continue;
      const k = l.nombre.trim().toUpperCase();
      const s = grupos.get(k) ?? new Set<string>();
      s.add(l.cuit);
      grupos.set(k, s);
    }
    // sólo mantener los nombres con UN cuit único
    for (const [k, s] of grupos.entries()) {
      if (s.size === 1) map.set(k, Array.from(s)[0]);
    }
    return map;
  }

  async function leer() {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const { rows, warnings } = await parseCheques(file);
      // autocompletar CUIT desde libradores cuando matchee el nombre exacto
      const lookup = buildLookup();
      let count = 0;
      for (const r of rows) {
        if (!r.cuit && r.librador) {
          const cuit = lookup.get(r.librador.trim().toUpperCase());
          if (cuit) { r.cuit = cuit; count++; }
        }
      }
      setCuitsAutocompletados(count);
      setPreview(rows);
      setWarnings(warnings);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function importar() {
    if (!preview?.length) return;
    setBusy(true); setError(null);
    try {
      if (reemplazar) {
        // borra sólo los cheques no asignados a propuesta
        await supabase.from('cheques').delete().is('propuesta_id', null);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const payload = preview.map((c) => ({
        vencimiento: c.vencimiento,
        asignacion: c.asignacion,
        importe: c.importe,
        librador: c.librador,
        banco: c.banco,
        cuit: c.cuit,
        tipo: c.tipo,
        status: c.status,
        created_by: user?.id,
      }));
      const batch = 500;
      for (let i = 0; i < payload.length; i += batch) {
        const slice = payload.slice(i, i + batch);
        const { error } = await supabase.from('cheques').insert(slice);
        if (error) throw error;
      }
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Importar cheques desde Excel</h3>
        <p className="text-xs text-muted mb-3">
          El archivo debe tener columnas: Vencimiento, Asignación, Importe, Librador, Banco, CUIT, Tipo, Status (1-8). La columna "Día" se calcula automáticamente con la fecha de venta.
        </p>

        <div className="bg-surface-2 rounded p-3 mb-4 flex items-start gap-3">
          <FileDown size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-medium">¿No tenés el modelo?</div>
            <div className="text-xs text-muted">Descargá la plantilla Excel con las columnas correctas y unas filas de ejemplo.</div>
          </div>
          <button onClick={descargarPlantillaCheques} className="btn-secondary text-xs whitespace-nowrap">
            <FileDown size={12}/> Plantilla
          </button>
        </div>

        <label className="border-2 border-dashed border-border rounded p-4 text-center cursor-pointer hover:border-primary block">
          {file ? (
            <>
              <FileCheck2 className="mx-auto text-success mb-1" size={28} />
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-muted">{(file.size/1024).toFixed(0)} KB</div>
            </>
          ) : (
            <>
              <Upload className="mx-auto text-muted mb-1" size={28} />
              <div className="text-sm font-medium">Seleccionar archivo Excel</div>
            </>
          )}
          <input type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setWarnings([]); }} />
        </label>

        {file && !preview && (
          <button className="btn-secondary w-full mt-3" disabled={busy} onClick={leer}>
            {busy ? 'Leyendo...' : 'Leer archivo'}
          </button>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 text-xs text-warning bg-warning/10 p-2 rounded max-h-32 overflow-y-auto">
            <div className="font-medium mb-1">{warnings.length} advertencia{warnings.length === 1 ? '' : 's'}:</div>
            {warnings.slice(0, 10).map((w, i) => <div key={i}>• {w}</div>)}
            {warnings.length > 10 && <div>... y {warnings.length - 10} más</div>}
          </div>
        )}

        {preview && (
          <>
            <div className="mt-3 text-sm">
              <div className="font-medium">Vista previa ({preview.length} cheques detectados)</div>
              <div className="text-xs text-muted">Total: {fmtMoney(preview.reduce((acc, c) => acc + c.importe, 0))}</div>
              {cuitsAutocompletados > 0 && (
                <div className="text-xs text-success mt-1">✓ CUIT autocompletado en {cuitsAutocompletados} cheque{cuitsAutocompletados === 1 ? '' : 's'} desde la base de Libradores.</div>
              )}
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded">
              <table className="tbl text-xs">
                <thead><tr><th>Vencimiento</th><th>Asig.</th><th className="text-right">Importe</th><th>Librador</th><th>Banco</th><th>CUIT</th></tr></thead>
                <tbody>
                  {preview.slice(0, 30).map((c, i) => (
                    <tr key={i}>
                      <td>{fmtFecha(c.vencimiento)}</td>
                      <td>{c.asignacion}</td>
                      <td className="text-right">{fmtMoney(c.importe)}</td>
                      <td className="truncate max-w-32">{c.librador}</td>
                      <td className="truncate max-w-32">{c.banco}</td>
                      <td>{c.cuit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 30 && <div className="p-2 text-xs text-muted text-center">... {preview.length - 30} más</div>}
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
              Reemplazar cheques actuales no asignados a propuestas (no afecta los ya asignados)
            </label>
          </>
        )}

        {error && <div className="text-sm text-danger mt-3">{error}</div>}

        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          {preview && (
            <button className="btn-primary" disabled={busy} onClick={importar}>
              {busy ? <><Loader2 className="animate-spin" size={14}/> Importando...</> : `Importar ${preview.length} cheques`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NuevoChequeModal({ libradores, onClose, onDone }: { libradores: Librador[]; onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vencimiento: '', asignacion: '', importe: '', librador: '', banco: '', cuit: '', tipo: '', status: '',
  });
  const [showSugg, setShowSugg] = useState(false);

  const sugerencias = useMemo(() => {
    const q = form.librador.trim().toUpperCase();
    if (q.length < 2) return [];
    return libradores.filter((l) => l.nombre.toUpperCase().includes(q)).slice(0, 8);
  }, [form.librador, libradores]);

  function pickLibrador(l: Librador) {
    setForm({ ...form, librador: l.nombre, cuit: l.cuit ?? form.cuit });
    setShowSugg(false);
  }

  async function guardar() {
    if (!form.vencimiento || !form.importe) { alert('Vencimiento e importe son obligatorios.'); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('cheques').insert({
        vencimiento: form.vencimiento,
        asignacion: form.asignacion || null,
        importe: parseFloat(form.importe.replace(',', '.')),
        librador: form.librador || null,
        banco: form.banco || null,
        cuit: form.cuit.replace(/[^0-9]/g, '') || null,
        tipo: form.tipo || null,
        status: form.status ? parseInt(form.status) : null,
        created_by: user?.id,
      });
      onDone(); onClose();
    } catch (e: any) {
      alert(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Nuevo cheque (carga manual)</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Vencimiento *</label>
              <input type="date" className="input" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Importe *</label>
              <input className="input" value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-muted">Asignación</label>
              <input className="input" value={form.asignacion} onChange={(e) => setForm({ ...form, asignacion: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Status (1-8)</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="">-</option>
                {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="relative">
            <label className="text-xs text-muted">Librador (autocompleta CUIT)</label>
            <input
              className="input"
              value={form.librador}
              onChange={(e) => { setForm({ ...form, librador: e.target.value }); setShowSugg(true); }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              placeholder="Empezá a escribir el nombre..."
            />
            {showSugg && sugerencias.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 card shadow-card z-10 max-h-64 overflow-y-auto">
                {sugerencias.map((l) => (
                  <button key={l.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickLibrador(l)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border last:border-b-0 text-sm">
                    <div className="font-medium">{l.nombre}</div>
                    <div className="text-xs text-muted">CUIT {l.cuit ?? '—'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted">Banco</label>
            <input className="input" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">CUIT</label>
              <input className="input" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Tipo</label>
              <input className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="7" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={busy} onClick={guardar}>
            {busy ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
