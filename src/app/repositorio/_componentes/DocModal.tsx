'use client';

import { useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { Documento, Jurisdiccion } from './utils';

export function DocModal({
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
