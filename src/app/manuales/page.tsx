'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2, Plus, RefreshCcw, Trash2, Upload } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFechaHora } from '@/lib/format';

type Manual = {
  id: string;
  titulo: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  link: string | null;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export default function ManualesPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Manual | null>(null);
  const [busy, setBusy] = useState(false);
  const [buscar, setBuscar] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('manuales').select('*').order('titulo');
    setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function nuevo() {
    setEditing({
      id: '', titulo: '', archivo_url: null, archivo_nombre: null,
      link: '', observaciones: '', activo: true,
      created_at: '', updated_at: '',
    });
  }

  async function guardar(file?: File | null) {
    if (!editing) return;
    if (!editing.titulo.trim()) { alert('El título es obligatorio.'); return; }
    setBusy(true);
    try {
      let archivo_url = editing.archivo_url;
      let archivo_nombre = editing.archivo_nombre;

      if (file) {
        const ts = Date.now();
        const path = `${ts}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('manual-files').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        archivo_url = path;
        archivo_nombre = file.name;
      }

      const payload = {
        titulo: editing.titulo,
        archivo_url, archivo_nombre,
        link: editing.link?.trim() || null,
        observaciones: editing.observaciones?.trim() || null,
        activo: editing.activo,
      };
      if (editing.id) {
        await supabase.from('manuales').update(payload).eq('id', editing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('manuales').insert({ ...payload, created_by: user?.id });
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      alert(err.message ?? 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function eliminar(m: Manual) {
    if (!confirm(`¿Eliminar "${m.titulo}"? También se eliminará el archivo adjunto si existe.`)) return;
    if (m.archivo_url) {
      await supabase.storage.from('manual-files').remove([m.archivo_url]);
    }
    await supabase.from('manuales').delete().eq('id', m.id);
    load();
  }

  async function descargar(m: Manual) {
    if (!m.archivo_url) return;
    const { data, error } = await supabase.storage.from('manual-files').createSignedUrl(m.archivo_url, 60);
    if (error || !data?.signedUrl) { alert('No se pudo generar el enlace.'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = m.archivo_nombre ?? 'archivo';
    a.click();
  }

  async function quitarArchivo() {
    if (!editing) return;
    if (editing.archivo_url) {
      // si está editando uno existente, borrar el archivo del bucket cuando se guarde
      await supabase.storage.from('manual-files').remove([editing.archivo_url]);
    }
    setEditing({ ...editing, archivo_url: null, archivo_nombre: null });
  }

  const filtrados = items.filter((m) => {
    if (!buscar.trim()) return true;
    const q = buscar.toLowerCase();
    return (m.titulo.toLowerCase().includes(q)
      || (m.observaciones ?? '').toLowerCase().includes(q)
      || (m.archivo_nombre ?? '').toLowerCase().includes(q));
  });

  return (
    <AppShell>
      <TopBar
        titulo="Manuales y Capacitaciones"
        subtitulo="Documentación, instructivos y enlaces de capacitación"
        actions={<button onClick={nuevo} className="btn-primary"><Plus size={14}/> Nuevo</button>}
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm">{filtrados.length} ítem{filtrados.length === 1 ? '' : 's'}</div>
            <div className="flex items-center gap-2">
              <input className="input !w-auto !py-1.5 text-sm" placeholder="Buscar..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <button onClick={load} className="btn-ghost"><RefreshCcw size={14}/></button>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">
              {items.length === 0 ? <>No hay manuales todavía. <button className="text-primary" onClick={nuevo}>Agregar el primero</button>.</> : 'Sin resultados para esa búsqueda.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[900px]">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Archivo PDF</th>
                    <th>Link</th>
                    <th>Observaciones</th>
                    <th>Última actualización</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((m) => (
                    <tr key={m.id} className={!m.activo ? 'opacity-50' : ''}>
                      <td>
                        <div className="font-medium text-sm">{m.titulo}</div>
                        {!m.activo && <div className="text-xs text-muted">(inactivo)</div>}
                      </td>
                      <td>
                        {m.archivo_url ? (
                          <button onClick={() => descargar(m)} className="text-primary text-sm inline-flex items-center gap-1 hover:underline">
                            <FileText size={14}/> <span className="truncate max-w-40">{m.archivo_nombre ?? 'Descargar'}</span>
                          </button>
                        ) : <span className="text-xs text-muted">—</span>}
                      </td>
                      <td>
                        {m.link ? (
                          <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-primary text-sm inline-flex items-center gap-1 hover:underline">
                            <ExternalLink size={14}/> Abrir
                          </a>
                        ) : <span className="text-xs text-muted">—</span>}
                      </td>
                      <td className="text-xs max-w-xs whitespace-pre-wrap">{m.observaciones ?? '—'}</td>
                      <td className="text-xs text-muted whitespace-nowrap">{fmtFechaHora(m.updated_at)}</td>
                      <td className="flex gap-3 text-xs whitespace-nowrap">
                        <button className="text-primary" onClick={() => setEditing(m)}>Editar</button>
                        <button className="text-danger" onClick={() => eliminar(m)}><Trash2 size={12} className="inline"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && <Modal editing={editing} setEditing={setEditing} guardar={guardar} quitarArchivo={quitarArchivo} busy={busy} />}
    </AppShell>
  );
}

function Modal({ editing, setEditing, guardar, quitarArchivo, busy }: {
  editing: Manual;
  setEditing: (m: Manual | null) => void;
  guardar: (file?: File | null) => void;
  quitarArchivo: () => void;
  busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
      <div className="card max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">{editing.id ? 'Editar' : 'Nuevo'} manual / capacitación</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted">Título *</label>
            <input className="input" value={editing.titulo} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} />
          </div>

          <div>
            <label className="text-xs text-muted">Archivo PDF</label>
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
                    <FileText className="mx-auto text-success mb-1" size={20}/>
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted">{(file.size/1024).toFixed(0)} KB</div>
                  </>
                ) : (
                  <>
                    <Upload className="mx-auto text-muted mb-1" size={20}/>
                    <div>Seleccionar archivo</div>
                    <div className="text-xs text-muted">PDF, DOC, XLSX, imágenes, etc.</div>
                  </>
                )}
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          <div>
            <label className="text-xs text-muted">Link (Drive, YouTube, web)</label>
            <input className="input" placeholder="https://..." value={editing.link ?? ''} onChange={(e) => setEditing({ ...editing, link: e.target.value })} />
          </div>

          <div>
            <label className="text-xs text-muted">Observaciones</label>
            <textarea className="input min-h-24" value={editing.observaciones ?? ''} onChange={(e) => setEditing({ ...editing, observaciones: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.activo} onChange={(e) => setEditing({ ...editing, activo: e.target.checked })} />
            Activo
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button>
          <button className="btn-primary" disabled={busy} onClick={() => guardar(file)}>
            {busy ? <><Loader2 className="animate-spin" size={14}/> Guardando...</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
