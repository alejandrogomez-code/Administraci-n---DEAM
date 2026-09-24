'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { Cargando } from '@/components/Cargando';
import { ChequesTab } from './_componentes/ChequesTab';
import { LibradoresTab } from './_componentes/LibradoresTab';
import { ProblemasTab } from './_componentes/ProblemasTab';
import { PropuestasTab } from './_componentes/PropuestasTab';
import { TabBtn } from './_componentes/TabBtn';
import { Cheque, ClienteProblema, Librador, Propuesta, Tab } from './_componentes/tipos';

export default function VentaChequesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('cheques');

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [problemas, setProblemas] = useState<ClienteProblema[]>([]);
  const [libradores, setLibradores] = useState<Librador[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: ch }, { data: pr }, { data: pb }, { data: lb }] = await Promise.all([
      supabase.from('cheques').select('*').order('vencimiento').order('importe', { ascending: false }),
      supabase.from('propuestas_cheques').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes_problemas').select('*').eq('activo', true).order('librador'),
      supabase.from('libradores').select('*').order('nombre'),
    ]);
    setCheques((ch as any) ?? []);
    setPropuestas((pr as any) ?? []);
    setProblemas((pb as any) ?? []);
    setLibradores((lb as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const cuitsProblema = useMemo(() => new Set(problemas.map((p) => p.cuit)), [problemas]);

  return (
    <AppShell>
      <TopBar
        titulo="Venta de cheques"
        subtitulo="Carga, simulador, propuestas y clientes con problemas"
        actions={<Link href="/tesoreria" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="px-4 sm:px-6 py-5 space-y-4">
        <div className="flex gap-1 border-b border-border">
          <TabBtn active={tab==='cheques'} onClick={() => setTab('cheques')}>
            Cheques ({cheques.length})
          </TabBtn>
          <TabBtn active={tab==='propuestas'} onClick={() => setTab('propuestas')}>
            Propuestas / Simulador ({propuestas.length})
          </TabBtn>
          <TabBtn active={tab==='libradores'} onClick={() => setTab('libradores')}>
            Libradores ({libradores.length})
          </TabBtn>
          <TabBtn active={tab==='problemas'} onClick={() => setTab('problemas')}>
            Clientes con problemas ({problemas.length})
          </TabBtn>
        </div>

        {loading ? (
          <Cargando filas={6} enTarjeta />
        ) : (
          <>
            {tab === 'cheques' && <ChequesTab cheques={cheques} propuestas={propuestas} cuitsProblema={cuitsProblema} problemas={problemas} libradores={libradores} reload={load} />}
            {tab === 'propuestas' && <PropuestasTab propuestas={propuestas} cheques={cheques} reload={load} router={router} />}
            {tab === 'libradores' && <LibradoresTab libradores={libradores} reload={load} />}
            {tab === 'problemas' && <ProblemasTab problemas={problemas} reload={load} />}
          </>
        )}
      </div>
    </AppShell>
  );
}
