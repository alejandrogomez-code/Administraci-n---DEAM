import Link from 'next/link';
import type { DatosInicio } from './datos';
import { fmtMoneyCorto } from '@/lib/format';
import { nombreMesLargo } from '@/lib/fechas';

/** Franja de 5 indicadores. La primera celda (tareas) va resaltada en verde tinta. */
export default function Indicadores({ tareas, vencidas, d }: { tareas: number; vencidas: number; d: DatosInicio }) {
  const pctCierre = d.cierre && d.cierre.total ? Math.round((d.cierre.hechas / d.cierre.total) * 100) : null;
  const mesIva = d.iva ? nombreMesLargo(+d.iva.periodo.slice(5, 7)) : '';

  const celda = 'px-5 py-4 min-w-0 border-border hover:bg-surface-2 transition';
  return (
    <div className="card overflow-hidden grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      <Link href="/tareas" className="px-5 py-4 bg-ink text-ink-fg col-span-2 md:col-span-1 hover:bg-ink-2 transition">
        <div className="text-sm text-ink-muted">Tareas abiertas</div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[1.75rem] font-bold tabular leading-none text-white">{tareas}</span>
          {vencidas > 0 && <span className="text-sm font-semibold text-[#F2A08F]">{vencidas} vencidas</span>}
        </div>
      </Link>
      <Link href={d.cierre ? `/contabilidad/cierres/${d.cierre.id}` : '/contabilidad/cierres'} className={`${celda} border-l`}>
        <div className="text-sm text-muted truncate">{d.cierre ? `Cierre de ${nombreMesLargo(d.cierre.mes).toLowerCase()}` : 'Cierre del mes'}</div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[1.75rem] font-bold tabular leading-none">{pctCierre === null ? '—' : `${pctCierre}%`}</span>
          {d.cierre && <span className="text-sm text-muted tabular">{d.cierre.hechas}/{d.cierre.total}</span>}
        </div>
      </Link>
      <Link href={d.iva ? `/contabilidad/iva/${d.iva.id}` : '/contabilidad/iva'} className={`${celda} border-l md:border-l`}>
        <div className="text-sm text-muted truncate">{d.iva ? `IVA ${mesIva.toLowerCase()}` : 'Control de IVA'}</div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[1.75rem] font-bold tabular leading-none">{d.iva ? d.iva.pendientes : '—'}</span>
          {d.iva && <span className={`text-sm font-semibold ${d.iva.pendientes ? 'text-warning' : 'text-success'}`}>{d.iva.pendientes ? 'por revisar' : 'sin diferencias'}</span>}
        </div>
      </Link>
      <Link href="/tesoreria/venta-cheques" className={`${celda} border-t md:border-t-0 xl:border-l`}>
        <div className="text-sm text-muted truncate">Cheques disponibles</div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[1.75rem] font-bold tabular leading-none whitespace-nowrap">{fmtMoneyCorto(d.chequesDisponibles.importe)}</span>
        </div>
      </Link>
      <Link href="/repositorio/polizas" className={`${celda} border-l border-t xl:border-t-0`}>
        <div className="text-sm text-muted truncate">Pólizas por vencer</div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[1.75rem] font-bold tabular leading-none">{d.polizas.vencen30}</span>
          <span className={`text-sm font-semibold ${d.polizas.vencen30 ? 'text-warning' : 'text-muted'}`}>en 30 días</span>
        </div>
      </Link>
    </div>
  );
}
