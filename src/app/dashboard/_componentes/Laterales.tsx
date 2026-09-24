import Link from 'next/link';
import type { ItemAgenda } from '@/lib/agenda';
import { BloqueFecha } from '@/components/agenda/partes';

export function ProximasFechas({ items }: { items: ItemAgenda[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-[1.05rem] font-semibold">Próximas fechas</h2>
        <Link href="/calendario" className="text-sm font-semibold text-primary hover:underline">Calendario</Link>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-muted">No hay fechas en los próximos 30 días.</p>
      ) : (
        <ul className="py-1.5">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                <BloqueFecha fecha={i.fecha!} />
                <span className="min-w-0">
                  <span className="block font-semibold text-[0.95rem] truncate">{i.titulo}</span>
                  <span className="block text-[0.8rem] text-muted truncate">{i.modulo}{i.responsable ? ` · ${i.responsable}` : ''}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const COLOR: Record<string, string> = {
  primary: 'bg-primary', accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', muted: 'bg-muted',
};

export function Accesos({ accesos }: { accesos: { id: string; titulo: string; url: string; color: string | null }[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-[1.05rem] font-semibold">Accesos directos</h2>
        <Link href="/configuracion/accesos-directos" className="btn-secondary px-3 py-1.5">Editar</Link>
      </div>
      {accesos.length === 0 ? (
        <p className="px-5 py-6 text-muted">Todavía no hay accesos. Agregalos desde Editar.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 p-4">
          {accesos.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2.5 text-sm font-medium hover:bg-surface-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-[3px] shrink-0 ${COLOR[a.color ?? 'primary'] ?? 'bg-primary'}`} />
              <span className="truncate">{a.titulo}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
