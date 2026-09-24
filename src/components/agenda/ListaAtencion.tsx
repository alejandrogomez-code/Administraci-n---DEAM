'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { completarItem, type ItemAgenda } from '@/lib/agenda';
import { sumarDias } from '@/lib/fechas';
import { refrescarResumen } from '@/lib/sesion';
import { avisar } from '@/components/feedback';
import { ChipVencimiento, PuntoTono } from './partes';

type Filtro = 'todo' | 'vencido' | 'hoy' | 'semana';

/** Lista "Requiere atención" del Inicio: pendientes vencidos, de hoy y de la semana, con filtro y botón de completar. */
export default function ListaAtencion({ items: inicial, hoy, max = 12 }: { items: ItemAgenda[]; hoy: string; max?: number }) {
  const router = useRouter();
  const [items, setItems] = useState(inicial);
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const finSemana = sumarDias(hoy, 7);
  useEffect(() => { setItems(inicial); }, [inicial]);

  const grupos = useMemo(() => {
    const vencido = items.filter((i) => i.fecha && i.fecha < hoy);
    const deHoy = items.filter((i) => i.fecha === hoy);
    const semana = items.filter((i) => i.fecha && i.fecha > hoy && i.fecha <= finSemana);
    const sinFecha = items.filter((i) => !i.fecha && i.origen === 'iva');
    return { vencido, hoy: deHoy, semana, todo: [...vencido, ...deHoy, ...sinFecha, ...semana] };
  }, [items, hoy, finSemana]);

  const lista = grupos[filtro];
  const visibles = lista.slice(0, max);

  async function completar(i: ItemAgenda) {
    setOcupado(i.key);
    try {
      await completarItem(createClient(), i);
      setItems((arr) => arr.filter((x) => x.key !== i.key));
      avisar(`Completada: ${i.titulo}`, 'ok');
      refrescarResumen();
      router.refresh();
    } catch (e: any) {
      avisar(`No se pudo completar: ${e?.message ?? e}`, 'error');
    } finally {
      setOcupado(null);
    }
  }

  const tabs: [Filtro, string, number][] = [
    ['todo', 'Todo', grupos.todo.length], ['vencido', 'Vencido', grupos.vencido.length],
    ['hoy', 'Hoy', grupos.hoy.length], ['semana', 'Esta semana', grupos.semana.length],
  ];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <h2 className="text-lg font-bold">Requiere atención</h2>
        <div className="seg overflow-x-auto max-w-full" role="tablist">
          {tabs.map(([id, label, n]) => (
            <button key={id} role="tab" aria-selected={filtro === id} className={filtro === id ? 'on' : 'hover:text-text'} onClick={() => setFiltro(id)}>
              {label} <span className="tabular">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="px-5 py-10 text-center text-muted">
          {filtro === 'todo' ? 'No hay pendientes para esta semana. Todo al día.' : 'Nada en este filtro.'}
        </div>
      ) : (
        <>
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_10.5rem_6rem] gap-3 px-5 py-2.5 bg-surface-2 border-b border-border text-[0.8rem] font-semibold text-muted">
            <span>Pendiente</span><span>Módulo</span><span>Responsable</span><span>Estado</span><span />
          </div>
          <ul>
            {visibles.map((i) => (
              <li key={i.key} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_10.5rem_6rem] items-center gap-x-3 gap-y-1.5 px-5 py-3 border-b border-border/70 last:border-b-0 hover:bg-surface-2">
                <Link href={i.href} className="min-w-0 flex items-start gap-2.5 group">
                  <span className="mt-[0.45rem]"><PuntoTono item={i} hoy={hoy} /></span>
                  <span className="min-w-0">
                    <span className="block font-semibold truncate group-hover:underline underline-offset-2">{i.titulo}</span>
                    <span className="block text-[0.8rem] text-muted truncate">
                      {i.detalle}<span className="md:hidden"> · {i.modulo}{i.responsable ? ` · ${i.responsable}` : ''}</span>
                    </span>
                  </span>
                </Link>
                <span className="hidden md:block text-sm">{i.modulo}</span>
                <span className="hidden md:block text-sm truncate">{i.responsable ?? <span className="text-muted">—</span>}</span>
                <span className="justify-self-end md:justify-self-start row-start-1 col-start-2 md:row-auto md:col-auto"><ChipVencimiento item={i} hoy={hoy} /></span>
                <span className="col-span-2 md:col-span-1 flex justify-end gap-1.5">
                  <Link href={i.href} className="btn-secondary px-3 py-1.5">Abrir</Link>
                  {i.completable && (
                    <button onClick={() => completar(i)} disabled={ocupado === i.key} className="btn-secondary px-2 py-1.5 text-muted hover:text-success" title="Marcar como hecho" aria-label={`Marcar como hecho: ${i.titulo}`}>
                      <Check size={16} />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {lista.length > max && (
            <div className="px-5 py-3 border-t border-border text-sm">
              <Link href="/revision-semanal" className="text-primary font-semibold hover:underline">Ver los {lista.length} pendientes en la revisión semanal</Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
