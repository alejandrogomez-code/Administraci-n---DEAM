import Link from 'next/link';
import type { DatosInicio } from './datos';
import { fmtMoneyCorto } from '@/lib/format';
import { nombreMesLargo } from '@/lib/fechas';

function Tarjeta({ href, label, valor, nota, tono, avance }: {
  href: string; label: string; valor: React.ReactNode; nota?: string; tono?: 'danger' | 'warning' | 'success' | 'muted'; avance?: number | null;
}) {
  const color = { danger: 'text-danger', warning: 'text-warning', success: 'text-success', muted: 'text-muted' }[tono ?? 'muted'];
  return (
    <Link href={href} className="card px-4 py-3.5 hover:border-primary/30 hover:shadow-card transition min-w-0">
      <div className="text-[0.85rem] text-muted truncate">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1.5 min-w-0">
        <span className="text-[1.45rem] font-semibold tabular leading-none whitespace-nowrap">{valor}</span>
        {nota && <span className={`text-[0.8rem] truncate ${color}`}>{nota}</span>}
      </div>
      {avance !== undefined && avance !== null && (
        <div className="h-1 rounded-full bg-border/80 mt-3 overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, avance))}%` }} />
        </div>
      )}
    </Link>
  );
}

/** Cinco indicadores en tarjetas separadas. */
export default function Indicadores({ tareas, vencidas, d }: { tareas: number; vencidas: number; d: DatosInicio }) {
  const pctCierre = d.cierre && d.cierre.total ? Math.round((d.cierre.hechas / d.cierre.total) * 100) : null;
  const mesIva = d.iva ? nombreMesLargo(+d.iva.periodo.slice(5, 7)).toLowerCase() : '';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <Tarjeta href="/tareas" label="Tareas abiertas" valor={tareas} nota={vencidas ? `${vencidas} vencidas` : 'al día'} tono={vencidas ? 'danger' : 'success'} />
      <Tarjeta
        href={d.cierre ? `/contabilidad/cierres/${d.cierre.id}` : '/contabilidad/cierres'}
        label={d.cierre ? `Cierre de ${nombreMesLargo(d.cierre.mes).toLowerCase()}` : 'Cierre del mes'}
        valor={pctCierre === null ? '—' : `${pctCierre}%`}
        nota={d.cierre ? `${d.cierre.hechas} de ${d.cierre.total}` : undefined}
        avance={pctCierre}
      />
      <Tarjeta
        href={d.iva ? `/contabilidad/iva/${d.iva.id}` : '/contabilidad/iva'}
        label={d.iva ? `IVA ${mesIva}` : 'Control de IVA'}
        valor={d.iva ? d.iva.pendientes : '—'}
        nota={d.iva ? (d.iva.pendientes ? 'por revisar' : 'sin diferencias') : undefined}
        tono={d.iva?.pendientes ? 'warning' : 'success'}
      />
      <Tarjeta href="/tesoreria/venta-cheques" label="Cheques disponibles" valor={fmtMoneyCorto(d.chequesDisponibles.importe)} />
      <Tarjeta href="/repositorio/polizas" label="Pólizas por vencer" valor={d.polizas.vencen30} nota="en 30 días" tono={d.polizas.vencen30 ? 'warning' : 'muted'} />
    </div>
  );
}
