import { CalendarClock, ClipboardCheck, FileText, Landmark, ShieldCheck, SquareCheckBig, Wallet } from 'lucide-react';
import type { ItemAgenda, Origen } from '@/lib/agenda';
import { textoVencimiento } from '@/lib/fechas';
import { MESES_ABR } from '@/lib/fechas';

export const ICONO_ORIGEN: Record<Origen, any> = {
  tarea: SquareCheckBig, cierre: FileText, auditoria: ClipboardCheck, iva: Wallet, poliza: ShieldCheck, propuesta: Landmark,
};

const TONO_CHIP = { vencido: 'chip-vencido', hoy: 'chip-hoy', pronto: 'chip-pendiente', futuro: 'chip-neutro', sin: 'chip-neutro' } as const;
const TONO_PUNTO = { vencido: 'bg-danger', hoy: 'bg-primary', pronto: 'bg-warning', futuro: 'bg-muted', sin: 'bg-muted' } as const;

export function tonoItem(i: ItemAgenda, hoy: string) {
  if (i.origen === 'iva') return 'pronto' as const;
  return textoVencimiento(i.fecha, hoy).tono;
}

export function ChipVencimiento({ item, hoy }: { item: ItemAgenda; hoy: string }) {
  if (item.origen === 'iva') return <span className="chip-pendiente">{item.cantidad} por revisar</span>;
  const v = textoVencimiento(item.fecha, hoy);
  const texto = item.origen === 'poliza' ? v.texto.replace('Vencida', 'Venció') : v.texto;
  return <span className={TONO_CHIP[v.tono]}>{texto}</span>;
}

export function PuntoTono({ item, hoy }: { item: ItemAgenda; hoy: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${TONO_PUNTO[tonoItem(item, hoy)]}`} aria-hidden />;
}

export function IconoItem({ item, hoy, size = 18 }: { item: ItemAgenda; hoy: string; size?: number }) {
  const I = ICONO_ORIGEN[item.origen] ?? CalendarClock;
  const t = tonoItem(item, hoy);
  const cls = t === 'vencido' ? 'bg-danger/10 text-danger' : t === 'pronto' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary';
  return <div className={`w-9 h-9 rounded-[10px] grid place-items-center shrink-0 ${cls}`}><I size={size} /></div>;
}

export function BloqueFecha({ fecha }: { fecha: string }) {
  return (
    <div className="w-11 shrink-0 text-center rounded-[10px] border border-border py-1 leading-none">
      <div className="text-[1.05rem] font-semibold tabular">{+fecha.slice(8, 10)}</div>
      <div className="text-[0.62rem] font-semibold text-muted mt-0.5">{MESES_ABR[+fecha.slice(5, 7) - 1]}</div>
    </div>
  );
}
