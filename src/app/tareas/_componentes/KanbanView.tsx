'use client';

import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { ESTADOS, Estado, Miembro, Subtarea, Tarea, fmtFechaCorta, iniciales } from './tipos';

/* =====================================================================
   VISTA KANBAN (con drag & drop nativo)
   ===================================================================== */

export function KanbanView({ tareas, miembros, subtareasPorTarea, onEditar, onCambiarEstado }: {
  tareas: Tarea[];
  miembros: Miembro[];
  subtareasPorTarea: Map<string, Subtarea[]>;
  onEditar: (id: string) => void;
  onCambiarEstado: (t: Tarea, e: Estado) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Estado | null>(null);

  function onDrop(e: React.DragEvent, estado: Estado) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setOverCol(null);
    setDraggingId(null);
    if (!id) return;
    const t = tareas.find((x) => x.id === id);
    if (!t || t.estado === estado) return;
    onCambiarEstado(t, estado);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-2">
        {ESTADOS.map((e) => {
          const ts = tareas.filter((t) => t.estado === e.id);
          return (
            <div key={e.id}
              onDragOver={(ev) => { ev.preventDefault(); setOverCol(e.id); }}
              onDragLeave={() => setOverCol((c) => c === e.id ? null : c)}
              onDrop={(ev) => onDrop(ev, e.id)}
              className={`w-72 shrink-0 rounded border ${overCol === e.id ? 'border-primary bg-primary/5' : 'border-border bg-surface-2/50'} transition`}
            >
              <div className={`px-3 py-2 rounded-t ${e.bg} flex items-center justify-between`}>
                <span className={`font-medium text-sm ${e.color}`}>{e.label}</span>
                <span className="text-xs text-muted">{ts.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-64">
                {ts.length === 0 ? (
                  <div className="text-xs text-muted text-center py-4">Sin tareas</div>
                ) : ts.map((t) => {
                  const respNombre = miembros.find((m) => m.id === t.responsable_id)?.nombre;
                  const subs = subtareasPorTarea.get(t.id) ?? [];
                  const subsCompl = subs.filter((s) => s.completa).length;
                  const vencida = t.vencimiento && t.estado !== 'completo' && t.vencimiento < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={t.id}
                      draggable
                      onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', t.id); setDraggingId(t.id); }}
                      onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                      onClick={() => onEditar(t.id)}
                      className={`card p-3 cursor-pointer hover:shadow-card ${draggingId === t.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-1">
                        <span className="text-xs text-muted">#{t.numero}</span>
                        <div className="font-medium text-sm flex-1">{t.titulo}</div>
                      </div>
                      {subs.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Check size={12} className="text-muted"/>
                          <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(subsCompl / subs.length) * 100}%` }}/>
                          </div>
                          <span className="text-xs text-muted">{subsCompl}/{subs.length}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs">
                        {t.vencimiento ? (
                          <span className={`inline-flex items-center gap-1 ${vencida ? 'text-danger font-medium' : 'text-muted'}`}>
                            <Calendar size={12}/> {fmtFechaCorta(t.vencimiento)}
                          </span>
                        ) : <span/>}
                        {respNombre && (
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-fg flex items-center justify-center text-xs font-bold" title={respNombre}>
                            {iniciales(respNombre)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
