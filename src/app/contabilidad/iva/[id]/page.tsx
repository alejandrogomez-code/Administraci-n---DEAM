'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, FileDown, RefreshCcw, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, fmtMoney } from '@/lib/format';
import * as XLSX from 'xlsx';

type Control = {
  id: string;
  periodo: string;
  total_afip: number;
  total_sap: number;
  total_coincidencias: number;
  total_diferencias_importe: number;
  total_faltantes_sap: number;
  total_faltantes_afip: number;
  importe_total_afip: number;
  importe_total_sap: number;
  archivo_afip_nombre: string | null;
  archivo_afip_url: string | null;
  archivo_sap_nombre: string | null;
  archivo_sap_url: string | null;
  observaciones: string | null;
};

type Result = {
  id: string;
  tipo: 'ok' | 'diferencia_importe' | 'falta_en_sap' | 'falta_en_afip';
  resuelto: boolean;
  observacion: string | null;
  cuit: string | null;
  punto_venta: string | null;
  numero: string | null;
  letra: string | null;
  fecha_afip: string | null;
  tipo_afip: string | null;
  razon_social_afip: string | null;
  importe_afip: number | null;
  fecha_sap: string | null;
  tipo_sap: string | null;
  razon_social_sap: string | null;
  importe_sap: number | null;
  diferencia: number | null;
};

