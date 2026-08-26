'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive, ExternalLink, FileText, Loader2, Plus, RefreshCcw, RotateCcw,
  Search, Trash2, Upload, X,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, fmtMoney } from '@/lib/format';

const BUCKET = 'repo-files';
const DIAS_AVISO = 30; // ventana de "próximo a vencer" / "próximo aviso de baja"

type Jurisdiccion = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
};

type Poliza = {
  id: string;
  jurisdiccion_id: string;
  fecha_alta: string | null;      // YYYY-MM-DD
  empresa: string;
  monto_asegurado: number | null;
  vencimiento: string | null;     // YYYY-MM-DD
  fecha_revision: string | null;  // YYYY-MM-DD (revisión de vencimiento)
  aviso_baja: string | null;      // YYYY-MM-DD
  baja_link: string | null;       // link al mail de baja enviado
  poliza_url: string | null;
  poliza_nombre: string | null;
  cert_url: string | null;
  cert_nombre: string | null;
  factura_url: string | null;
  factura_nombre: string | null;
  detalle: string | null;
  finalizada: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
};

type Estado = 'vigente' | 'vencido' | 'sin_vencimiento';

// ---------- helpers de fecha / estado ----------
function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function hoy0(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function estadoDe(p: Poliza): Estado {
  if (!p.vencimiento) return 'sin_vencimiento';
  if (parseISODate(p.vencimiento) < hoy0()) return 'vencido';
  return 'vigente';
}

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Limpia el nombre para usarlo como clave en Supabase Storage
function sanitizeKey(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : '';
  const base = dot > 0 ? name.slice(0, dot) : name;
  const clean = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const cleanExt = ext
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.]+/g, '');
  return (clean || 'archivo') + cleanExt;
}

function EstadoChip({ estado }: { estado: Estado }) {
  if (estado === 'vigente')
    return <span className="chip bg-success/15 text-success">Vigente</span>;
  if (estado === 'vencido')
    return <span className="chip bg-danger/15 text-danger">Vencida</span>;
  return <span className="chip bg-surface-2 text-muted">Sin vencimiento</span>;
}

// Definición de los tres adjuntos de una póliza (para reutilizar en modal/tabla)
const ADJUNTOS = [
  { key: 'poliza', urlKey: 'poliza_url', nomKey: 'poliza_nombre', label: 'Póliza' },
  { key: 'cert', urlKey: 'cert_url', nomKey: 'cert_nombre', label: 'Certificación' },
  { key: 'factura', urlKey: 'factura_url', nomKey: 'factura_nombre', label: 'Factura' },
] as const;
type AdjuntoKey = (typeof ADJUNTOS)[number]['key'];

