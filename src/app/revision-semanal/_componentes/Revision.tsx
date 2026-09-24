'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { completarItem, reprogramarItem, type ItemAgenda } from '@/lib/agenda';
import { diaSemana, fechaLarga, sumarDias } from '@/lib/fechas';
import { fmtFecha } from '@/lib/format';
import { refrescarResumen } from '@/lib/sesion';
import { avisar } from '@/components/feedback';
import { ChipVencimiento, IconoItem } from '@/components/agenda/partes';

export type Hecho = { key: string; titulo: string; modulo: string; fecha: string };

export default function Revision({ items: inicial, hechos, hoy }: { items: ItemAgenda[]; hechos: Hecho[]; hoy: string }) {
  const router = useRouter();
  const [items, setItems] = useState(inicial);
  const [ultima, setUltima] = useState<string | null>(null);
  useEffect(() => { setItems(inicial); }, [inicial]);
  useEffect(() => { try { setUltima(localStorage.getItem('deam.revision.ultima')); } catch {} }, []);

  const en7 = sumarDias(hoy, 7);
  const vencidos = useMemo(() => items.filter((i) => i.fecha && i.fecha < hoy), [items, hoy]);
  const semana = useMemo(() => items.filter((i) => i.fecha && i.fecha >= hoy && i.fecha <= en7), [items, hoy, en7]);
  const sinFecha = useMemo(() => items.filter((i) => !i.fecha && i.completable), [items]);
  const ivaPend = useMemo(() => items.filter((i) => i.origen === 'iva'), [items]);

  function quitar(i: ItemAgenda) { setItems((arr) => arr.filter((x) => x.key !== i.key)); }
  function despues() { refrescarResumen(); router.refresh(); }

  async function completar(i: ItemAgenda) {
    try {
      await completarItem(createClient(), i);
      quitar(i); avisar(`Completada: ${i.titulo}`, 'ok'); despues();
    } catch (e: any) { avisar(`No se pudo completar: ${e?.message ?? e}`, 'error'); }
  }

  async function reprogramar(i: ItemAgenda, fecha: string) {
    const r = await reprogramarItem(createClient(), i, fecha);
    if ((r as any)?.error) { avisar(`No se pudo reprogramar: ${(r as any).error.message}`, 'error'); return; }
    setItems((arr) => arr.map((x) => (x.key === i.key ? { ...x, fecha } : x)));
    avisar(`Reprogramada para el ${fmtFecha(fecha)}`, 'ok'); despues();
  }

  function terminar() {
    try { localStorage.setItem('deam.revision.ultima', hoy); } catch {}
    setUltima(hoy);
    avisar('Revisión semanal terminada. ¡Buena semana!', 'ok');
  }

  const kpi = (label: string, n: number, cls = '') => (
    <div className="kpi"><div className="kpi-label">{label}</div><div className={`kpi-value ${cls}`}>{n}</div></div>
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi('Hechas en los últimos 7 días', hechos.length, 'text-success')}
        {kpi('Vencidas', vencidos.length, vencidos.length ? 'text-danger' : '')}
        {kpi('Para esta semana', semana.length)}
        {kpi('Tareas sin fecha', sinFecha.length, sinFecha.length ? 'text-warning' : '')}
      </div>

      <Seccion titulo="1. Ponete al día con lo vencido" vacio="No hay nada vencido." n={vencidos.length}>
        {vencidos.map((i) => <Fila key={i.key} i={i} hoy={hoy} onCompletar={completar} onReprogramar={reprogramar} />)}
      </Seccion>

      {ivaPend.length > 0 && (
        <Seccion titulo="2. Diferencias de IVA sin resolver" n={ivaPend.length}>
          {ivaPend.map((i) => <Fila key={i.key} i={i} hoy={hoy} />)}
        </Seccion>
      )}

      <Seccion titulo={`${ivaPend.length ? 3 : 2}. Lo que viene en los próximos 7 días`} vacio="No hay vencimientos en los próximos 7 días." n={semana.length}>
        {semana.map((i) => <Fila key={i.key} i={i} hoy={hoy} onCompletar={completar} onReprogramar={reprogramar} />)}
      </Seccion>

      <Seccion titulo={`${ivaPend.length ? 4 : 3}. Poné fecha a lo que no tiene`} vacio="Todas las tareas tienen fecha." n={sinFecha.length}>
        {sinFecha.map((i) => <Fila key={i.key} i={i} hoy={hoy} onCompletar={completar} onReprogramar={reprogramar} />)}
      </Seccion>

      <Seccion titulo="Hecho en los últimos 7 días" vacio="Todavía no se completó nada esta semana." n={hechos.length}>
        {hechos.map((h) => (
          <li key={h.key} className="flex items-center gap-3 px-5 py-2.5">
            <CheckCircle2 size={18} className="text-success shrink-0" />
            <span className="min-w-0 flex-1 truncate">{h.titulo}</span>
            <span className="text-sm text-muted whitespace-nowrap">{h.modulo} · {fmtFecha(h.fecha).slice(0, 5)}</span>
          </li>
        ))}
      </Seccion>

      <div className="card px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm">{ultima ? `Última revisión: ${fechaLarga(ultima)}.` : 'Todavía no registraste ninguna revisión en este equipo.'}</p>
        <button className="btn-primary" onClick={terminar}><Check size={16} />Terminar revisión</button>
      </div>
    </div>
  );
}