export default function IvaDetallePage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [control, setControl] = useState<Control | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todos' | 'diferencia_importe' | 'falta_en_sap' | 'falta_en_afip' | 'ok' | 'pendientes'>('pendientes');
  const [buscar, setBuscar] = useState('');

  async function load() {
    setLoading(true);
    const { data: c } = await supabase.from('iva_controls').select('*').eq('id', id).single();
    setControl(c as any);
    const { data: r } = await supabase.from('iva_control_results').select('*').eq('iva_control_id', id).order('tipo').order('razon_social_afip');
    setResults((r as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  const filtrados = useMemo(() => {
    let arr = results;
    if (tab === 'pendientes') arr = arr.filter((r) => r.tipo !== 'ok' && !r.resuelto);
    else if (tab !== 'todos') arr = arr.filter((r) => r.tipo === tab);
    if (buscar.trim()) {
      const q = buscar.trim().toLowerCase();
      arr = arr.filter((r) =>
        (r.razon_social_afip ?? r.razon_social_sap ?? '').toLowerCase().includes(q) ||
        (r.cuit ?? '').includes(q) ||
        (r.numero ?? '').includes(q)
      );
    }
    return arr;
  }, [results, tab, buscar]);

  async function toggleResuelto(r: Result) {
    const { data: { user } } = await supabase.auth.getUser();
    const next = !r.resuelto;
    await supabase.from('iva_control_results').update({
      resuelto: next,
      resuelto_at: next ? new Date().toISOString() : null,
      resuelto_by: next ? user?.id : null,
    }).eq('id', r.id);
    setResults((arr) => arr.map((x) => x.id === r.id ? { ...x, resuelto: next } : x));
  }

  async function actualizarObservacion(r: Result, obs: string) {
    await supabase.from('iva_control_results').update({ observacion: obs }).eq('id', r.id);
    setResults((arr) => arr.map((x) => x.id === r.id ? { ...x, observacion: obs } : x));
  }

  async function eliminarControl() {
    if (!control) return;
    if (!confirm(`¿Eliminar el control de IVA del período ${control.periodo}?\n\nSe eliminarán también todos los resultados del cruce y los archivos originales adjuntos. No se puede deshacer.`)) return;
    try {
      const paths = [control.archivo_afip_url, control.archivo_sap_url].filter((p): p is string => !!p);
      if (paths.length) {
        const { error: errSt } = await supabase.storage.from('iva-files').remove(paths);
        if (errSt) console.warn('No se pudieron eliminar los archivos:', errSt.message);
      }
      const { error } = await supabase.from('iva_controls').delete().eq('id', id);
      if (error) throw error;
      router.push('/contabilidad/iva');
    } catch (err: any) {
      alert(err.message ?? 'Error al eliminar.');
    }
  }

  async function descargarArchivo(url: string | null, nombre: string | null) {
    if (!url) return;
    const { data, error } = await supabase.storage.from('iva-files').createSignedUrl(url, 60);
    if (error || !data?.signedUrl) { alert('No se pudo generar el enlace de descarga.'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = nombre ?? 'archivo.xlsx';
    a.click();
  }

  function exportarExcel() {
    const rows = filtrados.map((r) => ({
      Tipo: tipoLabel(r.tipo),
      Resuelto: r.resuelto ? 'Sí' : 'No',
      CUIT: r.cuit ?? '',
      'Razón Social': r.razon_social_afip ?? r.razon_social_sap ?? '',
      'PV': r.punto_venta ?? '',
      'Número': r.numero ?? '',
      'Letra': r.letra ?? '',
      'Fecha ARCA': fmtFecha(r.fecha_afip),
      'Tipo ARCA': r.tipo_afip ?? '',
      'Importe ARCA': r.importe_afip ?? '',
      'Fecha SAP': fmtFecha(r.fecha_sap),
      'Tipo SAP': r.tipo_sap ?? '',
      'Importe SAP': r.importe_sap ?? '',
      'Diferencia': r.diferencia ?? '',
      'Observación': r.observacion ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cruce IVA');
    XLSX.writeFile(wb, `Cruce_IVA_${control?.periodo ?? id}.xlsx`);
  }

  if (loading) return <AppShell><TopBar titulo="Cargando..." /></AppShell>;
  if (!control) return <AppShell><TopBar titulo="No encontrado" /></AppShell>;

  return (
    <AppShell>
      <TopBar
        titulo={`Control IVA ${control.periodo}`}
        subtitulo={`${results.length} resultados`}
        actions={<>
          <Link href="/contabilidad/iva" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>
          <button onClick={exportarExcel} className="btn-primary"><FileDown size={14}/> Exportar Excel</button>
          <button onClick={eliminarControl} className="btn-ghost text-danger text-sm"><Trash2 size={14}/> Eliminar</button>
        </>}
      />
      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="OK exactos" value={control.total_coincidencias} tone="success" />
          <Kpi label="Diferencias de importe" value={control.total_diferencias_importe} tone="warning" />
          <Kpi label="Faltantes en SAP" value={control.total_faltantes_sap} tone="danger" />
          <Kpi label="Faltantes en ARCA" value={control.total_faltantes_afip} tone="accent" />
        </div>

        {/* totales */}
        <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-xs text-muted">Comprobantes ARCA</div><div className="font-medium">{control.total_afip}</div></div>
          <div><div className="text-xs text-muted">Comprobantes SAP</div><div className="font-medium">{control.total_sap}</div></div>
          <div><div className="text-xs text-muted">Importe total ARCA</div><div className="font-medium">{fmtMoney(control.importe_total_afip)}</div></div>
          <div><div className="text-xs text-muted">Importe total SAP</div><div className="font-medium">{fmtMoney(control.importe_total_sap)}</div></div>
        </div>

        {/* archivos originales */}
        <div className="card p-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-muted uppercase tracking-wide">Archivos originales:</span>
          {control.archivo_afip_url && (
            <button onClick={() => descargarArchivo(control.archivo_afip_url, control.archivo_afip_nombre)} className="btn-ghost text-sm">
              <Download size={14}/> {control.archivo_afip_nombre ?? 'ARCA'}
            </button>
          )}
          {control.archivo_sap_url && (
            <button onClick={() => descargarArchivo(control.archivo_sap_url, control.archivo_sap_nombre)} className="btn-ghost text-sm">
              <Download size={14}/> {control.archivo_sap_nombre ?? 'SAP'}
            </button>
          )}
        </div>

        {/* tabs */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap justify-between">
            <div className="flex gap-1 flex-wrap">
              <TabBtn active={tab==='pendientes'} onClick={() => setTab('pendientes')}>Pendientes ({results.filter((r) => r.tipo !== 'ok' && !r.resuelto).length})</TabBtn>
              <TabBtn active={tab==='todos'} onClick={() => setTab('todos')}>Todos ({results.length})</TabBtn>
              <TabBtn active={tab==='diferencia_importe'} onClick={() => setTab('diferencia_importe')}>Dif. importe ({control.total_diferencias_importe})</TabBtn>
              <TabBtn active={tab==='falta_en_sap'} onClick={() => setTab('falta_en_sap')}>Falta SAP ({control.total_faltantes_sap})</TabBtn>
              <TabBtn active={tab==='falta_en_afip'} onClick={() => setTab('falta_en_afip')}>Falta ARCA ({control.total_faltantes_afip})</TabBtn>
              <TabBtn active={tab==='ok'} onClick={() => setTab('ok')}>OK ({control.total_coincidencias})</TabBtn>
            </div>
            <div className="flex items-center gap-2">
              <input className="input !w-auto !py-1.5 text-sm" placeholder="Buscar (CUIT, razón social, número)" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <button onClick={load} className="btn-ghost"><RefreshCcw size={14}/></button>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">Sin resultados con ese filtro.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[1100px]">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th>Tipo</th>
                    <th>Razón Social</th>
                    <th>Comprobante</th>
                    <th className="text-right">Imp. ARCA</th>
                    <th className="text-right">Imp. SAP</th>
                    <th className="text-right">Diferencia</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => (
                    <tr key={r.id} className={r.resuelto ? 'opacity-50' : ''}>
                      <td>
                        {r.tipo !== 'ok' && (
                          <input
                            type="checkbox"
                            checked={r.resuelto}
                            onChange={() => toggleResuelto(r)}
                            className="cursor-pointer"
                            title="Marcar como resuelto / OK"
                          />
                        )}
                      </td>
                      <td><TipoChip tipo={r.tipo} /></td>
                      <td>
                        <div className="font-medium text-sm">{r.razon_social_afip ?? r.razon_social_sap ?? '-'}</div>
                        <div className="text-xs text-muted">CUIT {r.cuit ?? '-'}</div>
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        <div>{r.letra ?? '-'} {r.punto_venta ?? '-'}-{r.numero ?? '-'}</div>
                        <div className="text-muted">{fmtFecha(r.fecha_afip ?? r.fecha_sap)}</div>
                      </td>
                      <td className="text-right text-sm">{r.importe_afip != null ? fmtMoney(r.importe_afip) : '-'}</td>
                      <td className="text-right text-sm">{r.importe_sap != null ? fmtMoney(r.importe_sap) : '-'}</td>
                      <td className={`text-right text-sm ${r.diferencia ? 'text-warning font-medium' : ''}`}>
                        {r.diferencia != null ? fmtMoney(r.diferencia) : '-'}
                      </td>
                      <td>
                        <input
                          defaultValue={r.observacion ?? ''}
                          onBlur={(e) => { if ((e.target.value ?? '') !== (r.observacion ?? '')) actualizarObservacion(r, e.target.value); }}
                          className="input !py-1 text-xs min-w-32"
                          placeholder="Observación..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'success'|'warning'|'danger'|'accent' }) {
  const cls = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : tone === 'accent' ? 'text-accent' : '';
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${active ? 'bg-primary text-primary-fg' : 'text-text hover:bg-surface-2'}`}>
      {children}
    </button>
  );
}

function tipoLabel(t: string) {
  switch (t) {
    case 'ok': return 'OK';
    case 'diferencia_importe': return 'Dif. importe';
    case 'falta_en_sap': return 'Falta en SAP';
    case 'falta_en_afip': return 'Falta en ARCA';
    default: return t;
  }
}

function TipoChip({ tipo }: { tipo: string }) {
  const map: Record<string, string> = {
    'ok': 'chip-ok',
    'diferencia_importe': 'chip-diferencia',
    'falta_en_sap': 'chip-falta-sap',
    'falta_en_afip': 'chip-falta-afip',
  };
  return <span className={map[tipo] ?? 'chip'}>{tipoLabel(tipo)}</span>;
}