export default function PolizasPage() {
  const supabase = createClient();
  const [jurs, setJurs] = useState<Jurisdiccion[]>([]);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Poliza | null>(null);
  const [busy, setBusy] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtroJur, setFiltroJur] = useState<string>('todas');

  async function load() {
    setLoading(true);
    const [{ data: j }, { data: p }] = await Promise.all([
      supabase.from('repo_jurisdicciones').select('*').order('orden').order('nombre'),
      supabase.from('repo_polizas').select('*').order('vencimiento', { ascending: true }),
    ]);
    setJurs((j as any) ?? []);
    setPolizas((p as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const jurById = useMemo(() => {
    const m: Record<string, Jurisdiccion> = {};
    jurs.forEach((j) => { m[j.id] = j; });
    return m;
  }, [jurs]);

  // Vigentes = no finalizadas ; Finalizadas = cerradas / dadas de baja
  const vigentes = useMemo(() => polizas.filter((p) => !p.finalizada), [polizas]);
  const finalizadas = useMemo(() => polizas.filter((p) => p.finalizada), [polizas]);

  // ---------- alertas (solo sobre pólizas vigentes) ----------
  const { vencidas, proximas, avisosBaja } = useMemo(() => {
    const hoy = hoy0();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + DIAS_AVISO);

    const conVenc = vigentes.filter((p) => p.vencimiento);
    const vencidas = conVenc
      .filter((p) => parseISODate(p.vencimiento!) < hoy)
      .sort((a, b) => parseISODate(a.vencimiento!).getTime() - parseISODate(b.vencimiento!).getTime());
    const proximas = conVenc
      .filter((p) => {
        const f = parseISODate(p.vencimiento!);
        return f >= hoy && f <= limite;
      })
      .sort((a, b) => parseISODate(a.vencimiento!).getTime() - parseISODate(b.vencimiento!).getTime());

    const avisosBaja = vigentes
      .filter((p) => p.aviso_baja && parseISODate(p.aviso_baja) <= limite)
      .sort((a, b) => parseISODate(a.aviso_baja!).getTime() - parseISODate(b.aviso_baja!).getTime());

    return { vencidas, proximas, avisosBaja };
  }, [vigentes]);

  // ---------- acciones ----------
  function nuevaPoliza() {
    setEditing({
      id: '', jurisdiccion_id: jurs[0]?.id ?? '', fecha_alta: new Date().toISOString().slice(0, 10),
      empresa: '', monto_asegurado: null, vencimiento: null, fecha_revision: null,
      aviso_baja: null, baja_link: '', poliza_url: null, poliza_nombre: null,
      cert_url: null, cert_nombre: null, factura_url: null, factura_nombre: null,
      detalle: '', finalizada: false, orden: 0, created_at: '', updated_at: '',
    });
  }

  async function subirArchivo(jurId: string, tipo: AdjuntoKey, file: File): Promise<string> {
    const ts = Date.now();
    const path = `polizas/${jurId}/${ts}_${tipo}_${sanitizeKey(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  async function guardar(files: Record<AdjuntoKey, File | null>) {
    if (!editing) return;
    if (!editing.empresa.trim()) { alert('La empresa de seguros es obligatoria.'); return; }
    if (!editing.jurisdiccion_id) { alert('Elegí una jurisdicción.'); return; }
    setBusy(true);
    try {
      const payload: any = {
        jurisdiccion_id: editing.jurisdiccion_id,
        fecha_alta: editing.fecha_alta || null,
        empresa: editing.empresa.trim(),
        monto_asegurado: editing.monto_asegurado,
        vencimiento: editing.vencimiento || null,
        fecha_revision: editing.fecha_revision || null,
        aviso_baja: editing.aviso_baja || null,
        baja_link: editing.baja_link?.trim() || null,
        poliza_url: editing.poliza_url, poliza_nombre: editing.poliza_nombre,
        cert_url: editing.cert_url, cert_nombre: editing.cert_nombre,
        factura_url: editing.factura_url, factura_nombre: editing.factura_nombre,
        detalle: editing.detalle?.trim() || null,
        finalizada: editing.finalizada,
      };

      for (const { key, urlKey, nomKey } of ADJUNTOS) {
        const f = files[key];
        if (f) {
          payload[urlKey] = await subirArchivo(editing.jurisdiccion_id, key, f);
          payload[nomKey] = f.name;
        }
      }

      if (editing.id) {
        await supabase.from('repo_polizas').update(payload).eq('id', editing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('repo_polizas').insert({ ...payload, created_by: user?.id });
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      alert(err.message ?? 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFinalizada(p: Poliza) {
    const nueva = !p.finalizada;
    const verbo = nueva ? 'cerrar / finalizar' : 'reabrir';
    if (!confirm(`¿Querés ${verbo} la póliza de "${p.empresa}"?`)) return;
    await supabase.from('repo_polizas').update({ finalizada: nueva }).eq('id', p.id);
    load();
  }

  async function eliminar(p: Poliza) {
    if (!confirm(`¿Eliminar la póliza de "${p.empresa}"? También se borrarán los archivos adjuntos.`)) return;
    const archivos = [p.poliza_url, p.cert_url, p.factura_url].filter(Boolean) as string[];
    if (archivos.length) await supabase.storage.from(BUCKET).remove(archivos);
    await supabase.from('repo_polizas').delete().eq('id', p.id);
    load();
  }

  async function descargar(url: string | null, nombre: string | null) {
    if (!url) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(url, 60);
    if (error || !data?.signedUrl) { alert('No se pudo generar el enlace.'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = nombre ?? 'archivo';
    a.click();
  }

  // ---------- filtros (aplican a ambos recuadros) ----------
  function aplicarFiltros(lista: Poliza[]): Poliza[] {
    const q = norm(buscar);
    return lista.filter((p) => {
      if (filtroJur !== 'todas' && p.jurisdiccion_id !== filtroJur) return false;
      if (!q) return true;
      return norm(p.empresa).includes(q)
        || norm(jurById[p.jurisdiccion_id]?.nombre ?? '').includes(q)
        || norm(p.detalle ?? '').includes(q);
    });
  }
  const vigentesFiltradas = useMemo(() => aplicarFiltros(vigentes), [vigentes, buscar, filtroJur, jurById]);
  const finalizadasFiltradas = useMemo(() => aplicarFiltros(finalizadas), [finalizadas, buscar, filtroJur, jurById]);

  const hoy = hoy0();

  return (
    <AppShell>
      <TopBar
        titulo="Gestión de Pólizas"
        subtitulo="Pólizas de seguros por jurisdicción"
        actions={
          <>
            <button onClick={load} className="btn-ghost" title="Refrescar"><RefreshCcw size={14} /></button>
            <button onClick={nuevaPoliza} className="btn-primary" disabled={jurs.length === 0}>
              <Plus size={14} /> Nueva póliza
            </button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="card p-10 text-center text-muted">Cargando...</div>
        ) : jurs.length === 0 ? (
          <div className="card p-10 text-center text-muted text-sm">
            No hay jurisdicciones cargadas todavía. Creá al menos una desde{' '}
            <a href="/repositorio" className="text-primary hover:underline">Repositorio → Gestionar jurisdicciones</a>{' '}
            para poder dar de alta pólizas.
          </div>
        ) : (
          <>
            {/* ---------- Panel de alertas ---------- */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="text-xs text-muted">Vencidas</div>
                <div className="text-2xl font-semibold text-danger">{vencidas.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-muted">Próximas a vencer ({DIAS_AVISO} días)</div>
                <div className="text-2xl font-semibold text-warning">{proximas.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-muted">Avisos de baja ({DIAS_AVISO} días)</div>
                <div className="text-2xl font-semibold text-warning">{avisosBaja.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-muted">Vigentes</div>
                <div className="text-2xl font-semibold">{vigentes.length}</div>
              </div>
            </div>

            {(vencidas.length > 0 || proximas.length > 0 || avisosBaja.length > 0) && (
              <div className="card overflow-hidden">
                <Grupo titulo="Vencidas" color="danger" />
                {vencidas.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted">Sin pólizas vencidas.</div>
                ) : (
                  <TablaAlerta filas={vencidas} campo="vencimiento" jurById={jurById} hoy={hoy} onIr={setEditing} />
                )}

                <Grupo titulo={`Próximas a vencer (${DIAS_AVISO} días)`} color="warning" />
                {proximas.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted">Sin pólizas próximas a vencer.</div>
                ) : (
                  <TablaAlerta filas={proximas} campo="vencimiento" jurById={jurById} hoy={hoy} onIr={setEditing} />
                )}

                <Grupo titulo={`Avisos de baja próximos (${DIAS_AVISO} días)`} color="warning" />
                {avisosBaja.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted">Sin avisos de baja próximos.</div>
                ) : (
                  <TablaAlerta filas={avisosBaja} campo="aviso_baja" jurById={jurById} hoy={hoy} onIr={setEditing} />
                )}
              </div>
            )}

            {/* ---------- Filtros ---------- */}
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <select className="input !w-auto !py-1.5 text-sm" value={filtroJur} onChange={(e) => setFiltroJur(e.target.value)}>
                <option value="todas">Todas las jurisdicciones</option>
                {jurs.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
              </select>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input className="input !w-56 !py-1.5 !pl-8 text-sm" placeholder="Buscar empresa..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              </div>
            </div>

            {/* ---------- Recuadro: Pólizas vigentes ---------- */}
            <TablaPolizas
              titulo="Pólizas vigentes"
              variante="vigentes"
              filas={vigentesFiltradas}
              totalSinFiltro={vigentes.length}
              jurById={jurById}
              onEdit={setEditing}
              onToggle={toggleFinalizada}
              onEliminar={eliminar}
              descargar={descargar}
              onNueva={nuevaPoliza}
            />

            {/* ---------- Recuadro: Pólizas cerradas / finalizadas ---------- */}
            <TablaPolizas
              titulo="Pólizas cerradas / finalizadas"
              variante="finalizadas"
              filas={finalizadasFiltradas}
              totalSinFiltro={finalizadas.length}
              jurById={jurById}
              onEdit={setEditing}
              onToggle={toggleFinalizada}
              onEliminar={eliminar}
              descargar={descargar}
            />
          </>
        )}
      </div>

      {editing && (
        <PolizaModal
          editing={editing} setEditing={setEditing} jurs={jurs}
          guardar={guardar} descargar={descargar} busy={busy}
        />
      )}
    </AppShell>
  );
}

// ===================== Cabecera de grupo (alertas) =====================
function Grupo({ titulo, color }: { titulo: string; color: 'danger' | 'warning' }) {
  return (
    <div className="px-4 py-2.5 border-y border-border flex items-center gap-2 bg-surface-2">
      <span className={`w-2 h-2 rounded-full ${color === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
      <span className={`text-sm font-medium ${color === 'danger' ? 'text-danger' : 'text-warning'}`}>{titulo}</span>
    </div>
  );
}

// ===================== Tabla de alertas =====================
function TablaAlerta({
  filas, campo, jurById, hoy, onIr,
}: {
  filas: Poliza[];
  campo: 'vencimiento' | 'aviso_baja';
  jurById: Record<string, Jurisdiccion>;
  hoy: Date;
  onIr: (p: Poliza) => void;
}) {
  const etiquetaFecha = campo === 'vencimiento' ? 'Vencimiento' : 'Aviso de baja';
  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[680px]">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Jurisdicción</th>
            <th>{etiquetaFecha}</th>
            <th>Plazo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => {
            const iso = p[campo]!;
            const f = parseISODate(iso);
            const dias = diffDias(f, hoy); // negativo = ya pasó
            const pasado = dias < 0;
            const abs = Math.abs(dias);
            return (
              <tr key={p.id}>
                <td className="text-sm font-medium">{p.empresa}</td>
                <td><span className="chip bg-surface-2 text-text">{jurById[p.jurisdiccion_id]?.nombre ?? '—'}</span></td>
                <td className="text-sm whitespace-nowrap">{fmtFecha(iso)}</td>
                <td>
                  {pasado
                    ? <span className="chip bg-danger/15 text-danger">Hace {abs} día{abs === 1 ? '' : 's'}</span>
                    : dias === 0
                      ? <span className="chip bg-warning/15 text-warning">Hoy</span>
                      : <span className="chip bg-warning/15 text-warning">En {abs} día{abs === 1 ? '' : 's'}</span>}
                </td>
                <td className="text-xs whitespace-nowrap">
                  <button className="text-primary hover:underline" onClick={() => onIr(p)}>Ver / editar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===================== Tabla de pólizas (vigentes / finalizadas) =====================
function TablaPolizas({
  titulo, variante, filas, totalSinFiltro, jurById, onEdit, onToggle, onEliminar, descargar, onNueva,
}: {
  titulo: string;
  variante: 'vigentes' | 'finalizadas';
  filas: Poliza[];
  totalSinFiltro: number;
  jurById: Record<string, Jurisdiccion>;
  onEdit: (p: Poliza) => void;
  onToggle: (p: Poliza) => void;
  onEliminar: (p: Poliza) => void;
  descargar: (url: string | null, nombre: string | null) => void;
  onNueva?: () => void;
}) {
  const esFinal = variante === 'finalizadas';
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{titulo}</div>
        <span className="text-xs text-muted">{filas.length} de {totalSinFiltro}</span>
      </div>

      {filas.length === 0 ? (
        <div className="p-8 text-center text-muted text-sm">
          {totalSinFiltro === 0
            ? (esFinal
                ? 'No hay pólizas cerradas todavía.'
                : <>No hay pólizas vigentes. {onNueva && <button className="text-primary" onClick={onNueva}>Agregar la primera</button>}.</>)
            : 'Sin resultados para esos filtros.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl min-w-[1180px]">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Jurisdicción</th>
                <th>Alta</th>
                <th className="text-right">Monto asegurado</th>
                <th>Vencimiento</th>
                <th>Revisión</th>
                <th>Aviso baja</th>
                <th>Link baja</th>
                <th>Estado</th>
                <th>Adjuntos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} className={esFinal ? 'opacity-70' : ''}>
                  <td className="font-medium text-sm">{p.empresa}</td>
                  <td><span className="chip bg-surface-2 text-text">{jurById[p.jurisdiccion_id]?.nombre ?? '—'}</span></td>
                  <td className="text-sm whitespace-nowrap">{p.fecha_alta ? fmtFecha(p.fecha_alta) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm text-right whitespace-nowrap">{p.monto_asegurado != null ? fmtMoney(p.monto_asegurado) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm whitespace-nowrap">{p.vencimiento ? fmtFecha(p.vencimiento) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm whitespace-nowrap">{p.fecha_revision ? fmtFecha(p.fecha_revision) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm whitespace-nowrap">{p.aviso_baja ? fmtFecha(p.aviso_baja) : <span className="text-muted">—</span>}</td>
                  <td>
                    {p.baja_link ? (
                      <a href={p.baja_link} target="_blank" rel="noopener noreferrer" className="text-primary text-sm inline-flex items-center gap-1 hover:underline">
                        <ExternalLink size={13} /> Abrir
                      </a>
                    ) : <span className="text-xs text-muted">—</span>}
                  </td>
                  <td>
                    {esFinal
                      ? <span className="chip bg-surface-2 text-muted">Finalizada</span>
                      : <EstadoChip estado={estadoDe(p)} />}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {ADJUNTOS.map(({ key, urlKey, nomKey, label }) => {
                        const url = p[urlKey] as string | null;
                        return url ? (
                          <button key={key} onClick={() => descargar(url, p[nomKey] as string | null)}
                            className="text-primary text-xs inline-flex items-center gap-1 hover:underline" title={`Descargar ${label}`}>
                            <FileText size={13} /> {label}
                          </button>
                        ) : (
                          <span key={key} className="text-xs text-muted inline-flex items-center gap-1" title={`Sin ${label}`}>
                            <FileText size={13} className="opacity-40" /> {label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-3 text-xs items-center">
                      <button className="text-primary" onClick={() => onEdit(p)}>Editar</button>
                      {esFinal ? (
                        <button className="text-primary inline-flex items-center gap-1" onClick={() => onToggle(p)} title="Reabrir">
                          <RotateCcw size={12} /> Reabrir
                        </button>
                      ) : (
                        <button className="text-muted hover:text-text inline-flex items-center gap-1" onClick={() => onToggle(p)} title="Cerrar / finalizar">
                          <Archive size={12} /> Cerrar
                        </button>
                      )}
                      <button className="text-danger" onClick={() => onEliminar(p)}><Trash2 size={12} className="inline" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== Modal póliza =====================
function PolizaModal({
  editing, setEditing, jurs, guardar, descargar, busy,
}: {
  editing: Poliza;
  setEditing: (p: Poliza | null) => void;
  jurs: Jurisdiccion[];
  guardar: (files: Record<AdjuntoKey, File | null>) => void;
  descargar: (url: string | null, nombre: string | null) => void;
  busy: boolean;
}) {
  const [files, setFiles] = useState<Record<AdjuntoKey, File | null>>({ poliza: null, cert: null, factura: null });

  function quitarExistente(urlKey: string, nomKey: string) {
    setEditing({ ...editing, [urlKey]: null, [nomKey]: null } as Poliza);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
      <div className="card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">{editing.id ? 'Editar' : 'Nueva'} póliza</h3>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Empresa de seguros *</label>
              <input className="input" value={editing.empresa} onChange={(e) => setEditing({ ...editing, empresa: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Jurisdicción a aplicar *</label>
              <select className="input" value={editing.jurisdiccion_id} onChange={(e) => setEditing({ ...editing, jurisdiccion_id: e.target.value })}>
                {jurs.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Fecha de alta</label>
              <input type="date" className="input" value={editing.fecha_alta ?? ''} onChange={(e) => setEditing({ ...editing, fecha_alta: e.target.value || null })} />
            </div>
            <div>
              <label className="text-xs text-muted">Monto asegurado</label>
              <input type="number" step="0.01" min="0" className="input" placeholder="0,00"
                value={editing.monto_asegurado ?? ''}
                onChange={(e) => setEditing({ ...editing, monto_asegurado: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Fecha de vencimiento</label>
              <input type="date" className="input" value={editing.vencimiento ?? ''} onChange={(e) => setEditing({ ...editing, vencimiento: e.target.value || null })} />
              <p className="text-xs text-muted mt-1">El estado (Vigente / Vencida) y las alertas se calculan con esta fecha.</p>
            </div>
            <div>
              <label className="text-xs text-muted">Fecha de revisión de vencimiento</label>
              <input type="date" className="input" value={editing.fecha_revision ?? ''} onChange={(e) => setEditing({ ...editing, fecha_revision: e.target.value || null })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Fecha de aviso de baja</label>
              <input type="date" className="input" value={editing.aviso_baja ?? ''} onChange={(e) => setEditing({ ...editing, aviso_baja: e.target.value || null })} />
              <p className="text-xs text-muted mt-1">Genera una alerta aparte para no pasarse la fecha de aviso.</p>
            </div>
            <div>
              <label className="text-xs text-muted">Link (mail de baja enviado)</label>
              <input className="input" placeholder="https://..." value={editing.baja_link ?? ''} onChange={(e) => setEditing({ ...editing, baja_link: e.target.value })} />
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-medium text-muted mb-2">Adjuntos (PDF)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ADJUNTOS.map(({ key, urlKey, nomKey, label }) => {
                const url = editing[urlKey] as string | null;
                const nombre = editing[nomKey] as string | null;
                const nuevo = files[key];
                return (
                  <div key={key}>
                    <label className="text-xs text-muted">{label}</label>
                    {url ? (
                      <div className="flex items-center gap-2 border border-border rounded p-2 text-sm">
                        <FileText size={16} className="shrink-0" />
                        <button type="button" onClick={() => descargar(url, nombre)} className="truncate flex-1 text-left text-primary hover:underline" title={nombre ?? ''}>
                          {nombre ?? 'Ver'}
                        </button>
                        <button onClick={() => quitarExistente(urlKey, nomKey)} className="text-danger shrink-0" title="Quitar"><X size={14} /></button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-border rounded p-3 text-center text-sm cursor-pointer hover:border-primary block">
                        {nuevo ? (
                          <>
                            <FileText className="mx-auto text-success mb-1" size={18} />
                            <div className="font-medium truncate text-xs">{nuevo.name}</div>
                            <div className="text-xs text-muted">{(nuevo.size / 1024).toFixed(0)} KB</div>
                          </>
                        ) : (
                          <>
                            <Upload className="mx-auto text-muted mb-1" size={18} />
                            <div className="text-xs">Subir PDF</div>
                          </>
                        )}
                        <input type="file" accept="application/pdf,.pdf" className="hidden"
                          onChange={(e) => setFiles((s) => ({ ...s, [key]: e.target.files?.[0] ?? null }))} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted">Detalle</label>
            <textarea className="input min-h-20" value={editing.detalle ?? ''} onChange={(e) => setEditing({ ...editing, detalle: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={editing.finalizada} onChange={(e) => setEditing({ ...editing, finalizada: e.target.checked })} />
            Póliza cerrada / finalizada (dada de baja)
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button>
          <button className="btn-primary" disabled={busy} onClick={() => guardar(files)}>
            {busy ? <><Loader2 className="animate-spin" size={14} /> Guardando...</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
