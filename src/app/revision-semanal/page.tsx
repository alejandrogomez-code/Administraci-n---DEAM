import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/server';
import { cargarAgenda } from '@/lib/agenda';
import { hoyISO, sumarDias } from '@/lib/fechas';
import Revision, { type Hecho } from './_componentes/Revision';

export const dynamic = 'force-dynamic';

export default async function RevisionSemanalPage() {
  const supabase = createClient();
  const hoy = hoyISO();
  const hace7 = sumarDias(hoy, -7);

  const [agenda, tareasOk, cierreOk, auditOk] = await Promise.all([
    cargarAgenda(supabase),
    supabase.from('tareas').select('id, numero, titulo, updated_at').eq('estado', 'completo').gte('updated_at', hace7).order('updated_at', { ascending: false }),
    supabase.from('accounting_closing_tasks').select('id, nombre, fecha_real_finalizacion').eq('estado', 'completado').gte('fecha_real_finalizacion', hace7),
    supabase.from('audit_trimestre_tasks').select('id, nombre, fecha_finalizacion').eq('estado', 'completado').gte('fecha_finalizacion', hace7),
  ]);

  const hechos: Hecho[] = [
    ...((tareasOk.data ?? []) as any[]).map((t) => ({ key: `t${t.id}`, titulo: t.titulo, modulo: 'Tareas', fecha: String(t.updated_at).slice(0, 10) })),
    ...((cierreOk.data ?? []) as any[]).map((t) => ({ key: `c${t.id}`, titulo: t.nombre, modulo: 'Cierre del mes', fecha: t.fecha_real_finalizacion })),
    ...((auditOk.data ?? []) as any[]).map((t) => ({ key: `a${t.id}`, titulo: t.nombre, modulo: 'Auditoría', fecha: t.fecha_finalizacion })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <AppShell>
      <TopBar titulo="Revisión semanal" subtitulo="Cerrá lo que ya está hecho, reprogramá lo atrasado y mirá lo que viene en los próximos 7 días." />
      <div className="px-4 sm:px-6 py-5">
        <Revision items={agenda} hechos={hechos} hoy={hoy} />
      </div>
    </AppShell>
  );
}
