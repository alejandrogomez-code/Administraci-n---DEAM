// Tipos compartidos del módulo de Control de IVA

export type ComprobanteAfip = {
  fila: number;             // fila en el Excel original (debug)
  fecha: string | null;     // ISO yyyy-mm-dd
  tipo: string | null;      // ej '1 - Factura A'
  letra: string | null;     // 'A' | 'B' | 'C' | etc
  punto_venta: string;
  numero: string;
  cuit: string;             // sin puntos ni espacios
  razon_social: string | null;
  importe_total: number;
};

export type ComprobanteSap = {
  fila: number;
  fecha: string | null;
  tipo: string | null;      // 'FC A' | 'NC A' | etc
  letra: string | null;
  nro_comprobante: string;  // tal cual SAP (ej '0009A01180703')
  punto_venta: string;
  numero: string;
  cuit: string;
  razon_social: string | null;
  importe_total: number;    // suma de todas las alícuotas para ese comprobante
};

export type CruceResultado =
  | {
      tipo: 'ok';
      key: string;
      afip: ComprobanteAfip;
      sap: ComprobanteSap;
    }
  | {
      tipo: 'diferencia_importe';
      key: string;
      afip: ComprobanteAfip;
      sap: ComprobanteSap;
      diferencia: number;
    }
  | {
      tipo: 'falta_en_sap';
      key: string;
      afip: ComprobanteAfip;
    }
  | {
      tipo: 'falta_en_afip';
      key: string;
      sap: ComprobanteSap;
    };

export type ResumenCruce = {
  total_afip: number;
  total_sap: number;
  total_coincidencias: number;
  total_diferencias_importe: number;
  total_faltantes_sap: number;
  total_faltantes_afip: number;
  importe_total_afip: number;
  importe_total_sap: number;
};
