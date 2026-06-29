// Genera (o regenera) el snapshot de una propuesta de venta de cheques.
// El snapshot congela: totales en la propuesta + detalle de cada cheque
// en propuestas_cheques_detalle. Sobrevive a la eliminación/desvinculación
// de los cheques originales.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularResumen,
  diasEntre,
  descuentoFactor,
  aPercibirCheque,
} from './calculos';

export type ChequeSnapshot = {
  id: string;
  propuesta_id: string;
  cheque_id_origen: string | null;
  vencimiento: string | null;
  asignacion: string | null;
  importe: number;
  librador: string | null;
  banco: string | null;
  cuit: string | null;
  tipo: string | null;
  status: number | null;
  observaciones: string | null;
  dias: number | null;
  descuento_factor: number | null;
  a_percibir: number | null;
  created_at: string;
};

export async function generarSnapshot(supabase: SupabaseClient, propuestaId: string) {
  // 1) Leer propuesta + cheques actualmente vinculados
  const [{ data: prop, error: ePr }, { data: cheques, error: eCh }] = await Promise.all([
    supabase.from('propuestas_cheques').select('*').eq('id', propuestaId).single(),
    supabase.from('cheques').select('*').eq('propuesta_id', propuestaId).order('vencimiento'),
  ]);
  if (ePr) throw ePr;
  if (eCh) throw eCh;
  if (!prop) throw new Error('Propuesta no encontrada');

  const chs = (cheques ?? []) as any[];
  const resumen = calcularResumen(chs, prop.fecha_venta, prop.tasa);

  // 2) Borrar detalle anterior (idempotente: permite regenerar)
  const { error: eDel } = await supabase
    .from('propuestas_cheques_detalle')
    .delete()
    .eq('propuesta_id', propuestaId);
  if (eDel) throw eDel;

  // 3) Insertar detalle congelado
  if (chs.length > 0) {
    const rows = chs.map((c) => {
      const dias = diasEntre(prop.fecha_venta, c.vencimiento);
      const desc = descuentoFactor(dias, prop.tasa);
      const aPer = aPercibirCheque(c.importe, dias, prop.tasa);
      return {
        propuesta_id: propuestaId,
        cheque_id_origen: c.id,
        vencimiento: c.vencimiento,
        asignacion: c.asignacion,
        importe: c.importe,
        librador: c.librador,
        banco: c.banco,
        cuit: c.cuit,
        tipo: c.tipo,
        status: c.status,
        observaciones: c.observaciones,
        dias,
        descuento_factor: desc,
        a_percibir: aPer,
      };
    });
    const { error: eIns } = await supabase
      .from('propuestas_cheques_detalle')
      .insert(rows);
    if (eIns) throw eIns;
  }

  // 4) Actualizar totales snapshot en la propuesta
  const { error: eUpd } = await supabase
    .from('propuestas_cheques')
    .update({
      snap_cantidad: resumen.cantidad,
      snap_total_a_vender: resumen.total_a_vender,
      snap_aproximado_a_percibir: resumen.aproximado_a_percibir,
      snap_costo_aproximado: resumen.costo_aproximado,
      snap_cft_pct: resumen.cft_aproximado_pct,
      snap_plazo_promedio: resumen.plazo_promedio,
      snap_finalizada_en: new Date().toISOString(),
    })
    .eq('id', propuestaId);
  if (eUpd) throw eUpd;

  return resumen;
}
