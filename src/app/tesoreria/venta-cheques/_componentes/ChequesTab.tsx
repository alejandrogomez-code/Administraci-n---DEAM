'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, RefreshCcw, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, fmtMoney } from '@/lib/format';
import { diasEntre } from '@/lib/cheques/calculos';
import { avisar, confirmar, pedirTexto } from '@/components/feedback';
import { ImportModal } from './ImportModal';
import { LimpiarCarteraModal } from './LimpiarCarteraModal';
import { NuevoChequeModal } from './NuevoChequeModal';
import { Cheque, ClienteProblema, Librador, Propuesta } from './tipos';

/* ============================================================
   TAB 1: CHEQUES (lista, filtros, importar Excel, asignar a propuesta)
   ============================================================ */
export function ChequesTab({ cheques, propuestas, cuitsProblema, problemas, libradores, reload }: {
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
    if (!(await confirmar(`Asignar ${seleccion.size} cheque${seleccion.size === 1 ? '' : 's'} a la propuesta seleccionada?`))) return;
    const { error } = await supabase.from('cheques').update({ propuesta_id: propuestaId }).in('id', Array.from(seleccion));
    if (error) { avisar(error.message); return; }
    setSeleccion(new Set());
    reload();
  }

  async function nuevaPropuestaConSeleccion() {
    if (seleccion.size === 0) return;
    const nombre = (await pedirTexto('Nombre de la nueva propuesta:', `Propuesta ${new Date().toLocaleDateString('es-AR')}`));
    if (!nombre) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prop, error } = await supabase.from('propuestas_cheques').insert({
      nombre, fecha_venta: fechaVenta || null, estado: 'borrador', created_by: user?.id,
    }).select('id').single();
    if (error) { avisar(error.message); return; }
    await supabase.from('cheques').update({ propuesta_id: prop.id }).in('id', Array.from(seleccion));
    setSeleccion(new Set());
    reload();
    avisar(`Propuesta creada con ${seleccion.size} cheque${seleccion.size === 1 ? '' : 's'}.`);
  }

  async function eliminarSeleccionados() {
    if (seleccion.size === 0) return;
    if (!(await confirmar(`¿Eliminar ${seleccion.size} cheque(s)?`))) return;
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
