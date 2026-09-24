'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { confirmar } from '@/components/feedback';
import { Cheque, Propuesta } from './tipos';

/* ============================================================
   MODALES
   ============================================================ */
export function LimpiarCarteraModal({ cheques, propuestas, onClose, onDone }: {
  cheques: Cheque[];
  propuestas: Propuesta[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponibles = cheques.filter((c) => !c.propuesta_id);
  const asignados = cheques.filter((c) => c.propuesta_id);
  const propuestasAfectadas = new Set(asignados.map((c) => c.propuesta_id)).size;

  async function limpiar(modo: 'disponibles' | 'todos') {
    setBusy(true); setError(null);
    try {
      let query = supabase.from('cheques').delete();
      if (modo === 'disponibles') {
        query = query.is('propuesta_id', null);
      } else {
        query = query.gte('importe', -Infinity);  // matchea todos
      }
      const { error } = await query;
      if (error) throw error;
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Error al limpiar.');
      setBusy(false);
    }
  }

  async function confirmarTodos() {
    if (asignados.length === 0) {
      await limpiar('todos');
      return;
    }
    if (!(await confirmar(`Vas a eliminar ${cheques.length} cheques en total, incluidos ${asignados.length} asignados a ${propuestasAfectadas} propuesta${propuestasAfectadas === 1 ? '' : 's'}.\n\nLas propuestas se mantienen pero quedan sin cheques.\n\n¿Confirmar?`))) return;
    await limpiar('todos');
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-danger">
          <AlertTriangle size={18}/> Limpiar cartera de cheques
        </h3>

        <p className="text-sm text-muted mb-4">
          Vaciar la cartera para arrancar de cero antes de importar una nueva. Esta acción no se puede deshacer.
        </p>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between p-2 bg-surface-2 rounded">
            <span>Cheques disponibles (sin asignar)</span>
            <span className="font-semibold">{disponibles.length}</span>
          </div>
          <div className="flex justify-between p-2 bg-surface-2 rounded">
            <span>Cheques asignados a propuestas</span>
            <span className="font-semibold">{asignados.length}</span>
          </div>
          <div className="flex justify-between p-2 bg-primary/5 rounded">
            <span className="font-medium">Total en la cartera</span>
            <span className="font-semibold">{cheques.length}</span>
          </div>
        </div>

        {error && <div className="text-sm text-danger mb-3">{error}</div>}

        {cheques.length === 0 ? (
          <div className="text-sm text-muted text-center py-4">La cartera ya está vacía.</div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => limpiar('disponibles')}
              disabled={busy || disponibles.length === 0}
              className="btn-secondary w-full justify-start"
            >
              {busy ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>}
              Limpiar sólo disponibles ({disponibles.length})
              <span className="text-xs text-muted ml-auto">Recomendado</span>
            </button>
            <button
              onClick={confirmarTodos}
              disabled={busy}
              className="btn-danger w-full justify-start"
            >
              {busy ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>}
              Limpiar TODA la cartera ({cheques.length})
            </button>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button className="btn-ghost text-sm" disabled={busy} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
