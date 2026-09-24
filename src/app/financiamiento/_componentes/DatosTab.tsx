'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { mesesDeEjercicio, nombreMesAbr, fmtPct, convertirATEA, calcularTasaDescuentoCheque, calcularTEACheque, calcularTasaReferencia } from '@/lib/cfpp/calculos';
import { TIPOS_FUENTE, TIPOS_TASA, PERFILES_RIESGO, type Ejercicio, type Mes, type Fuente, type ChequeOp, type Benchmarks, type TipoFuente, type TipoTasa, type Moneda, type PerfilRiesgo } from '@/lib/cfpp/types';
import { CampoNum, CampoTexto, InputNum, InputTexto } from './campos';

export function DatosTab(props: {
  ejercicio: Ejercicio;
  mesFiltro: string; setMesFiltro: (m: string) => void;
  fuentes: Fuente[]; cheques: ChequeOp[]; benchmarks: Benchmarks;
  onAgregarFuente: () => void;
  onActualizarFuente: (id: string, c: Partial<Fuente>) => void;
  onEliminarFuente: (id: string) => void;
  onDuplicarFuente: (id: string) => void;
  onDuplicarMesAnterior: () => void;
  onAgregarCheque: () => void;
  onActualizarCheque: (id: string, c: Partial<ChequeOp>) => void;
  onEliminarCheque: (id: string) => void;
  onGuardarBenchmarks: (c: Partial<Benchmarks>) => void;
}) {
  const { ejercicio, mesFiltro, setMesFiltro, fuentes, cheques, benchmarks } = props;
  const [avanzado, setAvanzado] = useState(false);
  const meses = mesesDeEjercicio(ejercicio);

  function onChangePerfilRiesgo(perfil: PerfilRiesgo) {
    const preset = PERFILES_RIESGO.find(p => p.v === perfil);
    const nuevoSpread = preset && preset.spread !== null ? preset.spread : benchmarks.riesgo_spread;
    props.onGuardarBenchmarks({ riesgo_perfil: perfil, riesgo_spread: nuevoSpread });
  }

  const ref = calcularTasaReferencia(benchmarks);

  return (
    <div className="space-y-4">
      {/* ---- Card: Fuentes ---- */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Fuentes activas — {ejercicio}</h2>
            <p className="text-xs text-muted mt-0.5">Préstamos, adelantos, comex, leasing y otras deudas con costo financiero</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="input" style={{ width: 160 }}>
              <option value="">Todos los meses</option>
              {meses.map(m => <option key={m} value={m}>{nombreMesAbr(m)}</option>)}
            </select>
            <button onClick={props.onDuplicarMesAnterior} className="btn-secondary text-sm">
              <Copy size={14} /> Duplicar mes anterior
            </button>
            <button onClick={props.onAgregarFuente} className="btn-primary text-sm">
              <Plus size={14} /> Agregar fuente
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-accent/8 border-b border-border text-xs">
          Cargá el <b>saldo capital al cierre del mes</b> (lo que figura en el resumen del banco). En "tipo de tasa" elegí cómo te la informa el contrato; debajo del input vas a ver la TEA equivalente calculada.
        </div>

        {fuentes.length === 0 ? (
          <div className="p-10 text-center text-muted">
            No hay fuentes cargadas. Hacé clic en <b>+ Agregar fuente</b> para empezar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Mes</th>
                  <th style={{ width: 130 }}>Tipo</th>
                  <th>Entidad / Descripción</th>
                  <th style={{ width: 80 }}>Moneda</th>
                  <th className="text-right" style={{ width: 150 }}>Saldo al cierre</th>
                  <th style={{ width: 170 }}>Tipo de tasa</th>
                  <th className="text-right" style={{ width: 140 }}>Tasa %</th>
                  <th className="text-right" style={{ width: 90 }}>Plazo (días)</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {fuentes.map(f => (
                  <FilaFuente key={f.id} f={f} meses={meses}
                    onUpdate={props.onActualizarFuente}
                    onEliminar={props.onEliminarFuente}
                    onDuplicar={props.onDuplicarFuente} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Card: Cheques ---- */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Operaciones de venta de cheques</h2>
            <p className="text-xs text-muted mt-0.5">El sistema calcula la TEA implícita y reparte automáticamente el saldo entre los meses pendientes</p>
          </div>
          <button onClick={props.onAgregarCheque} className="btn-primary text-sm">
            <Plus size={14} /> Agregar operación
          </button>
        </div>

        <div className="px-5 py-3 bg-accent/8 border-b border-border text-xs">
          Cargá una operación por cada propuesta de venta de cheques que cerraste. El sistema usa el <b>monto neto</b> y el <b>plazo promedio</b> para distribuir el saldo financiado entre los meses.
        </div>

        {cheques.length === 0 ? (
          <div className="p-10 text-center text-muted">No hay operaciones cargadas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Fecha de venta</th>
                  <th>Entidad</th>
                  <th className="text-right" style={{ width: 150 }}>Monto bruto</th>
                  <th className="text-right" style={{ width: 150 }}>Monto neto</th>
                  <th className="text-right" style={{ width: 110 }}>Plazo (días)</th>
                  <th className="text-right" style={{ width: 100 }}>Descuento</th>
                  <th className="text-right" style={{ width: 120 }}>TEA implícita</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {cheques.map(c => (
                  <FilaCheque key={c.id} c={c}
                    onUpdate={props.onActualizarCheque}
                    onEliminar={props.onEliminarCheque} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Card: Referencia internacional (SOFR + Riesgo) ---- */}
      <div className="card p-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Referencia internacional (SOFR + Riesgo Empresario)</h2>
          <p className="text-xs text-muted mt-0.5">
            Tasa de referencia para una empresa privada con acceso a mercado internacional. Sirve para dimensionar el "costo país" implícito de tu financiamiento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CampoNum
            label="SOFR actual %"
            value={benchmarks.sofr}
            onChange={v => props.onGuardarBenchmarks({ sofr: v })}
            placeholder="ej: 4,30"
          />
          <label className="block">
            <span className="text-xs text-muted block mb-1 font-medium">Perfil de riesgo</span>
            <select
              value={benchmarks.riesgo_perfil}
              onChange={e => onChangePerfilRiesgo(e.target.value as PerfilRiesgo)}
              className="input"
            >
              {PERFILES_RIESGO.map(p => (
                <option key={p.v} value={p.v}>
                  {p.l}{p.spread !== null ? ` (SOFR + ${p.spread}%)` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-1">
              {PERFILES_RIESGO.find(p => p.v === benchmarks.riesgo_perfil)?.desc}
            </p>
          </label>
          <CampoNum
            label={`Spread sobre SOFR %${benchmarks.riesgo_perfil !== 'personalizado' ? ' (auto)' : ''}`}
            value={benchmarks.riesgo_spread}
            onChange={v => props.onGuardarBenchmarks({ riesgo_spread: v, riesgo_perfil: 'personalizado' })}
            placeholder="ej: 3,00"
          />
        </div>

        {/* Tasa referencia calculada */}
        <div className="mt-4 p-3 rounded-lg bg-surface-2 border border-border">
          <div className="text-xs text-muted mb-1 font-medium">Tasa referencia calculada</div>
          <div className="flex gap-6 flex-wrap items-baseline">
            <div>
              <span className="text-xs text-muted mr-2">USD:</span>
              <span className="text-lg font-bold tabular-nums" style={{ color: 'rgb(var(--accent))' }}>
                {fmtPct(ref.usd)}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted mr-2">ARS equivalente:</span>
              <span className="text-lg font-bold tabular-nums" style={{ color: 'rgb(var(--accent))' }}>
                {fmtPct(ref.arsEquiv)}
              </span>
              {ref.arsEquiv === null && ref.usd !== null && (
                <span className="text-xs text-muted ml-2">(cargá devaluación esperada abajo para calcular)</span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted mt-2">
            <b>ARS equivalente</b> = (1 + Tasa USD) × (1 + Devaluación esperada) − 1. Convierte la tasa internacional a su equivalente en pesos.
          </p>
        </div>
      </div>

      {/* ---- Card: Inflación esperada ---- */}
      <div className="card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Inflación esperada del ejercicio</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CampoNum
            label="Inflación esperada anual % (REM-BCRA o IPC realizado)"
            value={benchmarks.inflacion}
            onChange={v => props.onGuardarBenchmarks({ inflacion: v })}
            placeholder="ej: 35,0"
          />
          <CampoTexto
            label="Notas (fuente, fecha de consulta)"
            value={benchmarks.notas}
            onChange={v => props.onGuardarBenchmarks({ notas: v })}
            placeholder="REM-BCRA junio 2026"
          />
        </div>

        <button onClick={() => setAvanzado(a => !a)}
          className="text-xs text-muted hover:text-text mt-4 flex items-center gap-1">
          {avanzado ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Avanzado: otros benchmarks (opcionales)
        </button>

        {avanzado && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-border">
            <div>
              <CampoNum
                label="Devaluación esperada anual %"
                value={benchmarks.devaluacion}
                onChange={v => props.onGuardarBenchmarks({ devaluacion: v })}
                placeholder="ej: 28,0"
              />
              <p className="text-xs text-muted mt-1">Se usa para convertir la tasa referencia USD a ARS equivalente y para el spread USD.</p>
            </div>
            <div>
              <CampoNum
                label="Badlar promedio %"
                value={benchmarks.badlar}
                onChange={v => props.onGuardarBenchmarks({ badlar: v })}
                placeholder="ej: 32,0"
              />
              <p className="text-xs text-muted mt-1">Tasa de plazo fijo mayorista. Sirve para evaluar el spread bancario.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ====== Fila fuente ======
export function FilaFuente({ f, meses, onUpdate, onEliminar, onDuplicar }: {
  f: Fuente; meses: Mes[];
  onUpdate: (id: string, c: Partial<Fuente>) => void;
  onEliminar: (id: string) => void;
  onDuplicar: (id: string) => void;
}) {
  const teaEq = convertirATEA(f.tasa, f.tipo_tasa);
  const showBadge = f.tipo_tasa !== 'tea' && f.tipo_tasa !== 'cft_a' && teaEq !== null;

  return (
    <tr>
      <td>
        <select className="input" style={{ padding: '4px 6px', fontSize: 12 }}
          value={f.mes} onChange={e => onUpdate(f.id, { mes: e.target.value as Mes })}>
          {meses.map(m => <option key={m} value={m}>{nombreMesAbr(m)}</option>)}
        </select>
      </td>
      <td>
        <select className="input" style={{ padding: '4px 6px', fontSize: 12 }}
          value={f.tipo} onChange={e => onUpdate(f.id, { tipo: e.target.value as TipoFuente })}>
          {TIPOS_FUENTE.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </td>
      <td><InputTexto value={f.descripcion} onCommit={v => onUpdate(f.id, { descripcion: v })} placeholder="Banco / detalle" /></td>
      <td>
        <select className="input" style={{ padding: '4px 6px', fontSize: 12 }}
          value={f.moneda} onChange={e => onUpdate(f.id, { moneda: e.target.value as Moneda })}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </td>
      <td className="text-right"><InputNum value={f.saldo} onCommit={v => onUpdate(f.id, { saldo: v })} placeholder="0" /></td>
      <td>
        <select className="input" style={{ padding: '4px 6px', fontSize: 12 }}
          value={f.tipo_tasa} onChange={e => onUpdate(f.id, { tipo_tasa: e.target.value as TipoTasa })}>
          {TIPOS_TASA.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </td>
      <td className="text-right">
        <InputNum value={f.tasa} onCommit={v => onUpdate(f.id, { tasa: v })} placeholder="0,00" decimals={4} />
        {showBadge && (
          <div className="text-xs text-accent font-medium mt-0.5 leading-tight">
            = {fmtPct(teaEq)} TEA
          </div>
        )}
      </td>
      <td className="text-right">
        <InputNum value={f.plazo_dias} onCommit={v => onUpdate(f.id, { plazo_dias: v })} placeholder="—" decimals={0} />
      </td>
      <td>
        <div className="flex gap-1">
          <button onClick={() => onDuplicar(f.id)} className="btn-ghost p-1" title="Duplicar al mes siguiente"><Copy size={14} /></button>
          <button onClick={() => onEliminar(f.id)} className="btn-ghost p-1 text-danger" title="Eliminar"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  );
}

// ====== Fila cheque ======
export function FilaCheque({ c, onUpdate, onEliminar }: {
  c: ChequeOp;
  onUpdate: (id: string, c: Partial<ChequeOp>) => void;
  onEliminar: (id: string) => void;
}) {
  const desc = calcularTasaDescuentoCheque(c);
  const tea = calcularTEACheque(c);
  return (
    <tr>
      <td>
        <input type="date" value={c.fecha || ''}
          onChange={e => onUpdate(c.id, { fecha: e.target.value || null })}
          className="input" style={{ padding: '4px 6px', fontSize: 12 }} />
      </td>
      <td><InputTexto value={c.entidad} onCommit={v => onUpdate(c.id, { entidad: v })} placeholder="Banco / financiera" /></td>
      <td className="text-right"><InputNum value={c.bruto} onCommit={v => onUpdate(c.id, { bruto: v })} placeholder="0" /></td>
      <td className="text-right"><InputNum value={c.neto} onCommit={v => onUpdate(c.id, { neto: v })} placeholder="0" /></td>
      <td className="text-right"><InputNum value={c.plazo_dias} onCommit={v => onUpdate(c.id, { plazo_dias: v })} placeholder="60" decimals={0} /></td>
      <td className="text-right text-muted text-sm tabular-nums">{desc !== null ? fmtPct(desc) : '—'}</td>
      <td className="text-right text-sm tabular-nums" style={{ color: 'rgb(var(--accent))', fontWeight: 500 }}>{tea !== null ? fmtPct(tea) : '—'}</td>
      <td><button onClick={() => onEliminar(c.id)} className="btn-ghost p-1 text-danger"><Trash2 size={14} /></button></td>
    </tr>
  );
}

// ====== Inputs reusables ======
