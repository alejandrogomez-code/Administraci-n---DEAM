'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { avisar } from '@/components/feedback';
import { Librador } from './tipos';

export function NuevoChequeModal({ libradores, onClose, onDone }: { libradores: Librador[]; onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    vencimiento: '', asignacion: '', importe: '', librador: '', banco: '', cuit: '', tipo: '', status: '',
  });
  const [showSugg, setShowSugg] = useState(false);

  const sugerencias = useMemo(() => {
    const q = form.librador.trim().toUpperCase();
    if (q.length < 2) return [];
    return libradores.filter((l) => l.nombre.toUpperCase().includes(q)).slice(0, 8);
  }, [form.librador, libradores]);

  function pickLibrador(l: Librador) {
    setForm({ ...form, librador: l.nombre, cuit: l.cuit ?? form.cuit });
    setShowSugg(false);
  }

  async function guardar() {
    if (!form.vencimiento || !form.importe) { avisar('Vencimiento e importe son obligatorios.'); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('cheques').insert({
        vencimiento: form.vencimiento,
        asignacion: form.asignacion || null,
        importe: parseFloat(form.importe.replace(',', '.')),
        librador: form.librador || null,
        banco: form.banco || null,
        cuit: form.cuit.replace(/[^0-9]/g, '') || null,
        tipo: form.tipo || null,
        status: form.status ? parseInt(form.status) : null,
        created_by: user?.id,
      });
      onDone(); onClose();
    } catch (e: any) {
      avisar(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Nuevo cheque (carga manual)</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Vencimiento *</label>
              <input type="date" className="input" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Importe *</label>
              <input className="input" value={form.importe} onChange={(e) => setForm({ ...form, importe: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-muted">Asignación</label>
              <input className="input" value={form.asignacion} onChange={(e) => setForm({ ...form, asignacion: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Status (1-8)</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="">-</option>
                {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="relative">
            <label className="text-xs text-muted">Librador (autocompleta CUIT)</label>
            <input
              className="input"
              value={form.librador}
              onChange={(e) => { setForm({ ...form, librador: e.target.value }); setShowSugg(true); }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              placeholder="Empezá a escribir el nombre..."
            />
            {showSugg && sugerencias.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 card shadow-card z-10 max-h-64 overflow-y-auto">
                {sugerencias.map((l) => (
                  <button key={l.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickLibrador(l)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border last:border-b-0 text-sm">
                    <div className="font-medium">{l.nombre}</div>
                    <div className="text-xs text-muted">CUIT {l.cuit ?? '—'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted">Banco</label>
            <input className="input" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">CUIT</label>
              <input className="input" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted">Tipo</label>
              <input className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="7" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={busy} onClick={guardar}>
            {busy ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
