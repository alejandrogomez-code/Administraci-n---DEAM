'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fmtFecha, fmtMoney } from '@/lib/format';
import { calcularResumen } from '@/lib/cheques/calculos';
import { avisar, pedirTexto } from '@/components/feedback';
import { Cheque, Propuesta } from './tipos';

/* ============================================================
   TAB 2: PROPUESTAS / SIMULADOR
   ============================================================ */
export function PropuestasTab({ propuestas, cheques, reload, router }: {
  propuestas: Propuesta[];
  cheques: Cheque[];
  reload: () => void;
  router: any;
}) {
  const supabase = createClient();

  async function crear() {
    const nombre = (await pedirTexto('Nombre de la nueva propuesta:', `Propuesta ${new Date().toLocaleDateString('es-AR')}`));
    if (!nombre) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('propuestas_cheques').insert({ nombre, estado: 'borrador', created_by: user?.id }).select('id').single();
    if (error) { avisar(error.message); return; }
    router.push(`/tesoreria/venta-cheques/propuestas/${data.id}`);
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="text-sm">{propuestas.length} propuesta{propuestas.length === 1 ? '' : 's'}</div>
        <button onClick={crear} className="btn-primary text-sm"><Plus size={14}/> Nueva propuesta</button>
      </div>
      {propuestas.length === 0 ? (
        <div className="p-10 text-center text-muted text-sm">
          Sin propuestas. <button className="text-primary" onClick={crear}>Crear la primera</button> o asignar cheques desde la solapa Cheques.
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha venta</th>
              <th>Tasa</th>
              <th>Banco</th>
              <th>Cheques</th>
              <th className="text-right">Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {propuestas.map((p) => {
              const usaSnap = !!p.snap_finalizada_en;
              const chs = cheques.filter((c) => c.propuesta_id === p.id);
              const resumenLive = calcularResumen(chs, p.fecha_venta, p.tasa);
              const cantidad = usaSnap ? (p.snap_cantidad ?? 0) : chs.length;
              const total = usaSnap ? Number(p.snap_total_a_vender ?? 0) : resumenLive.total_a_vender;
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.nombre}</td>
                  <td className="text-xs">{fmtFecha(p.fecha_venta)}</td>
                  <td className="text-xs">{p.tasa != null ? p.tasa + '%' : '-'}</td>
                  <td className="text-xs">{p.banco_operacion ?? '-'}</td>
                  <td className="text-xs">{cantidad}</td>
                  <td className="text-right font-medium">{fmtMoney(total)}</td>
                  <td><span className={`chip ${p.estado === 'finalizada' ? 'chip-completado' : p.estado === 'cancelada' ? 'chip-falta-sap' : 'chip-en-proceso'}`}>{p.estado}</span></td>
                  <td><Link className="text-primary text-sm" href={`/tesoreria/venta-cheques/propuestas/${p.id}`}>Ver →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
