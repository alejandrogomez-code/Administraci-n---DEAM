'use client';

import { useMemo } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { EstadoSelect, IconAdjunto } from './Controles';
import { Adjunto, Agrupacion, ESTADOS, Estado, Miembro, Subtarea, Tarea, fmtFechaCorta } from './tipos';

/* =====================================================================
   VISTA TABLA
   ===================================================================== */

export function TablaView({ tareas, miembros, subtareasPorTarea, agrupacion, onEditar, onCambiarEstado }: {
  tareas: Tarea[];
  miembros: Miembro[];
  subtareasPorTarea: Map<string, Subtarea[]>;
  agrupacion: Agrupacion;
  onEditar: (id: string) => void;
  onCambiarEstado: (t: Tarea, e: Estado) => void;
}) {
  // Agrupar
  const grupos = useMemo(() => {
    if (agrupacion === 'ninguna') return [{ key: '', label: '', tareas }];
    if (agrupacion === 'estado') {
      return ESTADOS.map((e) => ({
        key: e.id, label: e.label,
        tareas: tareas.filter((t) => t.estado === e.id),
      })).filter((g) => g.tareas.length > 0);
    }
    // por responsable
    const map = new Map<string, Tarea[]>();
    for (const t of tareas) {
      const k = t.responsable_id ?? '__sin__';
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([k, ts]) => ({
      key: k,
      label: k === '__sin__' ? 'Sin responsable' : (miembros.find((m) => m.id === k)?.nombre ?? '-'),
      tareas: ts,
    }));
  }, [tareas, agrupacion, miembros]);

  if (tareas.length === 0) {
    return <div className="card p-10 text-center text-muted text-sm">Sin tareas con esos filtros.</div>;
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.key} className="card overflow-hidden">
          {g.label && (
            <div className="px-4 py-2 border-b border-border text-xs text-muted font-medium bg-surface-2">
              {g.label} ({g.tareas.length})
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="tbl min-w-[900px]">
              <thead>
                <tr>
                  <th className="w-12">N°</th>
                  <th className="w-24">Creada</th>
                  <th>Tarea</th>
                  <th className="w-40">Estado</th>
                  <th className="w-24">Vence</th>
                  <th className="w-36">Responsable</th>
                  <th className="w-16">URL</th>
                  <th className="w-16">Adjunto</th>
                </tr>
              </thead>
              <tbody>
                {g.tareas.map((t) => {
                  const respNombre = miembros.find((m) => m.id === t.responsable_id)?.nombre;
                  const subs = subtareasPorTarea.get(t.id) ?? [];
                  const subsCompl = subs.filter((s) => s.completa).length;
                  const vencida = t.vencimiento && t.estado !== 'completo' && t.vencimiento < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={t.id} className="cursor-pointer" onClick={() => onEditar(t.id)}>
                      <td className="text-muted text-xs">{t.numero}</td>
                      <td className="text-xs text-muted whitespace-nowrap">{fmtFechaCorta(t.created_at)}</td>
                      <td>
                        <div className="font-medium text-sm">{t.titulo}</div>
                        {subs.length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-24 h-1 bg-surface-2 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${(subsCompl / subs.length) * 100}%` }}/>
                            </div>
                            <span className="text-xs text-muted">{subsCompl}/{subs.length}</span>
                          </div>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <EstadoSelect estado={t.estado} onChange={(e) => onCambiarEstado(t, e)} />
                      </td>
                      <td className={`text-xs whitespace-nowrap ${vencida ? 'text-danger font-medium' : ''}`}>
                        {fmtFechaCorta(t.vencimiento)}
                      </td>
                      <td className="text-sm">{respNombre ?? <span className="text-muted">—</span>}</td>
                      <td>{t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary"><LinkIcon size={14}/></a> : <span className="text-muted text-xs">—</span>}</td>
                      <td><IconAdjunto tareaId={t.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
