'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, FileText, Folder, Plus, RefreshCcw, Search, Settings2, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha } from '@/lib/format';
import { avisar, confirmar } from '@/components/feedback';
import { Cargando } from '@/components/Cargando';
import { DocModal } from './_componentes/DocModal';
import { GestionarModal } from './_componentes/GestionarModal';
import { EstadoChip, Vencimientos } from './_componentes/Vencimientos';
import { BUCKET, DIAS_AVISO, Documento, Estado, Jurisdiccion, estadoDe, hoy0, norm, parseISODate, sanitizeKey, tieneDocumento } from './_componentes/utils';

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
  const [gbuscar, setGbuscar] = useState(''); // búsqueda global en la portada

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
    if (!editing.documento.trim()) { avisar('El nombre del documento es obligatorio.'); return; }
    if (!editing.jurisdiccion_id) { avisar('Elegí una jurisdicción.'); return; }
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
      avisar(err.message ?? 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function eliminarDoc(d: Documento) {
    if (!(await confirmar(`¿Eliminar "${d.documento}"? También se borrará el archivo adjunto si existe.`))) return;
    if (d.archivo_url) await supabase.storage.from(BUCKET).remove([d.archivo_url]);
    await supabase.from('repo_documentos').delete().eq('id', d.id);
    load();
  }

  async function descargar(d: Documento) {
    if (!d.archivo_url) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.archivo_url, 60);
    if (error || !data?.signedUrl) { avisar('No se pudo generar el enlace.'); return; }
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
    const q = norm(buscar);
    return norm(d.documento).includes(q)
      || norm(d.detalle ?? '').includes(q)
      || norm(d.archivo_nombre ?? '').includes(q);
  });

  // Búsqueda global de documentos (portada de Vencimientos)
  const resultadosGlobal = useMemo(() => {
    const q = norm(gbuscar);
    if (!q) return [];
    return docs
      .filter((d) =>
        norm(d.documento).includes(q)
        || norm(d.detalle ?? '').includes(q)
        || norm(d.archivo_nombre ?? '').includes(q)
        || norm(jurById[d.jurisdiccion_id]?.nombre ?? '').includes(q))
      .sort((a, b) => a.documento.localeCompare(b.documento));
  }, [gbuscar, docs, jurById]);

  const jurActual = jurById[tab];

  return (
    <AppShell>
      <TopBar
        titulo="Repositorio"
        subtitulo="Documentación legal por jurisdicción"
        actions={
          tab !== 'vencimientos'
            ? <button onClick={nuevoDoc} className="btn-primary"><Plus size={14} /> Nuevo documento</button>
            : <button onClick={load} className="btn-ghost" title="Refrescar"><RefreshCcw size={14} /></button>
        }
      />

      <div className="px-4 sm:px-6 py-5 space-y-4">
        {loading ? (
          <Cargando filas={6} enTarjeta />
        ) : tab === 'vencimientos' ? (
          <>
            <Vencimientos vencidos={vencidos} proximos={proximos} jurById={jurById} onIr={(d) => { setBuscar(''); setTab(d.jurisdiccion_id); }} />

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-medium">Jurisdicciones</div>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    className="input !w-64 !py-1.5 !pl-8 text-sm"
                    placeholder="Buscar documentos..."
                    value={gbuscar}
                    onChange={(e) => setGbuscar(e.target.value)}
                  />
                </div>
              </div>

              {gbuscar.trim() ? (
                resultadosGlobal.length === 0 ? (
                  <div className="p-8 text-center text-muted text-sm">Sin documentos que coincidan con “{gbuscar}”.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tbl min-w-[640px]">
                      <thead>
                        <tr>
                          <th>Jurisdicción</th>
                          <th>Documento</th>
                          <th>Vencimiento</th>
                          <th>Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultadosGlobal.map((d) => (
                          <tr key={d.id}>
                            <td><span className="chip bg-surface-2 text-text">{jurById[d.jurisdiccion_id]?.nombre ?? '—'}</span></td>
                            <td className="text-sm font-medium">{d.documento}</td>
                            <td className="text-sm whitespace-nowrap">{d.vencimiento ? fmtFecha(d.vencimiento) : <span className="text-muted">—</span>}</td>
                            <td><EstadoChip estado={estadoDe(d)} /></td>
                            <td className="text-xs whitespace-nowrap">
                              <button className="text-primary hover:underline" onClick={() => { setBuscar(gbuscar); setTab(d.jurisdiccion_id); }}>Ver</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                  {jurs.map((j) => {
                    const cant = docs.filter((d) => d.jurisdiccion_id === j.id).length;
                    return (
                      <button
                        key={j.id}
                        onClick={() => { setBuscar(''); setTab(j.id); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded border border-border hover:bg-surface-2 hover:border-primary/40 transition text-left"
                      >
                        <span className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Folder size={16} />
                        </span>
                        <span className="font-medium text-sm truncate flex-1">{j.nombre}</span>
                        <span className="text-xs text-muted shrink-0">{cant} doc{cant === 1 ? '' : 's'}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setGestionar(true)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded border border-dashed border-border hover:bg-surface-2 transition text-left text-muted"
                  >
                    <span className="w-8 h-8 rounded bg-surface-2 flex items-center justify-center shrink-0">
                      <Settings2 size={16} />
                    </span>
                    <span className="font-medium text-sm flex-1">Gestionar jurisdicciones</span>
                    <Plus size={14} className="shrink-0" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setBuscar(''); setTab('vencimientos'); }} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
              <ChevronLeft size={14} /> Volver al repositorio
            </button>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-medium">{jurActual?.nombre ?? '—'}</div>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input className="input !w-auto !py-1.5 !pl-8 text-sm" placeholder="Buscar..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
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
                          <td><div className="flex gap-3 text-xs whitespace-nowrap">
                            <button className="text-primary" onClick={() => setEditing(d)}>Editar</button>
                            <button className="text-danger" onClick={() => eliminarDoc(d)}><Trash2 size={12} className="inline" /></button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
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
