import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import ListaAtencion from '@/components/agenda/ListaAtencion';
import { createClient } from '@/lib/supabase/server';
import { cargarAgenda, resumirAgenda } from '@/lib/agenda';
import { fechaLarga, hoyISO, saludo, sumarDias } from '@/lib/fechas';
import { cargarDatosInicio } from './_componentes/datos';
import Indicadores from './_componentes/Indicadores';
import ResumenModulos from './_componentes/ResumenModulos';
import { Accesos, ProximasFechas } from './_componentes/Laterales';

export const dynamic = 'force-dynamic';

export default async function InicioPage() {
  const supabase = createClient();
  const hoy = hoyISO();
  const [agenda, datos] = await Promise.all([cargarAgenda(supabase), cargarDatosInicio(supabase)]);
  const resumen = resumirAgenda(agenda, hoy);
  const tareas = agenda.filter((i) => i.origen === 'tarea');
  const tareasVencidas = tareas.filter((i) => i.fecha && i.fecha < hoy).length;
  const en30 = sumarDias(hoy, 30);
  const proximas = agenda.filter((i) => i.fecha && i.fecha > hoy && i.fecha <= en30).slice(0, 6);

  return (
    <AppShell>
      <TopBar
        titulo={saludo()}
        subtitulo={<>
          {fechaLarga(hoy)} · {agenda.length} pendientes
          {resumen.vencidos > 0 && <> · <span className="text-danger font-semibold">{resumen.vencidos} vencidos</span></>}
        </>}
        actions={<>
          <Link href="/revision-semanal" className="btn-secondary"><Check size={16} />Revisión semanal</Link>
          <Link href="/tareas?nueva=1" className="btn-primary"><Plus size={16} />Nueva tarea</Link>
        </>}
      />
      <div className="px-4 sm:px-6 py-5 space-y-5">
        <Indicadores tareas={tareas.length} vencidas={tareasVencidas} d={datos} />
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <ListaAtencion items={agenda} hoy={hoy} />
            <ResumenModulos d={datos} />
          </div>
          <div className="space-y-5">
            <ProximasFechas items={proximas} />
            <Accesos accesos={datos.accesos} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
