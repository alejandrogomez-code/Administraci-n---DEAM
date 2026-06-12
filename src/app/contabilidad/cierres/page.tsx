'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCcw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusChip from '@/components/StatusChip';
import ProgressBar from '@/components/ProgressBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, nombreMes } from '@/lib/format';

type Closing = {
  id: string;
  mes: number;
  anio: number;
  fecha_estimada_cierre: string | null;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  responsable_principal: string | null;
  responsable_nombre?: string;
  avance: number;
  total_tareas: number;
  tareas_completadas: number;
};

export default function CierresListPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Closing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  async function load() {
    setLoading(true);
    const { data: cls } = await supabase
      .from('accounting_closings')
      .select('*, profiles:responsable_principal(nombre)')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false });

    const result: Closing[] = [];
    for (const c of cls ?? []) {
      const { data: tasks } = await supabase
        .from('accounting_closing_tasks')
        .select('estado').eq('closing_id', c.id);
      const total = tasks?.length ?? 0;
      const compl = tasks?.filter((t: any) => t.estado === 'completado').length ?? 0;
      result.push({
        ...c,
        responsable_nombre: (c as any).profiles?.nombre,
        avance: total ? Math.round((compl / total) * 100) : 0,
        total_tareas: total,
        tareas_completadas: compl,
      });
    }
    setItems(result);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtrados = useMemo(() =>
    items.filter((it) => !filtroEstado || it.estado === filtroEstado),
    [items, filtroEstado]
  );

  const kpi = useMemo(() => ({
    total: items.length,
    pendientes: items.filter((i) => i.estado === 'pendiente').length,
    en_proceso: items.filter((i) => i.estado === 'en_proceso').length,
    completados: items.filter((i) => i.estado === 'completado').length,
  }), [items]);

  return (
    <AppShell>
      <TopBar
        titulo="Cierres del mes"
        subtitulo="Tareas de cierre contable mensual"
        actions={
          <Link href="/contabilidad/cierres/nuevo" className="btn-primary">
            <Plus size={16} /> Nuevo cierre
          </Link>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total" value={kpi.total} />
          <KpiCard label="Pendientes" value={kpi.pendientes} tone="warning" />
          <KpiCard label="En proceso" value={kpi.en_proceso} tone="accent" />
          <KpiCard label="Completados" value={kpi.completados} tone="success" />
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <div className="flex gap-2 items-center">
              <select className="input !w-auto" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="completado">Completado</option>
              </select>
            </div>
            <button onClick={load} className="btn-ghost"><RefreshCcw size={14}/> Refrescar</button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-10 text-center text-muted">
              No hay cierres aún. <Link className="text-primary" href="/contabilidad/cierres/nuevo">Crear el primero</Link>.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Fecha estimada</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Avance</th>
                  <th>Tareas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td><span className="font-medium">{nombreMes(c.mes)} {c.anio}</span></td>
                    <td>{fmtFecha(c.fecha_estimada_cierre)}</td>
                    <td>{c.responsable_nombre ?? '-'}</td>
                    <td><StatusChip estado={c.estado} /></td>
                    <td className="min-w-32">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={c.avance} />
                        <span className="text-xs text-muted whitespace-nowrap">{c.avance}%</span>
                      </div>
                    </td>
                    <td className="text-xs text-muted">{c.tareas_completadas} / {c.total_tareas}</td>
                    <td><Link className="text-primary text-sm" href={`/contabilidad/cierres/${c.id}`}>Ver tareas →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: 'warning'|'accent'|'success' }) {
  const cls = tone === 'warning' ? 'text-warning' : tone === 'accent' ? 'text-accent' : tone === 'success' ? 'text-success' : '';
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
