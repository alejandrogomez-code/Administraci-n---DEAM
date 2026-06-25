'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ExternalLink, FileText,
  Loader2, Plus, RefreshCcw, Settings2, Trash2, Upload,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha } from '@/lib/format';

const BUCKET = 'repo-files';
const DIAS_AVISO = 30; // ventana de "próximo a vencer"

type Jurisdiccion = {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
};

type Documento = {
  id: string;
  jurisdiccion_id: string;
  documento: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  url: string | null;
  vencimiento: string | null; // YYYY-MM-DD
  detalle: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
};

type Estado = 'vigente' | 'vencido' | 'sin_documento';

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
function tieneDocumento(d: Documento): boolean {
  return !!d.archivo_url || !!(d.url && d.url.trim());
}
function estadoDe(d: Documento): Estado {
  if (!tieneDocumento(d)) return 'sin_documento';
  if (d.vencimiento && parseISODate(d.vencimiento) < hoy0()) return 'vencido';
  return 'vigente';
}

function EstadoChip({ estado }: { estado: Estado }) {
  if (estado === 'vigente')
    return <span className="chip bg-success/15 text-success">Vigente</span>;
  if (estado === 'vencido')
    return <span className="chip bg-danger/15 text-danger">Vencido</span>;
  return <span className="chip bg-surface-2 text-muted">Sin documento</span>;
}

// Limpia el nombre para usarlo como clave en Supabase Storage
// (no admite acentos ni varios símbolos). Mantené file.name aparte para mostrar.
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'jurisdiccion';
}

