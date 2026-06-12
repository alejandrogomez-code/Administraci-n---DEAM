// Tipos y cálculos para el módulo de Venta de Cheques

export type Cheque = {
  id: string;
  vencimiento: string;          // ISO yyyy-mm-dd
  asignacion: string | null;
  importe: number;
  librador: string | null;
  banco: string | null;
  cuit: string | null;
  tipo: string | null;
  status: number | null;        // 1..8
  observaciones: string | null;
  propuesta_id: string | null;
};

export type Propuesta = {
  id: string;
  nombre: string;
  fecha_venta: string | null;   // ISO yyyy-mm-dd
  tasa: number | null;          // %
  banco_operacion: string | null;
  notas: string | null;
  estado: 'borrador' | 'propuesta' | 'finalizada' | 'cancelada';
  created_at: string;
};

export type ClienteProblema = {
  id: string;
  librador: string;
  cuit: string;
  motivo: string | null;
  activo: boolean;
};

// Días entre dos fechas ISO (yyyy-mm-dd), redondeo positivo
export function diasEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null;
  const d1 = new Date(desde + 'T00:00:00');
  const d2 = new Date(hasta + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// Descuento por cheque: 1 - (días × tasa/360)
// tasa es porcentaje (ej 23 = 23%), no fracción
export function descuentoFactor(dias: number | null, tasaPct: number | null): number | null {
  if (dias == null || tasaPct == null) return null;
  return 1 - (dias * (tasaPct / 100)) / 360;
}

// Importe a percibir por cheque
export function aPercibirCheque(importe: number, dias: number | null, tasaPct: number | null): number | null {
  const f = descuentoFactor(dias, tasaPct);
  if (f == null) return null;
  return Math.round(importe * f * 100) / 100;
}

export type ResumenPropuesta = {
  cantidad: number;
  total_a_vender: number;
  aproximado_a_percibir: number;
  costo_aproximado: number;
  plazo_promedio: number | null;           // ponderado por importe
  cft_aproximado_pct: number | null;
};

export function calcularResumen(
  cheques: Pick<Cheque, 'importe' | 'vencimiento'>[],
  fechaVenta: string | null,
  tasaPct: number | null,
): ResumenPropuesta {
  const cantidad = cheques.length;
  const total_a_vender = cheques.reduce((acc, c) => acc + (c.importe || 0), 0);

  let suma_aper = 0;
  let dias_x_imp = 0;
  let usable = true;

  for (const c of cheques) {
    const d = diasEntre(fechaVenta, c.vencimiento);
    if (d == null || tasaPct == null) { usable = false; continue; }
    const ap = aPercibirCheque(c.importe, d, tasaPct);
    if (ap != null) suma_aper += ap;
    dias_x_imp += d * c.importe;
  }

  if (!usable) {
    return {
      cantidad,
      total_a_vender: round2(total_a_vender),
      aproximado_a_percibir: 0,
      costo_aproximado: 0,
      plazo_promedio: total_a_vender > 0 ? Math.round(dias_x_imp / total_a_vender) : null,
      cft_aproximado_pct: null,
    };
  }

  const costo = total_a_vender - suma_aper;
  const cft = total_a_vender > 0 ? (costo / total_a_vender) * 100 : null;
  const plazo_prom = total_a_vender > 0 ? Math.round(dias_x_imp / total_a_vender) : null;

  return {
    cantidad,
    total_a_vender: round2(total_a_vender),
    aproximado_a_percibir: round2(suma_aper),
    costo_aproximado: round2(costo),
    plazo_promedio: plazo_prom,
    cft_aproximado_pct: cft != null ? Math.round(cft * 100) / 100 : null,
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
