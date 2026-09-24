'use client';

import { useState } from 'react';
import { FileCheck2, FileDown, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, fmtMoney } from '@/lib/format';
import { parseCheques } from '@/lib/cheques/parseCheques';
import { descargarPlantillaCheques } from '@/lib/cheques/plantilla';
import { Librador } from './tipos';

export function ImportModal({ libradores, onClose, onDone }: { libradores: Librador[]; onClose: () => void; onDone: () => void }) {
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
