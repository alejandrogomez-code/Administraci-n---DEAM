'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileDown, Loader2, RefreshCcw, Lock, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, fmtMoney, fmtNum } from '@/lib/format';
import { aPercibirCheque, calcularResumen, diasEntre, descuentoFactor } from '@/lib/cheques/calculos';
import { generarSnapshot, type ChequeSnapshot } from '@/lib/cheques/snapshot';
import * as XLSX from 'xlsx';

type Propuesta = {
  id: string;
  nombre: string;
  fecha_venta: string | null;
  tasa: number | null;
  banco_operacion: string | null;
  notas: string | null;
  estado: 'borrador' | 'propuesta' | 'finalizada' | 'cancelada';
  // Snapshot (se completan al finalizar la propuesta)
  snap_cantidad: number | null;
  snap_total_a_vender: number | null;
  snap_aproximado_a_percibir: number | null;
  snap_costo_aproximado: number | null;
  snap_cft_pct: number | null;
  snap_plazo_promedio: number | null;
  snap_finalizada_en: string | null;
};

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

export default function PropuestaDetallePage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [prop, setProp] = useState<Propuesta | null>(null);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [detalleSnap, setDetalleSnap] = useState<ChequeSnapshot[]>([]);
  const [cuitsProblema, setCuitsProblema] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: ch }, { data: ds }, { data: pb }] = await Promise.all([
      supabase.from('propuestas_cheques').select('*').eq('id', id).single(),
      supabase.from('cheques').select('*').eq('propuesta_id', id).order('vencimiento'),
      supabase.from('propuestas_cheques_detalle').select('*').eq('propuesta_id', id).order('vencimiento'),
      supabase.from('clientes_problemas').select('cuit').eq('activo', true),
    ]);
    setProp(p as any);
    setCheques((ch as any) ?? []);
    setDetalleSnap((ds as any) ?? []);
    setCuitsProblema(new Set(((pb as any) ?? []).map((x: any) => x.cuit)));
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  // ¿La propuesta está finalizada y tiene snapshot?
  const usaSnapshot = !!(prop?.snap_finalizada_en);

  // Resumen "en vivo" desde los cheques vinculados (para estados no finalizados)
  const resumenLive = useMemo(() =>
    prop ? calcularResumen(cheques, prop.fecha_venta, prop.tasa) : null,
    [cheques, prop?.fecha_venta, prop?.tasa]
  );

  // Resumen efectivo: snapshot si está finalizada, en vivo si no
  const resumen = useMemo(() => {
    if (!prop) return null;
    if (usaSnapshot) {
      return {
        cantidad: prop.snap_cantidad ?? 0,
        total_a_vender: Number(prop.snap_total_a_vender ?? 0),
        aproximado_a_percibir: Number(prop.snap_aproximado_a_percibir ?? 0),
        costo_aproximado: Number(prop.snap_costo_aproximado ?? 0),
        plazo_promedio: prop.snap_plazo_promedio,
        cft_aproximado_pct: prop.snap_cft_pct != null ? Number(prop.snap_cft_pct) : null,
      };
    }
    return resumenLive;
  }, [prop, usaSnapshot, resumenLive]);

  async function actualizar(cambios: Partial<Propuesta>) {
    if (!prop) return;
    setSaving(true);
    await supabase.from('propuestas_cheques').update(cambios).eq('id', prop.id);
    const nuevo = { ...prop, ...cambios } as Propuesta;
    setProp(nuevo);
    setSaving(false);

    // Auto-snapshot: si la propuesta pasa a "finalizada" y todavía no tiene snapshot,
    // congelamos los datos automáticamente.
    if (cambios.estado === 'finalizada' && !nuevo.snap_finalizada_en) {
      await ejecutarSnapshot(true);
    }
  }

  async function ejecutarSnapshot(silencioso: boolean) {
    if (!prop) return;
    setSnapshotting(true);
    try {
      await generarSnapshot(supabase, prop.id);
      await load();
      if (!silencioso) alert('Snapshot regenerado correctamente.');
    } catch (e: any) {
      alert('Error generando snapshot: ' + (e?.message || e));
    } finally {
      setSnapshotting(false);
    }
  }

  async function regenerarSnapshotConfirm() {
    if (!confirm(
      'Regenerar el snapshot toma los cheques actualmente vinculados a esta propuesta ' +
      'y reemplaza los datos congelados.\n\n¿Continuar?'
    )) return;
    await ejecutarSnapshot(false);
  }

  async function quitarCheque(c: Cheque) {
    if (!confirm('Quitar este cheque de la propuesta? Vuelve al universo de cheques disponibles.')) return;
    await supabase.from('cheques').update({ propuesta_id: null }).eq('id', c.id);
    load();
  }

  async function eliminarPropuesta() {
    if (!confirm('¿Eliminar esta propuesta? Los cheques vuelven a estar disponibles.')) return;
    await supabase.from('cheques').update({ propuesta_id: null }).eq('propuesta_id', id);
    await supabase.from('propuestas_cheques').delete().eq('id', id);
    router.push('/tesoreria/venta-cheques');
  }

  function descargarExcel() {
    if (!prop || !resumen) return;
    const fv = prop.fecha_venta;
    const tasa = prop.tasa;

    // Helper: convertir ISO yyyy-mm-dd a Date local (sin desplazamiento de zona horaria)
    const toDate = (iso: string | null) => iso ? new Date(iso + 'T00:00:00') : null;

    // Fuente del detalle: snapshot si está finalizada, cheques en vivo en caso contrario
    const detalleRows = usaSnapshot
      ? detalleSnap.map((c) => ({
          'Vencimiento':   toDate(c.vencimiento),
          'Asignación':    c.asignacion ?? '',
          'Importe Total': Number(c.importe ?? 0),
          'Librador':      c.librador ?? '',
          'CUIT':          c.cuit ?? '',
          'Status':        c.status ?? '',
        }))
      : cheques.map((c) => ({
          'Vencimiento':   toDate(c.vencimiento),
          'Asignación':    c.asignacion ?? '',
          'Importe Total': c.importe,
          'Librador':      c.librador ?? '',
          'CUIT':          c.cuit ?? '',
          'Status':        c.status ?? '',
        }));

    // Hoja 2: resumen
    const resumenRows = [
      { Campo: 'Nombre',                  Valor: prop.nombre },
      { Campo: 'Fecha de venta',          Valor: toDate(fv) ?? '' },
      { Campo: 'Tasa (%)',                Valor: tasa ?? '' },
      { Campo: 'Banco de operación',      Valor: prop.banco_operacion ?? '' },
      { Campo: 'Plazo Promedio (días)',   Valor: resumen.plazo_promedio ?? '' },
      { Campo: 'Total a vender',          Valor: resumen.total_a_vender },
      { Campo: 'Aproximado a percibir',   Valor: resumen.aproximado_a_percibir },
      { Campo: 'Costo aproximado',        Valor: resumen.costo_aproximado },
      { Campo: 'CFT Aproximado (%)',      Valor: resumen.cft_aproximado_pct ?? '' },
      { Campo: 'Cantidad de Valores',     Valor: resumen.cantidad },
      { Campo: 'Notas',                   Valor: prop.notas ?? '' },
    ];

    const wsDet = XLSX.utils.json_to_sheet(detalleRows);
    // Aplicar formato dd/mm/yyyy a toda la columna Vencimiento (col 0).
    // (json_to_sheet convierte los Date a número serial, así que aplicamos formato directamente.)
    const refDet = wsDet['!ref'];
    if (refDet) {
      const range = XLSX.utils.decode_range(refDet);
      for (let r = 1; r <= range.e.r; r++) {
        const cell = wsDet[XLSX.utils.encode_cell({ r, c: 0 })];
        if (cell) cell.z = 'dd/mm/yyyy';
      }
    }
    // anchos de columna
    wsDet['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 36 }, { wch: 14 }, { wch: 8 },
    ];

    const wsRes = XLSX.utils.json_to_sheet(resumenRows);
    // Aplicar formato dd/mm/yyyy a la celda de "Fecha de venta" (columna Valor)
    const idxFecha = resumenRows.findIndex((row) => row.Campo === 'Fecha de venta');
    if (idxFecha !== -1) {
      const cellFecha = wsRes[XLSX.utils.encode_cell({ r: idxFecha + 1, c: 1 })];  // +1 por la fila de header
      if (cellFecha) cellFecha.z = 'dd/mm/yyyy';
    }
    wsRes['!cols'] = [{ wch: 24 }, { wch: 28 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsDet, 'Cheques');
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');
    XLSX.writeFile(wb, `Propuesta_${prop.nombre.replace(/[^\w-]+/g, '_')}.xlsx`);
  }

  if (loading) return <AppShell><TopBar titulo="Cargando..." /></AppShell>;
  if (!prop) return <AppShell><TopBar titulo="No encontrado" /></AppShell>;

  return (
    <AppShell>
      <TopBar
        titulo={prop.nombre}
        subtitulo={`Propuesta de venta de cheques · ${prop.estado}${usaSnapshot ? ' · congelada' : ''}${saving ? ' · guardando...' : ''}${snapshotting ? ' · generando snapshot...' : ''}`}
        actions={<>
          <Link href="/tesoreria/venta-cheques" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>
          {usaSnapshot && (
            <button
              onClick={regenerarSnapshotConfirm}
              className="btn-ghost"
              disabled={snapshotting}
              title="Vuelve a tomar los cheques actualmente vinculados y reemplaza el snapshot"
            >
              {snapshotting ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
              Regenerar snapshot
            </button>
          )}
          <button onClick={descargarExcel} className="btn-primary"><FileDown size={14}/> Descargar Excel</button>
        </>}
      />
      <div className="p-6 space-y-6">

        {/* PARÁMETROS DEL SIMULADOR */}
        <div className="card p-5">
          <h3 className="font-medium mb-3 text-sm">Parámetros de la operación</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted">Nombre</label>
              <input className="input" defaultValue={prop.nombre} onBlur={(e) => e.target.value !== prop.nombre && actualizar({ nombre: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Fecha de venta</label>
              <input type="date" className="input" defaultValue={prop.fecha_venta ?? ''} onBlur={(e) => actualizar({ fecha_venta: e.target.value || null })} />
            </div>
            <div>
              <label className="text-xs text-muted">Tasa (%)</label>
              <input type="number" step="0.01" className="input" defaultValue={prop.tasa ?? ''} onBlur={(e) => actualizar({ tasa: e.target.value ? parseFloat(e.target.value) : null })} />
            </div>
            <div>
              <label className="text-xs text-muted">Banco de operación</label>
              <input className="input" defaultValue={prop.banco_operacion ?? ''} onBlur={(e) => actualizar({ banco_operacion: e.target.value || null })} />
            </div>
            <div>
              <label className="text-xs text-muted">Estado</label>
              <select className="input" value={prop.estado} onChange={(e) => actualizar({ estado: e.target.value as any })}>
                <option value="borrador">Borrador</option>
                <option value="propuesta">Propuesta</option>
                <option value="finalizada">Finalizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <label className="text-xs text-muted">Notas</label>
              <textarea className="input min-h-16" defaultValue={prop.notas ?? ''} onBlur={(e) => actualizar({ notas: e.target.value || null })} />
            </div>
          </div>
        </div>

        {/* RESUMEN */}
        {resumen && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">
                Resumen de la operación
                {usaSnapshot && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted">
                    <Lock size={12}/> congelado el {fmtFecha(prop.snap_finalizada_en?.slice(0, 10) ?? null)}
                  </span>
                )}
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Cantidad de valores" value={fmtNum(resumen.cantidad)} />
              <Kpi label="Plazo promedio" value={resumen.plazo_promedio != null ? `${resumen.plazo_promedio} días` : '-'} />
              <Kpi label="Total a vender" value={fmtMoney(resumen.total_a_vender)} tone="primary" />
              <Kpi label="Aproximado a percibir" value={fmtMoney(resumen.aproximado_a_percibir)} tone="success" />
              <Kpi label="Costo aproximado" value={fmtMoney(resumen.costo_aproximado)} tone="warning" />
              <Kpi label="CFT aproximado" value={resumen.cft_aproximado_pct != null ? `${resumen.cft_aproximado_pct}%` : '-'} tone="accent" />
              <Kpi label="Tasa" value={prop.tasa != null ? `${prop.tasa}%` : '-'} />
              <Kpi label="Fecha de venta" value={fmtFecha(prop.fecha_venta)} />
            </div>
            {!usaSnapshot && (prop.fecha_venta == null || prop.tasa == null) && (
              <div className="mt-3 text-xs text-warning bg-warning/10 p-2 rounded">
                Cargá fecha de venta y tasa para calcular descuentos, costo aproximado y CFT.
              </div>
            )}
            {usaSnapshot && cheques.length !== (prop.snap_cantidad ?? 0) && (
              <div className="mt-3 text-xs text-muted bg-surface-2 p-2 rounded">
                Esta propuesta está congelada con {prop.snap_cantidad} cheque{prop.snap_cantidad === 1 ? '' : 's'} ({fmtMoney(Number(prop.snap_total_a_vender ?? 0))}).
                Actualmente hay {cheques.length} cheque{cheques.length === 1 ? '' : 's'} vinculado{cheques.length === 1 ? '' : 's'} en la cartera.
                Si querés actualizar el snapshot con los cheques actuales, usá <strong>Regenerar snapshot</strong>.
              </div>
            )}
          </div>
        )}

        {/* DETALLE DE CHEQUES */}
        {usaSnapshot ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2">
                <Lock size={14}/> Cheques de la propuesta ({detalleSnap.length}) · congelados
              </div>
            </div>
            {detalleSnap.length === 0 ? (
              <div className="p-10 text-center text-muted text-sm">
                El snapshot no tiene cheques registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl min-w-[1100px]">
                  <thead>
                    <tr>
                      <th>Vencimiento</th>
                      <th>Asignación</th>
                      <th className="text-right">Importe</th>
                      <th>Días</th>
                      <th>Descuento</th>
                      <th className="text-right">A percibir</th>
                      <th>Librador</th>
                      <th>Banco</th>
                      <th>CUIT</th>
                      <th>Status</th>
                      <th>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleSnap.map((c) => {
                      const enProblema = c.cuit && cuitsProblema.has(c.cuit);
                      const desc = c.descuento_factor;
                      return (
                        <tr key={c.id} className={enProblema ? 'bg-warning/5' : ''}>
                          <td className="whitespace-nowrap text-sm">{fmtFecha(c.vencimiento)}</td>
                          <td className="text-xs">{c.asignacion ?? '-'}</td>
                          <td className="text-right text-sm">{fmtMoney(Number(c.importe ?? 0))}</td>
                          <td className="text-xs text-muted">{c.dias ?? '-'}</td>
                          <td className="text-xs">{desc != null ? `${(Number(desc) * 100).toFixed(2)}%` : '-'}</td>
                          <td className="text-right text-sm">{c.a_percibir != null ? fmtMoney(Number(c.a_percibir)) : '-'}</td>
                          <td className="text-xs max-w-48 truncate">{c.librador ?? '-'}</td>
                          <td className="text-xs max-w-40 truncate">{c.banco ?? '-'}</td>
                          <td className="text-xs">{c.cuit ?? '-'}</td>
                          <td><span className="chip bg-surface-2 text-text">{c.status ?? '-'}</span></td>
                          <td className="text-xs">{enProblema ? <span className="text-warning">Problemas para negociar</span> : (c.observaciones ?? '-')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Cheques de la propuesta ({cheques.length})</div>
            <Link href="/tesoreria/venta-cheques" className="text-xs text-primary">+ Agregar desde la solapa Cheques</Link>
          </div>
          {cheques.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">
              Esta propuesta todavía no tiene cheques. Andá a <Link className="text-primary" href="/tesoreria/venta-cheques">Venta de cheques</Link>, filtrá y asignalos a esta propuesta.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[1100px]">
                <thead>
                  <tr>
                    <th>Vencimiento</th>
                    <th>Asignación</th>
                    <th className="text-right">Importe</th>
                    <th>Días</th>
                    <th>Descuento</th>
                    <th className="text-right">A percibir</th>
                    <th>Librador</th>
                    <th>Banco</th>
                    <th>CUIT</th>
                    <th>Status</th>
                    <th>Observación</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cheques.map((c) => {
                    const dias = diasEntre(prop.fecha_venta, c.vencimiento);
                    const desc = descuentoFactor(dias, prop.tasa);
                    const aPer = aPercibirCheque(c.importe, dias, prop.tasa);
                    const enProblema = c.cuit && cuitsProblema.has(c.cuit);
                    return (
                      <tr key={c.id} className={enProblema ? 'bg-warning/5' : ''}>
                        <td className="whitespace-nowrap text-sm">{fmtFecha(c.vencimiento)}</td>
                        <td className="text-xs">{c.asignacion ?? '-'}</td>
                        <td className="text-right text-sm">{fmtMoney(c.importe)}</td>
                        <td className="text-xs text-muted">{dias ?? '-'}</td>
                        <td className="text-xs">{desc != null ? `${(desc * 100).toFixed(2)}%` : '-'}</td>
                        <td className="text-right text-sm">{aPer != null ? fmtMoney(aPer) : '-'}</td>
                        <td className="text-xs max-w-48 truncate">{c.librador ?? '-'}</td>
                        <td className="text-xs max-w-40 truncate">{c.banco ?? '-'}</td>
                        <td className="text-xs">{c.cuit ?? '-'}</td>
                        <td><span className="chip bg-surface-2 text-text">{c.status ?? '-'}</span></td>
                        <td className="text-xs">{enProblema ? <span className="text-warning">Problemas para negociar</span> : (c.observaciones ?? '-')}</td>
                        <td><button onClick={() => quitarCheque(c)} className="text-danger text-xs hover:underline">Quitar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        <div className="flex justify-end">
          <button onClick={eliminarPropuesta} className="btn-ghost text-danger text-sm"><Trash2 size={14}/> Eliminar propuesta</button>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'primary'|'success'|'warning'|'accent' }) {
  const cls = tone === 'primary' ? 'text-primary' : tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'accent' ? 'text-accent' : '';
  return (
    <div className="border border-border rounded p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
