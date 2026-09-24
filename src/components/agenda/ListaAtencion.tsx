'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { completarItem, type ItemAgenda } from '@/lib/agenda';
import { sumarDias, textoVencimiento } from '@/lib/fechas';
import { refrescarResumen } from '@/lib/sesion';
import { avisar } from '@/components/feedback';

type Filtro = 'todo' | 'vencido' | 'hoy' | 'semana';
type Grupo = { id: string; titulo: string; tono: string; punto: string; items: ItemAgenda[] };

/** Lista "Requiere atención" del Inicio, agrupada en Vencido / Hoy / Para revisar / Esta semana. */
export default function ListaAtencion({ items: inicial, hoy, max = 14 }: { items: ItemAgenda[]; hoy: string; max?: number }) {
  const router = useRouter();
  const [items, setItems] = useState(inicial);
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const finSemana = sumarDias(hoy, 7);
  useEffect(() => { setItems(inicial); }, [inicial]);

  const base = useMemo(() => ({
    vencido: items.filter((i) => i.fecha && i.fecha < hoy),
    hoy: items.filter((i) => i.fecha === hoy),
    revisar: items.filter((i) => !i.fecha && i.origen === 'iva'),
    semana: items.filter((i) => i.fecha && i.fecha > hoy && i.fecha <= finSemana),
  }), [items, hoy, finSemana]);

  const grupos: Grupo[] = useMemo(() => {
    const todos: Grupo[] = [
      { id: 'vencido', titulo: 'Vencido', tono: 'text-danger', punto: 'bg-danger/60', items: base.vencido },
      { id: 'hoy', titulo: 'Hoy', tono: 'text-primary', punto: 'bg-primary/60', items: base.hoy },
      { id: 'revisar', titulo: 'Para revisar', tono: 'text-warning', punto: 'bg-warning/60', items: base.revisar },
      { id: 'semana', titulo: 'Esta semana', tono: 'text-muted', punto: 'bg-muted/50', items: base.semana },
    ];
    const visibles = filtro === 'todo' ? todos : todos.filter((g) => g.id === filtro);
    // recortar al máximo total, respetando el orden de los grupos
    let resto = max;
    return visibles.map((g) => { const it = g.items.slice(0, Math.max(0, resto)); resto -= it.length; return { ...g, items: it }; }).filter((g) => g.items.length);
  }, [base, filtro, max]);

  const total = filtro === 'todo' ? base.vencido.length + base.hoy.length + base.revisar.length + base.semana.length : base[filtro].length;
  const mostrados = grupos.reduce((n, g) => n + g.items.length, 0);

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
    ['todo', 'Todo', base.vencido.length + base.hoy.length + base.revisar.length + base.semana.length],
    ['vencido', 'Vencido', base.vencido.length], ['hoy', 'Hoy', base.hoy.length], ['semana', 'Esta semana', base.semana.length],
  ];

  function cuando(i: ItemAgenda) {
    if (i.origen === 'iva') return { texto: `${i.cantidad} por revisar`, cls: 'text-warning' };
    const v = textoVencimiento(i.fecha, hoy);
    const texto = i.origen === 'poliza' ? v.texto.replace('Vencida', 'Venció') : v.texto;
    const cls = v.tono === 'vencido' ? 'text-danger' : v.tono === 'hoy' ? 'text-primary' : v.tono === 'pronto' ? 'text-warning' : 'text-muted';
    return { texto, cls };
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
        <h2 className="text-[1.05rem] font-semibold">Requiere atención</h2>
        <div className="seg overflow-x-auto max-w-full" role="tablist">
          {tabs.map(([id, label, n]) => (
            <button key={id} role="tab" aria-selected={filtro === id} className={filtro === id ? 'on' : 'hover:text-text'} onClick={() => setFiltro(id)}>
              {label} <span className="tabular">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="px-5 py-10 text-center text-muted">
          {filtro === 'todo' ? 'No hay pendientes para esta semana. Todo al día.' : 'Nada en este filtro.'}
        </div>
      ) : grupos.map((g, gi) => (
        <div key={g.id} className={gi ? 'border-t border-border' : ''}>
          <div className={`px-5 pt-3 pb-1 text-[0.8rem] font-semibold ${g.tono}`}>
            {g.titulo} <span className="font-medium text-muted tabular ml-1">{base[g.id as keyof typeof base].length}</span>
          </div>
          <ul>
            {g.items.map((i) => {
              const c = cuando(i);
              const meta = [i.modulo, i.detalle, i.responsable].filter(Boolean).join(' · ');
              return (
                <li key={i.key} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3.5 gap-y-1.5 px-5 py-2.5 border-t border-border/50 first:border-t-0 hover:bg-surface-2/70">
                  <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${g.punto}`} aria-hidden />
                  <Link href={i.href} className="min-w-0 flex-1 group">
                    <span className="block font-medium truncate group-hover:underline underline-offset-2">{i.titulo}</span>
                    <span className="block text-[0.8rem] text-muted truncate">{meta}</span>
                  </Link>
                  <span className={`text-[0.85rem] whitespace-nowrap ml-[1.3rem] sm:ml-0 ${c.cls}`}>{c.texto}</span>
                  <span className="flex gap-1.5 ml-auto">
                    <Link href={i.href} className="btn-secondary px-2.5 py-1 text-[0.85rem]">Abrir</Link>
                    {i.completable ? (
                      <button onClick={() => completar(i)} disabled={ocupado === i.key} className="btn-secondary px-1.5 py-1 text-muted hover:text-success" title="Marcar como hecho" aria-label={`Marcar como hecho: ${i.titulo}`}>
                        <Check size={15} />
                      </button>
                    ) : <span className="w-[2.1rem] hidden sm:block" aria-hidden />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {total > mostrados && (
        <div className="px-5 py-3 border-t border-border text-sm">
          <Link href="/revision-semanal" className="text-primary font-medium hover:underline">Ver los {total} pendientes en la revisión semanal</Link>
        </div>
      )}
    </section>
  );
}
