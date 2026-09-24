'use client';



export function AyudaTab() {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-base font-semibold mb-3">Cómo se calcula el CFPP</h2>
        <p className="text-sm mb-2"><b>CFPP mensual</b> (por moneda):</p>
        <pre className="bg-surface-2 p-3 rounded text-xs font-mono">CFPP_mes = Σ(saldo_i × TEA_i) / Σ(saldo_i)</pre>
        <p className="text-sm mt-3"><b>CFPP del ejercicio</b>: promedio ponderado de los meses, ponderado por saldo total mensual.</p>
        <p className="text-sm mt-2"><b>CFPP real</b> (Fisher): <span className="font-mono">(1 + CFPP_nominal) / (1 + inflación) − 1</span></p>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold mb-3">Referencia internacional (SOFR + Riesgo)</h2>
        <p className="text-sm">Sirve para dimensionar el sobrecosto de financiarse en Argentina vs empresas con acceso a mercado internacional.</p>
        <div className="mt-3 text-sm space-y-2">
          <p><b>Tasa referencia USD</b> = <span className="font-mono">SOFR + spread de riesgo</span></p>
          <p><b>Tasa referencia ARS equivalente</b> = <span className="font-mono">(1 + Tasa_USD) × (1 + Devaluación esperada) − 1</span></p>
          <p><b>SOFR</b> (Secured Overnight Financing Rate): tasa de referencia del mercado USD, reemplazó a LIBOR. Consultá en <a href="https://www.newyorkfed.org/markets/reference-rates/sofr" target="_blank" rel="noopener" className="text-primary underline">newyorkfed.org</a> o FRED.</p>
        </div>
        <table className="tbl mt-3">
          <thead><tr><th>Perfil</th><th>Spread</th><th>Referencia USD hoy</th></tr></thead>
          <tbody>
            <tr><td>Empresa muy sólida (AAA/AA)</td><td className="font-mono">SOFR + 1,5%</td><td>~5-7% anual</td></tr>
            <tr><td>PyME buena</td><td className="font-mono">SOFR + 3%</td><td>~7-8% anual</td></tr>
            <tr><td>Mayor riesgo</td><td className="font-mono">SOFR + 5%</td><td>~9-10% anual</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold mb-3">Conversión de tasas a TEA</h2>
        <table className="tbl">
          <thead><tr><th>Tipo</th><th>Fórmula → TEA</th><th>Ejemplo</th></tr></thead>
          <tbody>
            <tr><td>TEA</td><td className="font-mono">igual</td><td>75% → 75%</td></tr>
            <tr><td>TNA vencida (cap. mensual)</td><td className="font-mono">(1 + TNA/12)¹² − 1</td><td>60% → 79,59%</td></tr>
            <tr><td>TNA adelantada (cap. mensual)</td><td className="font-mono">conversión adel.→venc., luego anualiza</td><td>60% → 85,06%</td></tr>
            <tr><td>TEM (efectiva mensual)</td><td className="font-mono">(1 + TEM)¹² − 1</td><td>5% → 79,59%</td></tr>
            <tr><td>Tasa efectiva diaria</td><td className="font-mono">(1 + i_d)³⁶⁵ − 1</td><td>0,2% → 107,4%</td></tr>
            <tr><td>CFT-A</td><td className="font-mono">igual</td><td>ya es anual efectivo</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold mb-3">Venta de cheques</h2>
        <p className="text-sm">De cada operación, el sistema calcula:</p>
        <ul className="text-sm list-disc ml-5 mt-2 space-y-1">
          <li><b>Tasa de descuento</b>: <span className="font-mono">(bruto − neto) / bruto</span></li>
          <li><b>TEA implícita</b>: <span className="font-mono">(bruto/neto)^(365/plazo) − 1</span></li>
          <li><b>Distribución mensual</b>: el monto neto se reparte entre los meses según los días pendientes de cobro</li>
        </ul>
      </div>
    </div>
  );
}
