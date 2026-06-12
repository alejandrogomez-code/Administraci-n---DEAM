'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCcw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFechaHora, fmtMoney } from '@/lib/format';

type IvaControl = {
  id: string;
  periodo: string;
  total_afip: number;
  total_sap: number;
  total_coincidencias: number;
  total_diferencias_importe: number;
  total_faltantes_sap: number;
  total_faltantes_afip: number;
  importe_total_afip: number;
  importe_total_sap: number;
  estado: string;
  created_at: string;
};

export default function IvaListPage() {
  const supabase = createClient();
  const [items, setItems] = useState<IvaControl[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('iva_controls').select('*').order('periodo', { ascending: false });
    setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <TopBar
        titulo="Control de IVA"
        subtitulo="Cruce de comprobantes ARCA vs SAP"
        actions={<Link href="/contabilidad/iva/nuevo" className="btn-primary"><Plus size={16}/> Nuevo control</Link>}
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Controles registrados</div>
            <button onClick={load} className="btn-ghost text-sm"><RefreshCcw size={14}/> Refrescar</button>
          </div>
          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted">
              No hay controles. <Link className="text-primary" href="/contabilidad/iva/nuevo">Crear el primero</Link>.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Procesado</th>
                  <th className="text-right">ARCA</th>
                  <th className="text-right">SAP</th>
                  <th className="text-right">Coinciden</th>
                  <th className="text-right">Dif. importe</th>
                  <th className="text-right">Falta SAP</th>
                  <th className="text-right">Falta ARCA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.periodo}</td>
                    <td className="text-xs text-muted">{fmtFechaHora(c.created_at)}</td>
                    <td className="text-right">{c.total_afip} <span className="text-xs text-muted block">{fmtMoney(c.importe_total_afip)}</span></td>
                    <td className="text-right">{c.total_sap} <span className="text-xs text-muted block">{fmtMoney(c.importe_total_sap)}</span></td>
                    <td className="text-right text-success">{c.total_coincidencias}</td>
                    <td className="text-right text-warning">{c.total_diferencias_importe}</td>
                    <td className="text-right text-danger">{c.total_faltantes_sap}</td>
                    <td className="text-right text-accent">{c.total_faltantes_afip}</td>
                    <td><Link className="text-primary text-sm" href={`/contabilidad/iva/${c.id}`}>Ver resultados →</Link></td>
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
