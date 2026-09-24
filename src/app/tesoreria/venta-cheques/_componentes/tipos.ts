

export type Cheque = {
  id: string;
  vencimiento: string;
  asignacion: string | null;
  importe: number;
  librador: string | null;
  banco: string | null;
  cuit: string | null;
  tipo: string | null;
  status: number | null;
  observaciones: string | null;
  propuesta_id: string | null;
};

export type Propuesta = {
  id: string;
  nombre: string;
  fecha_venta: string | null;
  tasa: number | null;
  banco_operacion: string | null;
  notas: string | null;
  estado: string;
  created_at: string;
  // Snapshot
  snap_cantidad: number | null;
  snap_total_a_vender: number | null;
  snap_aproximado_a_percibir: number | null;
  snap_costo_aproximado: number | null;
  snap_cft_pct: number | null;
  snap_plazo_promedio: number | null;
  snap_finalizada_en: string | null;
};

export type ClienteProblema = {
  id: string;
  librador: string;
  cuit: string;
  motivo: string | null;
  activo: boolean;
};

export type Librador = {
  id: string;
  nombre: string;
  cuit: string | null;
  observaciones: string | null;
  activo: boolean;
};

export type Tab = 'cheques' | 'propuestas' | 'libradores' | 'problemas';