function Seccion({ titulo, n, vacio, children }: { titulo: string; n: number; vacio?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="px-5 py-3.5 border-b border-border font-semibold flex items-center gap-2">{titulo}<span className="chip-neutro">{n}</span></h2>
      {n === 0 ? <p className="px-5 py-5 text-muted text-sm">{vacio}</p> : <ul className="divide-y divide-border/70">{children}</ul>}
    </section>
  );
}

function proximoLunes(hoy: string) {
  const d = diaSemana(hoy);
  return sumarDias(hoy, ((8 - d) % 7) || 7);
}

function Fila({ i, hoy, onCompletar, onReprogramar }: {
  i: ItemAgenda; hoy: string;
  onCompletar?: (i: ItemAgenda) => void; onReprogramar?: (i: ItemAgenda, f: string) => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const acciones = i.completable && onCompletar && onReprogramar;

  async function correr(fn: () => Promise<void> | void) { setOcupado(true); try { await fn(); } finally { setOcupado(false); } }

  function elegir(v: string) {
    if (!v) return;
    if (v === 'otra') { setEligiendo(true); return; }
    correr(() => onReprogramar!(i, v));
  }

  return (
    <li className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 px-5 py-3">
      <IconoItem item={i} hoy={hoy} />
      <Link href={i.href} className="min-w-0 flex-1 group">
        <span className="block font-semibold truncate group-hover:underline underline-offset-2">{i.titulo}</span>
        <span className="block text-[0.8rem] text-muted truncate">{i.modulo} · {i.detalle}{i.responsable ? ` · ${i.responsable}` : ''}</span>
      </Link>
      <ChipVencimiento item={i} hoy={hoy} />
      {acciones ? (
        <div className="flex items-center gap-1.5 ml-auto">
          {eligiendo ? (
            <input type="date" className="input py-1.5 w-40" min={hoy} autoFocus onChange={(e) => e.target.value && correr(() => onReprogramar!(i, e.target.value))} onBlur={() => setEligiendo(false)} aria-label="Nueva fecha" />
          ) : (
            <select className="input py-1.5 w-40 cursor-pointer" value="" onChange={(e) => elegir(e.target.value)} disabled={ocupado} aria-label="Reprogramar">
              <option value="">{i.fecha ? 'Reprogramar…' : 'Poner fecha…'}</option>
              <option value={hoy}>Hoy</option>
              <option value={sumarDias(hoy, 1)}>Mañana</option>
              <option value={proximoLunes(hoy)}>El próximo lunes</option>
              <option value={sumarDias(i.fecha && i.fecha > hoy ? i.fecha : hoy, 7)}>En una semana</option>
              <option value="otra">Elegir fecha…</option>
            </select>
          )}
          <button className="btn-secondary px-2.5 py-1.5 hover:text-success" onClick={() => correr(() => onCompletar!(i))} disabled={ocupado} title="Marcar como hecho" aria-label={`Marcar como hecho: ${i.titulo}`}>
            <Check size={16} />
          </button>
        </div>
      ) : (
        <Link href={i.href} className="btn-secondary px-3 py-1.5 ml-auto">Abrir</Link>
      )}
    </li>
  );
}