export default function RepositorioPage() {
  const supabase = createClient();
  const [jurs, setJurs] = useState<Jurisdiccion[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('vencimientos'); // 'vencimientos' | jurisdiccion.id
  const [editing, setEditing] = useState<Documento | null>(null);
  const [gestionar, setGestionar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [buscar, setBuscar] = useState('');

  async function load() {
    setLoading(true);
    const [{ data: j }, { data: d }] = await Promise.all([
      supabase.from('repo_jurisdicciones').select('*').order('orden').order('nombre'),
      supabase.from('repo_documentos').select('*').order('orden').order('documento'),
    ]);
    setJurs((j as any) ?? []);
    setDocs((d as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const jurById = useMemo(() => {
    const m: Record<string, Jurisdiccion> = {};
    jurs.forEach((j) => { m[j.id] = j; });
    return m;
  }, [jurs]);

  // ---------- panel de vencimientos ----------
  const { vencidos, proximos } = useMemo(() => {
    const hoy = hoy0();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + DIAS_AVISO);
    const conVenc = docs.filter((d) => d.vencimiento && tieneDocumento(d));
    const vencidos = conVenc
      .filter((d) => parseISODate(d.vencimiento!) < hoy)
      .sort((a, b) => parseISODate(a.vencimiento!).getTime() - parseISODate(b.vencimiento!).getTime());
    const proximos = conVenc
      .filter((d) => {
        const f = parseISODate(d.vencimiento!);
        return f >= hoy && f <= limite;
      })
      .sort((a, b) => parseISODate(a.vencimiento!).getTime() - parseISODate(b.vencimiento!).getTime());
    return { vencidos, proximos };
  }, [docs]);

  // ---------- acciones ----------
  function nuevoDoc() {
    const jurId = tab !== 'vencimientos' ? tab : jurs[0]?.id ?? '';
    setEditing({
      id: '', jurisdiccion_id: jurId, documento: '', archivo_url: null, archivo_nombre: null,
      url: '', vencimiento: null, detalle: '', orden: 0, created_at: '', updated_at: '',
    });
  }

  async function guardarDoc(file?: File | null) {
    if (!editing) return;
    if (!editing.documento.trim()) { alert('El nombre del documento es obligatorio.'); return; }
    if (!editing.jurisdiccion_id) { alert('Elegí una jurisdicción.'); return; }
    setBusy(true);
    try {
      let archivo_url = editing.archivo_url;
      let archivo_nombre = editing.archivo_nombre;

      if (file) {
        const ts = Date.now();
        const path = `${editing.jurisdiccion_id}/${ts}_${sanitizeKey(file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        archivo_url = path;
        archivo_nombre = file.name;
      }

      const payload = {
        jurisdiccion_id: editing.jurisdiccion_id,
        documento: editing.documento.trim(),
        archivo_url, archivo_nombre,
        url: editing.url?.trim() || null,
        vencimiento: editing.vencimiento || null,
        detalle: editing.detalle?.trim() || null,
      };
      if (editing.id) {
        await supabase.from('repo_documentos').update(payload).eq('id', editing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('repo_documentos').insert({ ...payload, created_by: user?.id });
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      alert(err.message ?? 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function eliminarDoc(d: Documento) {
    if (!confirm(`¿Eliminar "${d.documento}"? También se borrará el archivo adjunto si existe.`)) return;
    if (d.archivo_url) await supabase.storage.from(BUCKET).remove([d.archivo_url]);
    await supabase.from('repo_documentos').delete().eq('id', d.id);
    load();
  }

  async function descargar(d: Documento) {
    if (!d.archivo_url) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.archivo_url, 60);
    if (error || !data?.signedUrl) { alert('No se pudo generar el enlace.'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = d.archivo_nombre ?? 'archivo';
    a.click();
  }

  async function quitarArchivo() {
    if (!editing) return;
    if (editing.archivo_url) await supabase.storage.from(BUCKET).remove([editing.archivo_url]);
    setEditing({ ...editing, archivo_url: null, archivo_nombre: null });
  }

  const docsTab = docs.filter((d) => d.jurisdiccion_id === tab);
  const docsFiltrados = docsTab.filter((d) => {
    if (!buscar.trim()) return true;
    const q = buscar.toLowerCase();
    return d.documento.toLowerCase().includes(q)
      || (d.detalle ?? '').toLowerCase().includes(q)
      || (d.archivo_nombre ?? '').toLowerCase().includes(q);
  });

  const jurActual = jurById[tab];

  return (
    <AppShell>
      <TopBar
        titulo="Repositorio"
        subtitulo="Documentación legal por jurisdicción"
        actions={
          tab !== 'vencimientos'
            ? <button onClick={nuevoDoc} className="btn-primary"><Plus size={14} /> Nuevo documento</button>
            : undefined
        }
      />

      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setTab('vencimientos')}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition border ${
              tab === 'vencimientos'
                ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                : 'text-text border-border hover:bg-surface-2'
            }`}
          >
            <AlertTriangle size={14} /> Vencimientos
            {(vencidos.length + proximos.length) > 0 && (
              <span className="ml-1 text-xs bg-danger/15 text-danger rounded-full px-1.5">
                {vencidos.length + proximos.length}
              </span>
            )}
          </button>

          {jurs.map((j) => (
            <button
              key={j.id}
              onClick={() => { setTab(j.id); setBuscar(''); }}
              className={`shrink-0 px-3 py-1.5 rounded text-sm transition border ${
                tab === j.id
                  ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                  : 'text-text border-border hover:bg-surface-2'
              }`}
            >
              {j.nombre}
            </button>
          ))}

          <button
            onClick={() => setGestionar(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-muted border border-border hover:bg-surface-2 transition"
            title="Gestionar jurisdicciones"
          >
            <Settings2 size={14} /> Gestionar
          </button>

          <button onClick={load} className="shrink-0 btn-ghost ml-auto" title="Refrescar">
            <RefreshCcw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-muted">Cargando...</div>
        ) : tab === 'vencimientos' ? (
          <Vencimientos vencidos={vencidos} proximos={proximos} jurById={jurById} onIr={(d) => setTab(d.jurisdiccion_id)} />
        ) : (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-medium">{jurActual?.nombre ?? '—'}</div>
              <div className="flex items-center gap-2">
                <input className="input !w-auto !py-1.5 text-sm" placeholder="Buscar..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              </div>
            </div>

            {docsFiltrados.length === 0 ? (
              <div className="p-10 text-center text-muted text-sm">
                {docsTab.length === 0
                  ? <>No hay documentos en esta jurisdicción todavía. <button className="text-primary" onClick={nuevoDoc}>Agregar el primero</button>.</>
                  : 'Sin resultados para esa búsqueda.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl min-w-[920px]">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>PDF / Archivo</th>
                      <th>URL</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                      <th>Detalle</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsFiltrados.map((d) => {
                      const estado = estadoDe(d);
                      return (
                        <tr key={d.id}>
                          <td className="font-medium text-sm">{d.documento}</td>
                          <td>
                            {d.archivo_url ? (
                              <button onClick={() => descargar(d)} className="text-primary text-sm inline-flex items-center gap-1 hover:underline">
                                <FileText size={14} /> <span className="truncate max-w-40">{d.archivo_nombre ?? 'Descargar'}</span>
                              </button>
                            ) : <span className="text-xs text-muted">—</span>}
                          </td>
                          <td>
                            {d.url ? (
                              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm inline-flex items-center gap-1 hover:underline">
                                <ExternalLink size={14} /> Abrir
                              </a>
                            ) : <span className="text-xs text-muted">—</span>}
                          </td>
                          <td className="text-sm whitespace-nowrap">{d.vencimiento ? fmtFecha(d.vencimiento) : <span className="text-muted">—</span>}</td>
                          <td><EstadoChip estado={estado} /></td>
                          <td className="text-xs max-w-xs whitespace-pre-wrap">{d.detalle ?? '—'}</td>
                          <td className="flex gap-3 text-xs whitespace-nowrap">
                            <button className="text-primary" onClick={() => setEditing(d)}>Editar</button>
                            <button className="text-danger" onClick={() => eliminarDoc(d)}><Trash2 size={12} className="inline" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <DocModal
          editing={editing} setEditing={setEditing} jurs={jurs}
          guardar={guardarDoc} quitarArchivo={quitarArchivo} busy={busy}
        />
      )}
      {gestionar && (
        <GestionarModal
          supabase={supabase} jurs={jurs} docs={docs}
          onClose={() => setGestionar(false)}
          onChanged={() => load()}
          tab={tab} setTab={setTab}
        />
      )}
    </AppShell>
  );
}

// ===================== Panel de Vencimientos =====================
function Vencimientos({
  vencidos, proximos, jurById, onIr,
}: {
  vencidos: Documento[];
  proximos: Documento[];
  jurById: Record<string, Jurisdiccion>;
  onIr: (d: Documento) => void;
}) {
  const hoy = hoy0();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-muted">Vencidos</div>
          <div className="text-2xl font-semibold text-danger">{vencidos.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Próximos a vencer ({DIAS_AVISO} días)</div>
          <div className="text-2xl font-semibold text-warning">{proximos.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Jurisdicciones</div>
          <div className="text-2xl font-semibold">{Object.keys(jurById).length}</div>
        </div>
      </div>

      {vencidos.length === 0 && proximos.length === 0 ? (
        <div className="card p-10 text-center text-muted text-sm">
          No hay documentos vencidos ni próximos a vencer. Todo en orden. ✅
        </div>
      ) : (
        <div className="card overflow-hidden">
          <Grupo titulo="Vencidos" color="danger" />
          {vencidos.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted">Sin documentos vencidos.</div>
          ) : (
            <TablaVenc filas={vencidos} jurById={jurById} hoy={hoy} tipo="vencido" onIr={onIr} />
          )}

          <Grupo titulo={`Próximos a vencer (${DIAS_AVISO} días)`} color="warning" />
          {proximos.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted">Sin documentos próximos a vencer.</div>
          ) : (
            <TablaVenc filas={proximos} jurById={jurById} hoy={hoy} tipo="proximo" onIr={onIr} />
          )}
        </div>
      )}
    </div>
  );
}

function Grupo({ titulo, color }: { titulo: string; color: 'danger' | 'warning' }) {
  return (
    <div className="px-4 py-2.5 border-y border-border flex items-center gap-2 bg-surface-2">
      <span className={`w-2 h-2 rounded-full ${color === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
      <span className={`text-sm font-medium ${color === 'danger' ? 'text-danger' : 'text-warning'}`}>{titulo}</span>
    </div>
  );
}

function TablaVenc({
  filas, jurById, hoy, tipo, onIr,
}: {
  filas: Documento[];
  jurById: Record<string, Jurisdiccion>;
  hoy: Date;
  tipo: 'vencido' | 'proximo';
  onIr: (d: Documento) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[640px]">
        <thead>
          <tr>
            <th>Jurisdicción</th>
            <th>Documento</th>
            <th>Vencimiento</th>
            <th>{tipo === 'vencido' ? 'Vencido' : 'Vence'}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((d) => {
            const f = parseISODate(d.vencimiento!);
            const dias = Math.abs(diffDias(f, hoy));
            return (
              <tr key={d.id}>
                <td>
                  <span className="chip bg-surface-2 text-text">{jurById[d.jurisdiccion_id]?.nombre ?? '—'}</span>
                </td>
                <td className="text-sm">{d.documento}</td>
                <td className="text-sm whitespace-nowrap">{fmtFecha(d.vencimiento)}</td>
                <td>
                  {tipo === 'vencido'
                    ? <span className="chip bg-danger/15 text-danger">Hace {dias} día{dias === 1 ? '' : 's'}</span>
                    : <span className="chip bg-warning/15 text-warning">En {dias} día{dias === 1 ? '' : 's'}</span>}
                </td>
                <td className="text-xs whitespace-nowrap">
                  <button className="text-primary hover:underline" onClick={() => onIr(d)}>Ver</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===================== Modal documento =====================
function DocModal({
  editing, setEditing, jurs, guardar, quitarArchivo, busy,
}: {
  editing: Documento;
  setEditing: (d: Documento | null) => void;
  jurs: Jurisdiccion[];
  guardar: (file?: File | null) => void;
  quitarArchivo: () => void;
  busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
      <div className="card max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">{editing.id ? 'Editar' : 'Nuevo'} documento</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted">Jurisdicción *</label>
            <select className="input" value={editing.jurisdiccion_id} onChange={(e) => setEditing({ ...editing, jurisdiccion_id: e.target.value })}>
              {jurs.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted">Documento *</label>
            <input className="input" value={editing.documento} onChange={(e) => setEditing({ ...editing, documento: e.target.value })} />
          </div>

          <div>
            <label className="text-xs text-muted">PDF / Archivo</label>
            {editing.archivo_url ? (
              <div className="flex items-center gap-2 border border-border rounded p-2 text-sm">
                <FileText size={16} />
                <span className="truncate flex-1">{editing.archivo_nombre}</span>
                <button onClick={quitarArchivo} className="text-danger text-xs hover:underline">Quitar</button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border rounded p-3 text-center text-sm cursor-pointer hover:border-primary block">
                {file ? (
                  <>
                    <FileText className="mx-auto text-success mb-1" size={20} />
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB</div>
                  </>
                ) : (
                  <>
                    <Upload className="mx-auto text-muted mb-1" size={20} />
                    <div>Seleccionar archivo</div>
                    <div className="text-xs text-muted">PDF, DOC, XLSX, imágenes, etc.</div>
                  </>
                )}
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          <div>
            <label className="text-xs text-muted">URL (Drive, web, etc.)</label>
            <input className="input" placeholder="https://..." value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
          </div>

          <div>
            <label className="text-xs text-muted">Vencimiento</label>
            <input type="date" className="input" value={editing.vencimiento ?? ''} onChange={(e) => setEditing({ ...editing, vencimiento: e.target.value || null })} />
            <p className="text-xs text-muted mt-1">El estado (Vigente / Vencido / Sin documento) se calcula solo con esta fecha.</p>
          </div>

          <div>
            <label className="text-xs text-muted">Detalle</label>
            <textarea className="input min-h-24" value={editing.detalle ?? ''} onChange={(e) => setEditing({ ...editing, detalle: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button>
          <button className="btn-primary" disabled={busy} onClick={() => guardar(file)}>
            {busy ? <><Loader2 className="animate-spin" size={14} /> Guardando...</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== Modal gestionar jurisdicciones =====================
function GestionarModal({
  supabase, jurs, docs, onClose, onChanged, tab, setTab,
}: {
  supabase: ReturnType<typeof createClient>;
  jurs: Jurisdiccion[];
  docs: Documento[];
  onClose: () => void;
  onChanged: () => void;
  tab: string;
  setTab: (t: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [busy, setBusy] = useState(false);

  async function agregar() {
    const n = nombre.trim();
    if (!n) return;
    setBusy(true);
    try {
      const slug = slugify(n);
      const orden = (jurs.reduce((mx, j) => Math.max(mx, j.orden), -1)) + 1;
      const { error } = await supabase.from('repo_jurisdicciones').insert({ nombre: n, slug, orden });
      if (error) throw error;
      setNombre('');
      onChanged();
    } catch (err: any) {
      alert(err.message ?? 'Error al agregar.');
    } finally { setBusy(false); }
  }

  async function renombrar(j: Jurisdiccion) {
    const n = prompt('Nuevo nombre:', j.nombre);
    if (!n || !n.trim() || n.trim() === j.nombre) return;
    await supabase.from('repo_jurisdicciones').update({ nombre: n.trim() }).eq('id', j.id);
    onChanged();
  }

  async function eliminar(j: Jurisdiccion) {
    const cant = docs.filter((d) => d.jurisdiccion_id === j.id).length;
    const msg = cant > 0
      ? `"${j.nombre}" tiene ${cant} documento(s). Si la eliminás se borran también esos documentos. ¿Continuar?`
      : `¿Eliminar "${j.nombre}"?`;
    if (!confirm(msg)) return;
    // borrar archivos del storage de esos documentos
    const archivos = docs.filter((d) => d.jurisdiccion_id === j.id && d.archivo_url).map((d) => d.archivo_url!) as string[];
    if (archivos.length) await supabase.storage.from(BUCKET).remove(archivos);
    await supabase.from('repo_jurisdicciones').delete().eq('id', j.id);
    if (tab === j.id) setTab('vencimientos');
    onChanged();
  }

  async function mover(j: Jurisdiccion, dir: -1 | 1) {
    const ordenados = [...jurs].sort((a, b) => a.orden - b.orden);
    const i = ordenados.findIndex((x) => x.id === j.id);
    const swap = ordenados[i + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from('repo_jurisdicciones').update({ orden: swap.orden }).eq('id', j.id),
      supabase.from('repo_jurisdicciones').update({ orden: j.orden }).eq('id', swap.id),
    ]);
    onChanged();
  }

  const ordenados = [...jurs].sort((a, b) => a.orden - b.orden);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">Gestionar jurisdicciones</h3>

        <div className="space-y-1.5 mb-4">
          {ordenados.map((j, i) => (
            <div key={j.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5 text-sm">
              <span className="flex-1 truncate">{j.nombre}</span>
              <span className="text-xs text-muted">{docs.filter((d) => d.jurisdiccion_id === j.id).length}</span>
              <button className="text-muted hover:text-text disabled:opacity-30" disabled={i === 0} onClick={() => mover(j, -1)} title="Subir">↑</button>
              <button className="text-muted hover:text-text disabled:opacity-30" disabled={i === ordenados.length - 1} onClick={() => mover(j, 1)} title="Bajar">↓</button>
              <button className="text-primary text-xs hover:underline" onClick={() => renombrar(j)}>Renombrar</button>
              <button className="text-danger" onClick={() => eliminar(j)}><Trash2 size={13} /></button>
            </div>
          ))}
          {ordenados.length === 0 && <div className="text-xs text-muted">No hay jurisdicciones todavía.</div>}
        </div>

        <div className="flex items-center gap-2">
          <input className="input" placeholder="Nueva jurisdicción (ej: Santa Fe)" value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }} />
          <button className="btn-primary shrink-0" disabled={busy || !nombre.trim()} onClick={agregar}>
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Agregar
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
