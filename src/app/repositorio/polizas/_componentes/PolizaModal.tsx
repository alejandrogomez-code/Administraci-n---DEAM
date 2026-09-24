'use client';

import { useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { ADJUNTOS, AdjuntoKey, Jurisdiccion, Poliza } from './utils';

export function PolizaModal({
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
