/**
 * Agenda unificada: junta los pendientes de todos los módulos en una sola lista.
 * La usan el Inicio, el Calendario, la Revisión semanal y los contadores de la barra lateral.
 * Funciona con el cliente de Supabase del servidor o del navegador.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyISO, sumarDias } from './fechas';

export type Origen = 'tarea' | 'cierre' | 'auditoria' | 'iva' | 'poliza' | 'propuesta';
export type Modulo = 'Tareas' | 'Contabilidad' | 'Tesorería' | 'Repositorio';

export type ItemAgenda = {
  key: string;            // único: origen:id
  id: string;             // id de la fila en su tabla
  origen: Origen;
  modulo: Modulo;
  titulo: string;
  detalle: string;        // línea secundaria
  responsable: string | null;
  fecha: string | null;   // YYYY-MM-DD
  href: string;
  cantidad?: number;      // p.ej. diferencias de IVA sin resolver
  completable: boolean;   // se puede marcar como hecho desde la agenda
};

export const MODULO_DE_ORIGEN: Record<Origen, Modulo> = {
  tarea: 'Tareas', cierre: 'Contabilidad', auditoria: 'Contabilidad', iva: 'Contabilidad', poliza: 'Repositorio', propuesta: 'Tesorería',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Opciones = {
  /** Días hacia adelante para incluir pólizas por vencer (por defecto 45). */
  horizontePolizas?: number;
};

export async function cargarAgenda(supabase: SupabaseClient, opts: Opciones = {}): Promise<ItemAgenda[]> {
  const hoy = hoyISO();
  const limitePolizas = sumarDias(hoy, opts.horizontePolizas ?? 45);

  const [miembros, tareas, cierres, cierreTasks, trimestres, auditTasks, ivaCtrls, ivaPend, polizas, propuestas] = await Promise.all([
    supabase.from('team_members').select('id, nombre'),
    supabase.from('tareas').select('id, numero, titulo, estado, vencimiento, responsable_id').neq('estado', 'completo'),
    supabase.from('accounting_closings').select('id, mes, anio, estado').neq('estado', 'completado'),
    supabase.from('accounting_closing_tasks').select('id, closing_id, nombre, estado, fecha_estimada, fecha_estimada_2, responsable_id').neq('estado', 'completado'),
    supabase.from('audit_trimestres').select('id, trimestre, anio, estado').neq('estado', 'completado'),
    supabase.from('audit_trimestre_tasks').select('id, trimestre_id, nombre, estado, fecha_vencimiento, responsable_id').neq('estado', 'completado'),
    supabase.from('iva_controls').select('id, periodo'),
    supabase.from('iva_control_results').select('iva_control_id').neq('tipo', 'ok').eq('resuelto', false).limit(10000),
    supabase.from('repo_polizas').select('id, empresa, vencimiento, finalizada').eq('finalizada', false).lte('vencimiento', limitePolizas),
    supabase.from('propuestas_cheques').select('id, nombre, estado, fecha_venta, snap_cantidad').eq('estado', 'borrador'),
  ]);

  const nombre = new Map<string, string>((miembros.data ?? []).map((m: any) => [m.id, m.nombre]));
  const resp = (id: string | null) => (id ? nombre.get(id) ?? null : null);
  const items: ItemAgenda[] = [];

  for (const t of (tareas.data ?? []) as any[]) {
    items.push({
      key: `tarea:${t.id}`, id: t.id, origen: 'tarea', modulo: 'Tareas',
      titulo: t.titulo, detalle: `T-${String(t.numero).padStart(4, '0')}`,
      responsable: resp(t.responsable_id), fecha: t.vencimiento, href: `/tareas?abrir=${t.id}`, completable: true,
    });
  }

  const cierrePorId = new Map((cierres.data ?? []).map((c: any) => [c.id, c]));
  for (const t of (cierreTasks.data ?? []) as any[]) {
    const c: any = cierrePorId.get(t.closing_id);
    if (!c) continue; // tareas de cierres ya completados
    items.push({
      key: `cierre:${t.id}`, id: t.id, origen: 'cierre', modulo: 'Contabilidad',
      titulo: t.nombre, detalle: `Cierre de ${MESES[c.mes - 1]} ${c.anio}`,
      responsable: resp(t.responsable_id), fecha: t.fecha_estimada_2 || t.fecha_estimada, href: `/contabilidad/cierres/${c.id}`, completable: true,
    });
  }

  const trimPorId = new Map((trimestres.data ?? []).map((c: any) => [c.id, c]));
  for (const t of (auditTasks.data ?? []) as any[]) {
    const tr: any = trimPorId.get(t.trimestre_id);
    if (!tr) continue;
    items.push({
      key: `auditoria:${t.id}`, id: t.id, origen: 'auditoria', modulo: 'Contabilidad',
      titulo: t.nombre, detalle: `Auditoría T${tr.trimestre} ${tr.anio}`,
      responsable: resp(t.responsable_id), fecha: t.fecha_vencimiento, href: `/contabilidad/auditoria/${tr.id}`, completable: true,
    });
  }

  const pendPorControl = new Map<string, number>();
  for (const r of (ivaPend.data ?? []) as any[]) pendPorControl.set(r.iva_control_id, (pendPorControl.get(r.iva_control_id) ?? 0) + 1);
  for (const c of (ivaCtrls.data ?? []) as any[]) {
    const n = pendPorControl.get(c.id);
    if (!n) continue;
    const [a, m] = String(c.periodo).split('-').map(Number);
    items.push({
      key: `iva:${c.id}`, id: c.id, origen: 'iva', modulo: 'Contabilidad',
      titulo: `IVA ${MESES[m - 1] ?? ''} ${a}: ${n} ${n === 1 ? 'diferencia' : 'diferencias'} sin resolver`, detalle: 'Control ARCA vs SAP',
      responsable: null, fecha: null, href: `/contabilidad/iva/${c.id}`, cantidad: n, completable: false,
    });
  }

  for (const p of (polizas.data ?? []) as any[]) {
    items.push({
      key: `poliza:${p.id}`, id: p.id, origen: 'poliza', modulo: 'Repositorio',
      titulo: `Póliza ${p.empresa}`, detalle: 'Gestión de pólizas',
      responsable: null, fecha: p.vencimiento, href: '/repositorio/polizas', completable: false,
    });
  }

  for (const p of (propuestas.data ?? []) as any[]) {
    items.push({
      key: `propuesta:${p.id}`, id: p.id, origen: 'propuesta', modulo: 'Tesorería',
      titulo: `Propuesta de venta: ${p.nombre}`, detalle: p.snap_cantidad ? `${p.snap_cantidad} cheques` : 'Borrador',
      responsable: null, fecha: p.fecha_venta, href: `/tesoreria/venta-cheques/propuestas/${p.id}`, completable: false,
    });
  }

  return ordenarAgenda(items);
}

