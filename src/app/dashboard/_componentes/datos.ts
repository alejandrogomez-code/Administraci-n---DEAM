import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyISO, sumarDias } from '@/lib/fechas';

export type DatosInicio = {
  cierre: { id: string; mes: number; anio: number; hechas: number; total: number } | null;
  iva: { id: string; periodo: string; ok: number; pendientes: number } | null;
  auditoria: { id: string; trimestre: number; anio: number; estado: string } | null;
  chequesDisponibles: { cantidad: number; importe: number };
  propuestasBorrador: number;
  ultimaVenta: string | null;
  polizas: { vigentes: number; vencen30: number };
  documentos: number;
  accesos: { id: string; titulo: string; url: string; color: string | null }[];
};

/** Indicadores del Inicio. Cada consulta es independiente: si una tabla falla, el resto se muestra igual. */
export async function cargarDatosInicio(supabase: SupabaseClient): Promise<DatosInicio> {
  const hoy = hoyISO();
  const en30 = sumarDias(hoy, 30);

  const [cierreQ, ivaQ, auditQ, chequesQ, borradorQ, ventaQ, polVigQ, pol30Q, docsQ, accesosQ] = await Promise.all([
    supabase.from('accounting_closings').select('id, mes, anio, estado').order('anio', { ascending: false }).order('mes', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('iva_controls').select('id, periodo, total_coincidencias').order('periodo', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('audit_trimestres').select('id, trimestre, anio, estado').order('anio', { ascending: false }).order('trimestre', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('cheques').select('importe').is('propuesta_id', null).gte('vencimiento', hoy).limit(5000),
    supabase.from('propuestas_cheques').select('id', { count: 'exact', head: true }).eq('estado', 'borrador'),
    supabase.from('propuestas_cheques').select('fecha_venta').eq('estado', 'finalizada').order('fecha_venta', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('repo_polizas').select('id', { count: 'exact', head: true }).eq('finalizada', false),
    supabase.from('repo_polizas').select('id', { count: 'exact', head: true }).eq('finalizada', false).gte('vencimiento', hoy).lte('vencimiento', en30),
    supabase.from('repo_documentos').select('id', { count: 'exact', head: true }),
    supabase.from('accesos_directos').select('id, titulo, url, color').eq('activo', true).order('orden').limit(6),
  ]);

  let cierre: DatosInicio['cierre'] = null;
  const c: any = cierreQ.data;
  if (c) {
    const { data: t } = await supabase.from('accounting_closing_tasks').select('estado').eq('closing_id', c.id);
    const lista = (t ?? []) as any[];
    cierre = { id: c.id, mes: c.mes, anio: c.anio, hechas: lista.filter((x) => x.estado === 'completado').length, total: lista.length };
  }

  let iva: DatosInicio['iva'] = null;
  const v: any = ivaQ.data;
  if (v) {
    const { count } = await supabase.from('iva_control_results').select('id', { count: 'exact', head: true }).eq('iva_control_id', v.id).neq('tipo', 'ok').eq('resuelto', false);
    iva = { id: v.id, periodo: v.periodo, ok: v.total_coincidencias ?? 0, pendientes: count ?? 0 };
  }

  const importes = ((chequesQ.data ?? []) as any[]).map((x) => Number(x.importe) || 0);

  return {
    cierre,
    iva,
    auditoria: (auditQ.data as any) ?? null,
    chequesDisponibles: { cantidad: importes.length, importe: importes.reduce((a, b) => a + b, 0) },
    propuestasBorrador: borradorQ.count ?? 0,
    ultimaVenta: (ventaQ.data as any)?.fecha_venta ?? null,
    polizas: { vigentes: polVigQ.count ?? 0, vencen30: pol30Q.count ?? 0 },
    documentos: docsQ.count ?? 0,
    accesos: (accesosQ.data ?? []) as any,
  };
}
