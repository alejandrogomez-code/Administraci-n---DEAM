'use client';

import { useMemo } from 'react';
import { nombreMesAbr, fmtPct, fmtMoney, fmtPpts, calcularPorMes, calcularEjercicio, calcularConcentracion, calcularPorTipo } from '@/lib/cfpp/calculos';
import { type Ejercicio, type Mes, type Fuente, type ChequeOp, type Benchmarks } from '@/lib/cfpp/types';

export function ResultadosTab({ ejercicio, fuentes, cheques, benchmarks }: {
  ejercicio: Ejercicio; fuentes: Fuente[]; cheques: ChequeOp[]; benchmarks: Benchmarks;
}) {
  const r = useMemo(() => calcularEjercicio(ejercicio, fuentes, cheques, benchmarks), [ejercicio, fuentes, cheques, benchmarks]);
  const meses = useMemo(() => calcularPorMes(ejercicio, fuentes, cheques), [ejercicio, fuentes, cheques]);
  const concentracion = useMemo(() => calcularConcentracion(ejercicio, fuentes, cheques, 'ARS'), [ejercicio, fuentes, cheques]);
  const porTipo = useMemo(() => calcularPorTipo(ejercicio, fuentes, cheques, 'ARS'), [ejercicio, fuentes, cheques]);

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="CFPP nominal ARS" value={fmtPct(r.cfppArs)} sub={r.arsDen > 0 ? `Sobre ${fmtMoney(r.arsDen)} (saldo acum.)` : 'Sin fuentes ARS'} accent />
        <Kpi label="CFPP real ARS" value={fmtPct(r.cfppReal)} sub="Descontando inflación esperada" />
        <Kpi label="CFPP nominal USD" value={fmtPct(r.cfppUsd)} sub="Si hay fuentes en USD" />
        <Kpi label="Plazo promedio ponderado" value={r.plazoArs !== null ? `${Math.round(r.plazoArs)} días` : '—'} sub="Ponderado por saldo" />
      </div>

      {/* Evolución mensual */}
      <div className="card">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold">Evolución mensual del CFPP</h2>
          <p className="text-xs text-muted">Incluye fuentes generales + venta de cheques distribuida por mes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="text-right">Saldo total ARS</th>
                <th className="text-right">CFPP ARS</th>
                <th className="text-right">Saldo total USD</th>
                <th className="text-right">CFPP USD</th>
                <th className="text-right">N° fuentes</th>
              </tr>
            </thead>
            <tbody>
              {meses.map(m => (
                <tr key={m.mes}>
                  <td>{nombreMesAbr(m.mes)}</td>
                  <td className="text-right tabular-nums">{m.ars.saldo > 0 ? fmtMoney(m.ars.saldo) : <span className="text-muted">—</span>}</td>
                  <td className="text-right tabular-nums">{m.ars.cfpp !== null ? fmtPct(m.ars.cfpp) : <span className="text-muted">—</span>}</td>
                  <td className="text-right tabular-nums">{m.usd.saldo > 0 ? fmtMoney(m.usd.saldo, 'USD') : <span className="text-muted">—</span>}</td>
                  <td className="text-right tabular-nums">{m.usd.cfpp !== null ? fmtPct(m.usd.cfpp) : <span className="text-muted">—</span>}</td>
                  <td className="text-right tabular-nums">{m.nFuentes || <span className="text-muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Concentración + por tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-semibold">Concentración por entidad (ARS)</h2>
            <p className="text-xs text-muted">% del saldo total del ejercicio</p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Entidad</th>
                  <th className="text-right">Saldo acum.</th>
                  <th className="text-right">% del total</th>
                  <th className="text-right">TEA prom.</th>
                </tr>
              </thead>
              <tbody>
                {concentracion.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-muted py-4">Sin datos en ARS</td></tr>
                ) : concentracion.map(c => (
                  <tr key={c.clave}>
                    <td>{c.clave}</td>
                    <td className="text-right tabular-nums">{fmtMoney(c.saldo)}</td>
                    <td className="text-right tabular-nums">{fmtPct(c.pct, 1)}</td>
                    <td className="text-right tabular-nums">{fmtPct(c.tea)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-semibold">Composición por tipo (ARS)</h2>
            <p className="text-xs text-muted">Distribución del financiamiento</p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="text-right">Saldo acum.</th>
                  <th className="text-right">% del total</th>
                  <th className="text-right">TEA prom.</th>
                </tr>
              </thead>
              <tbody>
                {porTipo.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-muted py-4">Sin datos en ARS</td></tr>
                ) : porTipo.map(t => (
                  <tr key={t.clave}>
                    <td>{t.clave}</td>
                    <td className="text-right tabular-nums">{fmtMoney(t.saldo)}</td>
                    <td className="text-right tabular-nums">{fmtPct(t.pct, 1)}</td>
                    <td className="text-right tabular-nums">{fmtPct(t.tea)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Spread vs benchmarks (Argentina) */}
      <div className="card">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold">Spread vs benchmarks locales</h2>
          <p className="text-xs text-muted">En puntos porcentuales</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          <Kpi label="Vs inflación esperada" value={fmtPpts(r.spreadInflacion)} sub="Positivo = pagás por encima de la inflación" />
          <Kpi label="Vs Badlar" value={fmtPpts(r.spreadBadlar)} sub="Tu costo extra sobre la tasa de mercado" />
          <Kpi label="Vs devaluación (USD)" value={fmtPpts(r.spreadDevaluacion)} sub="CFPP USD − devaluación esperada" />
        </div>
      </div>

     {/* CFPP vs Referencia internacional */}
      <div className="card">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold">CFPP vs Referencia internacional</h2>
          <p className="text-xs text-muted">
            Comparación con SOFR + spread de riesgo, ajustado por devaluación esperada
          </p>
        </div>

        {r.tasaRefArsEquiv === null ? (
          <div className="px-4 sm:px-6 py-5 text-sm text-muted text-center">
            Cargá SOFR, perfil de riesgo y devaluación esperada en la pestaña <b>Datos</b> para ver este análisis.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            <Kpi
              label="CFPP nominal ARS"
              value={fmtPct(r.cfppArs)}
              sub="Costo financiero real de DEAM"
            />
            <Kpi
              label="Tasa referencia ARS equivalente"
              value={fmtPct(r.tasaRefArsEquiv)}
              sub={`SOFR + ${fmtPct(benchmarks.riesgo_spread ?? null)} · ajustada por devaluación`}
            />
            <KpiSemaforo
              label="Diferencia"
              diff={r.spreadReferenciaAjustado}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'border-l-4 border-l-primary' : ''}`}>
      <div className="text-xs text-muted font-semibold">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
export function KpiSemaforo({ label, diff }: { label: string; diff: number | null }) {
  let borderClass = 'border-l-4 border-l-border';
  let textClass = 'text-muted';
  let mensaje = 'Cargá los datos para calcular';

  if (diff !== null) {
    if (diff > 2) {
      borderClass = 'border-l-4 border-l-danger';
      textClass = 'text-danger';
      mensaje = 'CFPP significativamente mayor a la referencia';
    } else if (diff < -2) {
      borderClass = 'border-l-4 border-l-success';
      textClass = 'text-success';
      mensaje = 'CFPP menor a la referencia — buen posicionamiento';
    } else {
      borderClass = 'border-l-4 border-l-warning';
      textClass = 'text-warning';
      mensaje = 'CFPP dentro del rango de referencia (±2 p.p.)';
    }
  }

  return (
    <div className={`card p-4 ${borderClass}`}>
      <div className="text-xs text-muted font-semibold">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${textClass}`}>{fmtPpts(diff)}</div>
      <div className="text-xs text-muted mt-1">{mensaje}</div>
    </div>
  );
}
// ====== TAB: AYUDA ======
