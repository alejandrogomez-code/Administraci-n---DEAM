import Link from 'next/link';
import { FileText, FolderOpen, Landmark } from 'lucide-react';
import type { DatosInicio } from './datos';
import { fmtFecha, fmtMoney } from '@/lib/format';
import { nombreMesLargo } from '@/lib/fechas';

function Fila({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-t border-dashed border-border first:border-t-0 text-sm">
      <span className="truncate">{label}</span><span className="text-muted tabular whitespace-nowrap">{valor}</span>
    </div>
  );
}

function Tarjeta({ href, titulo, icono: I, children }: { href: string; titulo: string; icono: any; children: React.ReactNode }) {
  return (
    <div className="card px-5 py-4">
      <Link href={href} className="flex items-center gap-2.5 font-bold mb-2 hover:text-primary"><I size={18} className="text-cta" />{titulo}</Link>
      {children}
    </div>
  );
}

const ESTADO: Record<string, string> = { pendiente: 'Sin iniciar', en_proceso: 'En proceso', completado: 'Completada' };

export default function ResumenModulos({ d }: { d: DatosInicio }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Tarjeta href="/contabilidad" titulo="Contabilidad" icono={FileText}>
        <Fila label={d.cierre ? `Cierre ${nombreMesLargo(d.cierre.mes).toLowerCase()}` : 'Cierre del mes'} valor={d.cierre ? `${d.cierre.hechas} de ${d.cierre.total} tareas` : 'Sin cierres'} />
        <Fila label={d.iva ? `IVA ${nombreMesLargo(+d.iva.periodo.slice(5, 7)).toLowerCase()}` : 'Control de IVA'} valor={d.iva ? `${d.iva.pendientes} diferencias` : 'Sin controles'} />
        <Fila label={d.auditoria ? `Auditoría T${d.auditoria.trimestre} ${d.auditoria.anio}` : 'Auditoría'} valor={d.auditoria ? ESTADO[d.auditoria.estado] ?? d.auditoria.estado : 'Sin trimestres'} />
      </Tarjeta>
      <Tarjeta href="/tesoreria" titulo="Tesorería" icono={Landmark}>
        <Fila label="Propuestas en borrador" valor={d.propuestasBorrador} />
        <Fila label={`Cheques disponibles (${d.chequesDisponibles.cantidad})`} valor={fmtMoney(d.chequesDisponibles.importe).replace(/,\d\d$/, '')} />
        <Fila label="Última venta" valor={d.ultimaVenta ? fmtFecha(d.ultimaVenta) : '—'} />
      </Tarjeta>
      <Tarjeta href="/repositorio" titulo="Repositorio" icono={FolderOpen}>
        <Fila label="Pólizas vigentes" valor={d.polizas.vigentes} />
        <Fila label="Vencen en 30 días" valor={d.polizas.vencen30} />
        <Fila label="Documentos" valor={d.documentos} />
      </Tarjeta>
    </div>
  );
}
