'use client';

import { fmtFecha } from '@/lib/format';
import { DIAS_AVISO, Documento, Estado, Jurisdiccion, diffDias, hoy0, parseISODate } from './utils';

export function EstadoChip({ estado }: { estado: Estado }) {
  if (estado === 'vigente')
    return <span className="chip bg-success/15 text-success">Vigente</span>;
  if (estado === 'vencido')
    return <span className="chip bg-danger/15 text-danger">Vencido</span>;
  return <span className="chip bg-surface-2 text-muted">Sin documento</span>;
}

// Limpia el nombre para usarlo como clave en Supabase Storage
// (no admite acentos ni varios símbolos). Mantené file.name aparte para mostrar.
export function Vencimientos({
  vencidos, proximos, jurById, onIr,
}: {
  vencidos: Documento[];
  proximos: Documento[];
  jurById: Record<string, Jurisdiccion>;
  onIr: (d: Documento) => void;
}) {
  const hoy = hoy0();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-muted">Vencidos</div>
          <div className="text-2xl font-semibold text-danger">{vencidos.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Próximos a vencer ({DIAS_AVISO} días)</div>
          <div className="text-2xl font-semibold text-warning">{proximos.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Jurisdicciones</div>
          <div className="text-2xl font-semibold">{Object.keys(jurById).length}</div>
        </div>
      </div>

      {vencidos.length === 0 && proximos.length === 0 ? (
        <div className="card p-10 text-center text-muted text-sm">
          No hay documentos vencidos ni próximos a vencer. Todo en orden. ✅
        </div>
      ) : (
        <div className="card overflow-hidden">
          <Grupo titulo="Vencidos" color="danger" />
          {vencidos.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted">Sin documentos vencidos.</div>
          ) : (
            <TablaVenc filas={vencidos} jurById={jurById} hoy={hoy} tipo="vencido" onIr={onIr} />
          )}

          <Grupo titulo={`Próximos a vencer (${DIAS_AVISO} días)`} color="warning" />
          {proximos.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted">Sin documentos próximos a vencer.</div>
          ) : (
            <TablaVenc filas={proximos} jurById={jurById} hoy={hoy} tipo="proximo" onIr={onIr} />
          )}
        </div>
      )}
    </div>
  );
}

export function Grupo({ titulo, color }: { titulo: string; color: 'danger' | 'warning' }) {
  return (
    <div className="px-4 py-2.5 border-y border-border flex items-center gap-2 bg-surface-2">
      <span className={`w-2 h-2 rounded-full ${color === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
      <span className={`text-sm font-medium ${color === 'danger' ? 'text-danger' : 'text-warning'}`}>{titulo}</span>
    </div>
  );
}

export function TablaVenc({
  filas, jurById, hoy, tipo, onIr,
}: {
  filas: Documento[];
  jurById: Record<string, Jurisdiccion>;
  hoy: Date;
  tipo: 'vencido' | 'proximo';
  onIr: (d: Documento) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[640px]">
        <thead>
          <tr>
            <th>Jurisdicción</th>
            <th>Documento</th>
            <th>Vencimiento</th>
            <th>{tipo === 'vencido' ? 'Vencido' : 'Vence'}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((d) => {
            const f = parseISODate(d.vencimiento!);
            const dias = Math.abs(diffDias(f, hoy));
            return (
              <tr key={d.id}>
                <td>
                  <span className="chip bg-surface-2 text-text">{jurById[d.jurisdiccion_id]?.nombre ?? '—'}</span>
                </td>
                <td className="text-sm">{d.documento}</td>
                <td className="text-sm whitespace-nowrap">{fmtFecha(d.vencimiento)}</td>
                <td>
                  {tipo === 'vencido'
                    ? <span className="chip bg-danger/15 text-danger">Hace {dias} día{dias === 1 ? '' : 's'}</span>
                    : <span className="chip bg-warning/15 text-warning">En {dias} día{dias === 1 ? '' : 's'}</span>}
                </td>
                <td className="text-xs whitespace-nowrap">
                  <button className="text-primary hover:underline" onClick={() => onIr(d)}>Ver</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===================== Modal documento =====================
