// Lógica del cruce entre AFIP y SAP.
// Estrategia:
//  1. Indexar SAP por matchKey = CUIT|PV|NUM|LETRA (sin ceros a izquierda).
//  2. Recorrer AFIP: si existe key en SAP -> comparar importes exactos al centavo:
//        - iguales -> 'ok'
//        - distintos -> 'diferencia_importe'
//     Si no existe -> 'falta_en_sap'.
//  3. Los SAP que no fueron matcheados -> 'falta_en_afip'.
// Las NC (notas de crédito) vienen con signo invertido entre los dos archivos
// (AFIP positivo, SAP negativo). Por eso comparamos por VALOR ABSOLUTO del importe.

import { ComprobanteAfip, ComprobanteSap, CruceResultado, ResumenCruce } from './types';
import { matchKey } from './normalize';

const TOLERANCIA = 0;  // centavos. 0 = exacto al centavo (según requerimiento del usuario)

export function cruzar(afip: ComprobanteAfip[], sap: ComprobanteSap[]): {
  resultados: CruceResultado[];
  resumen: ResumenCruce;
} {
  // Indexar SAP. Si hubiera más de uno con misma key, los guardamos en array.
  const indexSap = new Map<string, ComprobanteSap[]>();
  for (const s of sap) {
    const k = matchKey({ cuit: s.cuit, punto_venta: s.punto_venta, numero: s.numero, letra: s.letra });
    const arr = indexSap.get(k);
    if (arr) arr.push(s); else indexSap.set(k, [s]);
  }

  const matched = new Set<ComprobanteSap>();
  const resultados: CruceResultado[] = [];

  for (const a of afip) {
    const k = matchKey({ cuit: a.cuit, punto_venta: a.punto_venta, numero: a.numero, letra: a.letra });
    const candidatos = indexSap.get(k);
    if (candidatos && candidatos.length) {
      // tomar el primer candidato no matcheado
      let s: ComprobanteSap | undefined;
      for (const c of candidatos) if (!matched.has(c)) { s = c; break; }
      if (s) {
        matched.add(s);
        const absA = Math.round(Math.abs(a.importe_total) * 100) / 100;
        const absS = Math.round(Math.abs(s.importe_total) * 100) / 100;
        const diff = Math.round((absA - absS) * 100) / 100;
        if (Math.abs(diff) <= TOLERANCIA / 100) {
          resultados.push({ tipo: 'ok', key: k, afip: a, sap: s });
        } else {
          resultados.push({ tipo: 'diferencia_importe', key: k, afip: a, sap: s, diferencia: diff });
        }
        continue;
      }
    }
    resultados.push({ tipo: 'falta_en_sap', key: k, afip: a });
  }

  // Los SAP no matcheados son faltantes en AFIP
  for (const s of sap) {
    if (matched.has(s)) continue;
    const k = matchKey({ cuit: s.cuit, punto_venta: s.punto_venta, numero: s.numero, letra: s.letra });
    resultados.push({ tipo: 'falta_en_afip', key: k, sap: s });
  }

  const importe_total_afip = afip.reduce((acc, a) => acc + a.importe_total, 0);
  const importe_total_sap = sap.reduce((acc, s) => acc + s.importe_total, 0);

  const resumen: ResumenCruce = {
    total_afip: afip.length,
    total_sap: sap.length,
    total_coincidencias: resultados.filter((r) => r.tipo === 'ok').length,
    total_diferencias_importe: resultados.filter((r) => r.tipo === 'diferencia_importe').length,
    total_faltantes_sap: resultados.filter((r) => r.tipo === 'falta_en_sap').length,
    total_faltantes_afip: resultados.filter((r) => r.tipo === 'falta_en_afip').length,
    importe_total_afip: Math.round(importe_total_afip * 100) / 100,
    importe_total_sap: Math.round(importe_total_sap * 100) / 100,
  };

  return { resultados, resumen };
}