/** Vencidos primero (el más atrasado arriba), después por fecha, al final los sin fecha. */
export function ordenarAgenda(items: ItemAgenda[]): ItemAgenda[] {
  return [...items].sort((a, b) => {
    if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.fecha) return -1;
    if (b.fecha) return 1;
    return a.titulo.localeCompare(b.titulo);
  });
}

export type Resumen = {
  vencidos: number;
  hoy: number;
  semana: number;
  porModulo: Record<Modulo, number>; // vencidos por módulo (contadores de la barra lateral)
};

export function resumirAgenda(items: ItemAgenda[], hoy = hoyISO()): Resumen {
  const fin = sumarDias(hoy, 7);
  const porModulo: Record<Modulo, number> = { Tareas: 0, Contabilidad: 0, Tesorería: 0, Repositorio: 0 };
  let vencidos = 0, deHoy = 0, semana = 0;
  for (const i of items) {
    if (!i.fecha) continue;
    if (i.fecha < hoy) { vencidos++; porModulo[i.modulo]++; }
    else if (i.fecha === hoy) deHoy++;
    else if (i.fecha <= fin) semana++;
  }
  return { vencidos, hoy: deHoy, semana, porModulo };
}

/** Marca como hecho un ítem completable, escribiendo en su tabla de origen (y recalcula el estado del cierre / trimestre). */
export async function completarItem(supabase: SupabaseClient, item: Pick<ItemAgenda, 'origen' | 'id'>) {
  const hoy = hoyISO();
  const { data: { user } } = await supabase.auth.getUser();
  if (item.origen === 'tarea') {
    const r = await supabase.from('tareas').update({ estado: 'completo' }).eq('id', item.id);
    if (r.error) throw r.error;
    return;
  }
  const cfg = item.origen === 'cierre'
    ? { tabla: 'accounting_closing_tasks', padre: 'accounting_closings', fk: 'closing_id', fin: 'fecha_real_finalizacion' }
    : item.origen === 'auditoria'
      ? { tabla: 'audit_trimestre_tasks', padre: 'audit_trimestres', fk: 'trimestre_id', fin: 'fecha_finalizacion' }
      : null;
  if (!cfg) throw new Error('Este pendiente no se puede completar desde acá');

  const r = await supabase.from(cfg.tabla).update({ estado: 'completado', [cfg.fin]: hoy, updated_by: user?.id }).eq('id', item.id).select(cfg.fk).single();
  if (r.error) throw r.error;
  const padreId = (r.data as any)?.[cfg.fk];
  if (!padreId) return;
  const { data: hermanas } = await supabase.from(cfg.tabla).select('estado').eq(cfg.fk, padreId);
  const lista = (hermanas ?? []) as { estado: string }[];
  const estado = lista.every((x) => x.estado === 'completado') ? 'completado' : lista.some((x) => x.estado !== 'pendiente') ? 'en_proceso' : 'pendiente';
  await supabase.from(cfg.padre).update({ estado }).eq('id', padreId);
}

/** Cambia la fecha de vencimiento de un ítem en su tabla de origen. */
export async function reprogramarItem(supabase: SupabaseClient, item: Pick<ItemAgenda, 'origen' | 'id'>, fecha: string) {
  if (item.origen === 'tarea') return supabase.from('tareas').update({ vencimiento: fecha }).eq('id', item.id);
  if (item.origen === 'cierre') return supabase.from('accounting_closing_tasks').update({ fecha_estimada_2: fecha }).eq('id', item.id);
  if (item.origen === 'auditoria') return supabase.from('audit_trimestre_tasks').update({ fecha_vencimiento: fecha }).eq('id', item.id);
  throw new Error('Este pendiente no se puede reprogramar desde acá');
}

