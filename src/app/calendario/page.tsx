import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/server';
import { cargarAgenda, type ItemAgenda } from '@/lib/agenda';
import { diasEntre, diaSemana, hoyISO, nombreMesLargo, sumarDias } from '@/lib/fechas';
import { PuntoTono, ChipVencimiento, IconoItem } from '@/components/agenda/partes';

export const dynamic = 'force-dynamic';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_POR_DIA = 3;

function parseMes(v: string | undefined, hoy: string) {
  const m = v?.match(/^(\d{4})-(\d{2})$/);
  return m ? { anio: +m[1], mes: +m[2] } : { anio: +hoy.slice(0, 4), mes: +hoy.slice(5, 7) };
}
const iso = (a: number, m: number, d = 1) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const mesRel = (a: number, m: number, delta: number) => { const t = a * 12 + (m - 1) + delta; return iso(Math.floor(t / 12), (t % 12) + 1).slice(0, 7); };

export default async function CalendarioPage({ searchParams }: { searchParams: { mes?: string } }) {
  const hoy = hoyISO();
  const { anio, mes } = parseMes(searchParams.mes, hoy);
  const primero = iso(anio, mes);
  const ultimo = sumarDias(`${mesRel(anio, mes, 1)}-01`, -1);
  const horizonte = Math.max(45, diasEntre(hoy, ultimo));
  const agenda = await cargarAgenda(createClient(), { horizontePolizas: horizonte });

  const delMes = agenda.filter((i) => i.fecha && i.fecha >= primero && i.fecha <= ultimo);
  const porDia = new Map<string, ItemAgenda[]>();
  for (const i of delMes) porDia.set(i.fecha!, [...(porDia.get(i.fecha!) ?? []), i]);
  const vencidosAntes = agenda.filter((i) => i.fecha && i.fecha < primero && i.fecha < hoy).length;

  // Grilla de lunes a domingo
  const offset = (diaSemana(primero) + 6) % 7;
  const inicio = sumarDias(primero, -offset);
  const semanas = Math.ceil((offset + diasEntre(primero, ultimo) + 1) / 7);
  const celdas = Array.from({ length: semanas * 7 }, (_, k) => sumarDias(inicio, k));
  const esMesActual = primero.slice(0, 7) === hoy.slice(0, 7);

  return (
    <AppShell>
      <TopBar
        titulo="Calendario"
        subtitulo={`${delMes.length} ${delMes.length === 1 ? 'pendiente' : 'pendientes'} en ${nombreMesLargo(mes).toLowerCase()}. Tareas, cierres, auditoría, pólizas y ventas de cheques.`}
        actions={
          <div className="flex items-center gap-2">
            {!esMesActual && <Link href="/calendario" className="btn-secondary">Hoy</Link>}
            <div className="flex items-center rounded-[10px] border border-border bg-surface">
              <Link href={`/calendario?mes=${mesRel(anio, mes, -1)}`} className="p-2 hover:bg-surface-2 rounded-l-[10px]" aria-label="Mes anterior"><ChevronLeft size={18} /></Link>
              <span className="px-3 font-semibold min-w-[9.5rem] text-center">{nombreMesLargo(mes)} {anio}</span>
              <Link href={`/calendario?mes=${mesRel(anio, mes, 1)}`} className="p-2 hover:bg-surface-2 rounded-r-[10px]" aria-label="Mes siguiente"><ChevronRight size={18} /></Link>
            </div>
          </div>
        }
      />
      <div className="px-4 sm:px-6 py-5 space-y-4">
        {vencidosAntes > 0 && (
          <div className="card px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2 border-danger/30 bg-danger/5">
            <span><b className="text-danger">{vencidosAntes} pendientes vencidos</b> de meses anteriores siguen abiertos.</span>
            <Link href="/revision-semanal" className="font-semibold text-primary hover:underline">Revisarlos</Link>
          </div>
        )}

        {/* Grilla (tablet y escritorio) */}
        <div className="card overflow-hidden hidden md:block">
          <div className="grid grid-cols-7 bg-surface-2 border-b border-border text-[0.8rem] font-semibold text-muted">
            {DIAS.map((d) => <div key={d} className="px-3 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {celdas.map((f, k) => {
              const items = porDia.get(f) ?? [];
              const fuera = f < primero || f > ultimo;
              const esHoy = f === hoy;
              return (
                <div key={f} className={`min-h-[7.5rem] p-2 border-border ${k % 7 ? 'border-l' : ''} ${k >= 7 ? 'border-t' : ''} ${fuera ? 'bg-surface-2/60' : ''}`}>
                  <div className={`text-sm mb-1 tabular ${esHoy ? 'inline-grid place-items-center w-7 h-7 rounded-full bg-ink text-white font-bold' : fuera ? 'text-muted/60' : 'font-semibold'}`}>{+f.slice(8)}</div>
                  <ul className="space-y-1">
                    {items.slice(0, MAX_POR_DIA).map((i) => (
                      <li key={i.key}>
                        <Link href={i.href} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.8rem] leading-tight hover:bg-surface-2" title={`${i.titulo} · ${i.modulo}${i.responsable ? ` · ${i.responsable}` : ''}`}>
                          <PuntoTono item={i} hoy={hoy} />
                          <span className="truncate">{i.titulo}</span>
                        </Link>
                      </li>
                    ))}
                    {items.length > MAX_POR_DIA && <li className="text-[0.75rem] text-muted px-1.5">+{items.length - MAX_POR_DIA} más</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista por día (celular) */}
        <div className="md:hidden space-y-3">
          {delMes.length === 0 && <div className="card px-4 py-8 text-center text-muted">No hay pendientes con fecha este mes.</div>}
          {Array.from(porDia.entries()).map(([f, items]) => (
            <section key={f} className="card overflow-hidden">
              <h2 className={`px-4 py-2.5 text-sm font-bold border-b border-border ${f === hoy ? 'bg-ink text-white' : 'bg-surface-2'}`}>
                {DIAS[(diaSemana(f) + 6) % 7]} {+f.slice(8)}{f === hoy ? ' · Hoy' : ''}
              </h2>
              <ul>
                {items.map((i) => (
                  <li key={i.key} className="border-b border-border/70 last:border-b-0">
                    <Link href={i.href} className="flex items-center gap-3 px-4 py-3">
                      <IconoItem item={i} hoy={hoy} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold truncate">{i.titulo}</span>
                        <span className="block text-[0.8rem] text-muted truncate">{i.modulo}{i.responsable ? ` · ${i.responsable}` : ''}</span>
                      </span>
                      <ChipVencimiento item={i} hoy={hoy} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-muted">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger" />Vencido</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Hoy</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" />Próximos 7 días</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted" />Más adelante</span>
        </div>
      </div>
    </AppShell>
  );
}
