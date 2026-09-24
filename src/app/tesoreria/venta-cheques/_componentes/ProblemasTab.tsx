'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { avisar, confirmar } from '@/components/feedback';
import { ClienteProblema, Librador } from './tipos';

/* ============================================================
   TAB 3: CLIENTES CON PROBLEMAS
   ============================================================ */
export function ProblemasTab({ problemas, reload }: { problemas: ClienteProblema[]; reload: () => void }) {
  const supabase = createClient();
  const [librador, setLibrador] = useState('');
  const [cuit, setCuit] = useState('');
  const [motivo, setMotivo] = useState('');

  async function agregar() {
    if (!librador.trim() || !cuit.trim()) { avisar('Librador y CUIT son obligatorios.'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const cuitClean = cuit.replace(/[^0-9]/g, '');
    const { error } = await supabase.from('clientes_problemas').insert({
      librador: librador.trim(), cuit: cuitClean, motivo: motivo.trim() || null,
      created_by: user?.id,
    });
    if (error) { avisar(error.message); return; }
    setLibrador(''); setCuit(''); setMotivo('');
    reload();
  }

  async function actualizar(p: ClienteProblema, cambios: Partial<ClienteProblema>) {
    await supabase.from('clientes_problemas').update(cambios).eq('id', p.id);
    reload();
  }

  async function eliminar(p: ClienteProblema) {
    if (!(await confirmar(`Eliminar "${p.librador}" de la lista?`))) return;
    await supabase.from('clientes_problemas').delete().eq('id', p.id);
    reload();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="card p-4">
        <div className="text-sm font-medium mb-3">Agregar a la lista</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted">Librador</label>
            <input className="input" value={librador} onChange={(e) => setLibrador(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">CUIT</label>
            <input className="input" value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="30..." />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={agregar}><Plus size={14}/> Agregar</button>
          </div>
          <div className="sm:col-span-4">
            <label className="text-xs text-muted">Motivo (opcional)</label>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: incumplimiento previo, observado por banco, etc." />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm">{problemas.length} cliente{problemas.length === 1 ? '' : 's'} con problemas</div>
        {problemas.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">Sin registros todavía.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Librador</th>
                <th>CUIT</th>
                <th>Motivo</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {problemas.map((p) => (
                <tr key={p.id} className={!p.activo ? 'opacity-50' : ''}>
                  <td>
                    <input className="input !py-1 text-sm" defaultValue={p.librador}
                      onBlur={(e) => { if (e.target.value && e.target.value !== p.librador) actualizar(p, { librador: e.target.value }); }} />
                  </td>
                  <td className="font-mono text-xs">{p.cuit}</td>
                  <td>
                    <input className="input !py-1 text-sm" defaultValue={p.motivo ?? ''}
                      onBlur={(e) => { if (e.target.value !== (p.motivo ?? '')) actualizar(p, { motivo: e.target.value || null }); }} />
                  </td>
                  <td>
                    <input type="checkbox" checked={p.activo} onChange={(e) => actualizar(p, { activo: e.target.checked })} />
                  </td>
                  <td><button className="text-danger text-xs" onClick={() => eliminar(p)}><Trash2 size={12} className="inline"/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-muted">
        Cuando un cheque tenga el CUIT de alguien de esta lista, en la solapa <b>Cheques</b> va a aparecer la observación <i>"Problemas para negociar"</i> y la fila se resalta.
      </div>
    </div>
  );
}
