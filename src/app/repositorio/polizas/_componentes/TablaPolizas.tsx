'use client';

import { Archive, ExternalLink, FileText, RotateCcw, Trash2 } from 'lucide-react';
import { fmtFecha, fmtMoney } from '@/lib/format';
import { ADJUNTOS, Estado, Jurisdiccion, Poliza, diffDias, estadoDe, parseISODate } from './utils';

export function EstadoChip({ estado }: { estado: Estado }) {
  if (estado === 'vigente')
    return <span className="chip bg-success/15 text-success">Vigente</span>;
  if (estado === 'vencido')
    return <span className="chip bg-danger/15 text-danger">Vencida</span>;
  return <span className="chip bg-surface-2 text-muted">Sin vencimiento</span>;
}

// Definición de los tres adjuntos de una póliza (para reutilizar en modal/tabla)
export function GrupoRow({ titulo, color }: { titulo: string; color: 'danger' | 'warning' }) {
  return (
    <tr className="bg-surface-2">
      <td colSpan={5} className="!py-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
          <span className={`text-sm font-medium ${color === 'danger' ? 'text-danger' : 'text-warning'}`}>{titulo}</span>
        </div>
      </td>
    </tr>
  );
}

export function VacioRow({ msg }: { msg: string }) {
  return (
    <tr>
      <td colSpan={5} className="text-xs text-muted">{msg}</td>
    </tr>
  );
}

export function FilaAlerta({
  p, campo, jurById, hoy, onIr,
}: {
  p: Poliza;
  campo: 'vencimiento' | 'aviso_baja';
  jurById: Record<string, Jurisdiccion>;
  hoy: Date;
  onIr: (p: Poliza) => void;
}) {
  const iso = p[campo]!;
  const f = parseISODate(iso);
  const dias = diffDias(f, hoy); // negativo = ya pasó
  const pasado = dias < 0;
  const abs = Math.abs(dias);
  return (
    <tr>
      <td className="text-sm font-medium">{p.empresa}</td>
      <td><span className="chip bg-surface-2 text-text">{jurById[p.jurisdiccion_id]?.nombre ?? '—'}</span></td>
      <td className="text-sm whitespace-nowrap">{fmtFecha(iso)}</td>
      <td>
        {pasado
          ? <span className="chip bg-danger/15 text-danger">Hace {abs} día{abs === 1 ? '' : 's'}</span>
          : dias === 0
            ? <span className="chip bg-warning/15 text-warning">Hoy</span>
            : <span className="chip bg-warning/15 text-warning">En {abs} día{abs === 1 ? '' : 's'}</span>}
      </td>
      <td className="text-xs whitespace-nowrap text-right">
        <button className="text-primary hover:underline" onClick={() => onIr(p)}>Ver / editar</button>
      </td>
    </tr>
  );
}

// ===================== Tabla de pólizas (vigentes / finalizadas) =====================
export function TablaPolizas({
  titulo, variante, filas, totalSinFiltro, jurById, onEdit, onToggle, onEliminar, descargar, onNueva,
}: {
  titulo: string;
  variante: 'vigentes' | 'finalizadas';
  filas: Poliza[];
  totalSinFiltro: number;
  jurById: Record<string, Jurisdiccion>;
  onEdit: (p: Poliza) => void;
  onToggle: (p: Poliza) => void;
  onEliminar: (p: Poliza) => void;
  descargar: (url: string | null, nombre: string | null) => void;
  onNueva?: () => void;
}) {
  const esFinal = variante === 'finalizadas';
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{titulo}</div>
        <span className="text-xs text-muted">{filas.length} de {totalSinFiltro}</span>
      </div>

      {filas.length === 0 ? (
        <div className="p-8 text-center text-muted text-sm">
          {totalSinFiltro === 0
            ? (esFinal
                ? 'No hay pólizas cerradas todavía.'
                : <>No hay pólizas vigentes. {onNueva && <button className="text-primary" onClick={onNueva}>Agregar la primera</button>}.</>)
            : 'Sin resultados para esos filtros.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl min-w-[1180px]">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Jurisdicción</th>
                <th>Alta</th>
                <th className="!text-right">Monto asegurado</th>
                <th>Vencimiento</th>
                <th>Revisión</th>
                <th>Aviso baja</th>
                <th>Link baja</th>
                <th>Estado</th>
                <th>Adjuntos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} className={esFinal ? 'opacity-70' : ''}>
                  <td className="font-medium text-sm">{p.empresa}</td>
                  <td><span className="chip bg-surface-2 text-text">{jurById[p.jurisdiccion_id]?.nombre ?? '—'}</span></td>
                  <td className="text-sm whitespace-nowrap">{p.fecha_alta ? fmtFecha(p.fecha_alta) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm text-right whitespace-nowrap">{p.monto_asegurado != null ? fmtMoney(p.monto_asegurado) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm whitespace-nowrap">{p.vencimiento ? fmtFecha(p.vencimiento) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm whitespace-nowrap">{p.fecha_revision ? fmtFecha(p.fecha_revision) : <span className="text-muted">—</span>}</td>
                  <td className="text-sm whitespace-nowrap">{p.aviso_baja ? fmtFecha(p.aviso_baja) : <span className="text-muted">—</span>}</td>
                  <td>
                    {p.baja_link ? (
                      <a href={p.baja_link} target="_blank" rel="noopener noreferrer" className="text-primary text-sm inline-flex items-center gap-1 hover:underline">
                        <ExternalLink size={13} /> Abrir
                      </a>
                    ) : <span className="text-xs text-muted">—</span>}
                  </td>
                  <td>
                    {esFinal
                      ? <span className="chip bg-surface-2 text-muted">Finalizada</span>
                      : <EstadoChip estado={estadoDe(p)} />}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {ADJUNTOS.map(({ key, urlKey, nomKey, label }) => {
                        const url = p[urlKey] as string | null;
                        return url ? (
                          <button key={key} onClick={() => descargar(url, p[nomKey] as string | null)}
                            className="text-primary text-xs inline-flex items-center gap-1 hover:underline" title={`Descargar ${label}`}>
                            <FileText size={13} /> {label}
                          </button>
                        ) : (
                          <span key={key} className="text-xs text-muted inline-flex items-center gap-1" title={`Sin ${label}`}>
                            <FileText size={13} className="opacity-40" /> {label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-3 text-xs items-center">
                      <button className="text-primary" onClick={() => onEdit(p)}>Editar</button>
                      {esFinal ? (
                        <button className="text-primary inline-flex items-center gap-1" onClick={() => onToggle(p)} title="Reabrir">
                          <RotateCcw size={12} /> Reabrir
                        </button>
                      ) : (
                        <button className="text-muted hover:text-text inline-flex items-center gap-1" onClick={() => onToggle(p)} title="Cerrar / finalizar">
                          <Archive size={12} /> Cerrar
                        </button>
                      )}
                      <button className="text-danger" onClick={() => onEliminar(p)}><Trash2 size={12} className="inline" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== Modal póliza =====================
