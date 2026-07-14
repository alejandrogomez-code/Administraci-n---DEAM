'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ChevronDown, ChevronRight, Copy, Download,
  Loader2, Plus, RefreshCcw, Trash2,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import {
  mesesDeEjercicio, nombreMesAbr,
  parseNum, fmtPct, fmtMoney, fmtPpts, fmtNumLocal,
  convertirATEA,
  calcularTasaDescuentoCheque, calcularTEACheque,
  calcularPorMes, calcularEjercicio, calcularTasaReferencia,
  calcularConcentracion, calcularPorTipo,
} from '@/lib/cfpp/calculos';
import {
  TIPOS_FUENTE, TIPOS_TASA, PERFILES_RIESGO,
  type Ejercicio, type Mes, type Fuente, type ChequeOp, type Benchmarks,
  type TipoFuente, type TipoTasa, type Moneda, type PerfilRiesgo,
} from '@/lib/cfpp/types';

type Tab = 'datos' | 'resultados' | 'ayuda';

const EJERCICIOS_DEFAULT: Ejercicio[] = ['2026-2027'];

const BENCHMARKS_VACIO = (ej: Ejercicio): Benchmarks => ({
  ejercicio: ej,
  inflacion: null,
  devaluacion: null,
  badlar: null,
  sofr: null,
  riesgo_perfil: 'pyme_buena',
  riesgo_spread: 3.0,
  notas: '',
});

export default function FinanciamientoPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [ejercicio, setEjercicio] = useState<Ejercicio>('2026-2027');
  const [tab, setTab] = useState<Tab>('datos');
  const [mesFiltro, setMesFiltro] = useState<string>('');

  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [cheques, setCheques] = useState<ChequeOp[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmarks>(BENCHMARKS_VACIO('2026-2027'));
  const [loading, setLoading] = useState(true);

  // ====== Guard: solo admin ======
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) { setReady(true); setAutorizado(false); } return; }
      const { data: prof } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
      if (!active) return;
      const ok = (prof as any)?.rol === 'admin';
      setAutorizado(ok);
      setUserId(user.id);
      setReady(true);
      if (!ok) router.replace('/dashboard');
    })();
    return () => { active = false; };
  }, []);

  async function loadData(ej: Ejercicio) {
    if (!autorizado || !userId) return;
    setLoading(true);
    const [{ data: fs }, { data: chs }, { data: bm }] = await Promise.all([
      supabase.from('cfpp_fuentes').select('*').eq('ejercicio', ej).eq('user_id', userId)
        .order('mes').order('saldo', { ascending: false }),
      supabase.from('cfpp_cheques').select('*').eq('ejercicio', ej).eq('user_id', userId)
        .order('fecha', { ascending: true }),
      supabase.from('cfpp_benchmarks').select('*').eq('ejercicio', ej).eq('user_id', userId).maybeSingle(),
    ]);
    setFuentes((fs as any) ?? []);
    setCheques((chs as any) ?? []);
    if (bm) {
      // Asegurar defaults en campos nuevos que podrían venir null
      const withDefaults: Benchmarks = {
        ...(bm as any),
        riesgo_perfil: (bm as any).riesgo_perfil ?? 'pyme_buena',
      };
      setBenchmarks(withDefaults);
    } else {
      setBenchmarks(BENCHMARKS_VACIO(ej));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (autorizado && userId) loadData(ejercicio);
  }, [autorizado, userId, ejercicio]);

  // ====== Fuentes ======
  async function agregarFuente() {
    if (!userId) return;
    const meses = mesesDeEjercicio(ejercicio);
    const mesDefault = mesFiltro || meses[0];
    const nueva = {
      ejercicio, mes: mesDefault, tipo: 'prestamo' as TipoFuente,
      descripcion: '', moneda: 'ARS' as Moneda, saldo: null,
      tipo_tasa: 'tna_vencida' as TipoTasa, tasa: null, plazo_dias: null,
      notas: '', user_id: userId,
    };
    const { data, error } = await supabase.from('cfpp_fuentes').insert(nueva).select('*').single();
    if (error) { alert('Error al crear: ' + error.message); return; }
    setFuentes(prev => [...prev, data as any]);
  }

  async function actualizarFuente(id: string, cambios: Partial<Fuente>) {
    setFuentes(prev => prev.map(f => f.id === id ? { ...f, ...cambios } as Fuente : f));
    const { error } = await supabase.from('cfpp_fuentes').update(cambios).eq('id', id);
    if (error) alert('Error al guardar: ' + error.message);
  }

  async function eliminarFuente(id: string) {
    if (!confirm('¿Eliminar esta fuente?')) return;
    const { error } = await supabase.from('cfpp_fuentes').delete().eq('id', id);
    if (error) { alert('Error al eliminar: ' + error.message); return; }
    setFuentes(prev => prev.filter(f => f.id !== id));
  }

  async function duplicarFuente(id: string) {
    if (!userId) return;
    const f = fuentes.find(x => x.id === id);
    if (!f) return;
    const meses = mesesDeEjercicio(ejercicio);
    const idx = meses.indexOf(f.mes);
    if (idx === -1 || idx === meses.length - 1) { alert('No hay mes siguiente en este ejercicio.'); return; }
    const { id: _, created_at, updated_at, ...rest } = f as any;
    const nueva = { ...rest, mes: meses[idx + 1] };
    const { data, error } = await supabase.from('cfpp_fuentes').insert(nueva).select('*').single();
    if (error) { alert('Error: ' + error.message); return; }
    setFuentes(prev => [...prev, data as any]);
  }

  async function duplicarMesAnterior() {
    if (!mesFiltro) { alert('Primero filtrá por el mes destino.'); return; }
    const meses = mesesDeEjercicio(ejercicio);
    const idx = meses.indexOf(mesFiltro);
    if (idx <= 0) { alert('No hay mes anterior en este ejercicio.'); return; }
    const mesAnterior = meses[idx - 1];
    const fuentesAnt = fuentes.filter(f => f.mes === mesAnterior);
    if (fuentesAnt.length === 0) { alert(`No hay fuentes en ${nombreMesAbr(mesAnterior)}.`); return; }
    if (!confirm(`Copiar ${fuentesAnt.length} fuente(s) de ${nombreMesAbr(mesAnterior)} a ${nombreMesAbr(mesFiltro)}?`)) return;
    if (!userId) return;
    const nuevas = fuentesAnt.map(f => {
      const { id, created_at, updated_at, ...rest } = f as any;
      return { ...rest, mes: mesFiltro };
    });
    const { data, error } = await supabase.from('cfpp_fuentes').insert(nuevas).select('*');
    if (error) { alert('Error: ' + error.message); return; }
    setFuentes(prev => [...prev, ...(data as any[])]);
  }

  // ====== Cheques ======
  async function agregarCheque() {
    if (!userId) return;
    const nuevo = {
      ejercicio, fecha: null, entidad: '', bruto: null, neto: null, plazo_dias: null, notas: '',
      user_id: userId,
    };
    const { data, error } = await supabase.from('cfpp_cheques').insert(nuevo).select('*').single();
    if (error) { alert('Error: ' + error.message); return; }
    setCheques(prev => [...prev, data as any]);
  }

  async function actualizarCheque(id: string, cambios: Partial<ChequeOp>) {
    setCheques(prev => prev.map(c => c.id === id ? { ...c, ...cambios } as ChequeOp : c));
    const { error } = await supabase.from('cfpp_cheques').update(cambios).eq('id', id);
    if (error) alert('Error al guardar: ' + error.message);
  }

  async function eliminarCheque(id: string) {
    if (!confirm('¿Eliminar esta operación?')) return;
    const { error } = await supabase.from('cfpp_cheques').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    setCheques(prev => prev.filter(c => c.id !== id));
  }

  // ====== Benchmarks ======
  async function guardarBenchmarks(cambios: Partial<Benchmarks>) {
    if (!userId) return;
    const nuevo = { ...benchmarks, ...cambios };
    setBenchmarks(nuevo);
    const payload = {
      ejercicio,
      inflacion: nuevo.inflacion,
      devaluacion: nuevo.devaluacion,
      badlar: nuevo.badlar,
      sofr: nuevo.sofr,
      riesgo_perfil: nuevo.riesgo_perfil,
      riesgo_spread: nuevo.riesgo_spread,
      notas: nuevo.notas ?? '',
      user_id: userId,
    };
    const { error } = await supabase
      .from('cfpp_benchmarks')
      .upsert(payload, { onConflict: 'ejercicio,user_id' });
    if (error) alert('Error al guardar benchmarks: ' + error.message);
  }

  function exportarJSON() {
    const data = { ejercicio, fuentes, cheques, benchmarks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cfpp-deam-${ejercicio}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fuentesFiltradas = useMemo(() => {
    const arr = mesFiltro ? fuentes.filter(f => f.mes === mesFiltro) : fuentes;
    return [...arr].sort((a, b) => {
      if (a.mes !== b.mes) return a.mes.localeCompare(b.mes);
      return (b.saldo ?? 0) - (a.saldo ?? 0);
    });
  }, [fuentes, mesFiltro]);

  const chequesOrdenados = useMemo(() =>
    [...cheques].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')),
    [cheques]
  );

  if (!ready) return <AppShell><div className="p-10 text-center text-muted">Cargando...</div></AppShell>;

  if (!autorizado) {
    return (
      <AppShell>
        <TopBar titulo="Acceso denegado" />
        <div className="p-6 max-w-xl">
          <div className="card p-6 border-l-4 border-l-danger">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-danger shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-semibold">No tenés permisos para acceder a esta sección</div>
                <p className="text-sm text-muted mt-1">El módulo de financiamiento está restringido al rol administrador.</p>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar
        titulo="Costo Financiero Promedio Ponderado"
        subtitulo="Financiamiento · Análisis del CFPP por ejercicio"
        actions={
          <>
            <select value={ejercicio} onChange={e => setEjercicio(e.target.value as Ejercicio)}
              className="input" style={{ width: 'auto' }}>
              {EJERCICIOS_DEFAULT.map(e => <option key={e} value={e}>Ejercicio {e}</option>)}
            </select>
            <button onClick={exportarJSON} className="btn-secondary"><Download size={14} /> Backup</button>
            <button onClick={() => loadData(ejercicio)} className="btn-ghost" title="Recargar"><RefreshCcw size={14} /></button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex gap-1 border-b border-border">
          <TabButton active={tab === 'datos'} onClick={() => setTab('datos')}>Datos</TabButton>
          <TabButton active={tab === 'resultados'} onClick={() => setTab('resultados')}>Resultados</TabButton>
          <TabButton active={tab === 'ayuda'} onClick={() => setTab('ayuda')}>Ayuda</TabButton>
        </div>

        {loading && (
          <div className="card p-10 text-center text-muted">
            <Loader2 className="animate-spin inline mr-2" size={16} /> Cargando datos...
          </div>
        )}

        {!loading && tab === 'datos' && (
          <DatosTab
            ejercicio={ejercicio}
            mesFiltro={mesFiltro} setMesFiltro={setMesFiltro}
            fuentes={fuentesFiltradas} cheques={chequesOrdenados}
            benchmarks={benchmarks}
            onAgregarFuente={agregarFuente} onActualizarFuente={actualizarFuente}
            onEliminarFuente={eliminarFuente} onDuplicarFuente={duplicarFuente}
            onDuplicarMesAnterior={duplicarMesAnterior}
            onAgregarCheque={agregarCheque} onActualizarCheque={actualizarCheque}
            onEliminarCheque={eliminarCheque}
            onGuardarBenchmarks={guardarBenchmarks}
          />
        )}

        {!loading && tab === 'resultados' && (
          <ResultadosTab ejercicio={ejercicio} fuentes={fuentes} cheques={cheques} benchmarks={benchmarks} />
        )}

        {!loading && tab === 'ayuda' && <AyudaTab />}
      </div>
    </AppShell>
  );
}

// ============================================================
// COMPONENTES
// ============================================================

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
      }`}>
      {children}
    </button>
  );
}

// ====== TAB: DATOS ======
function DatosTab(props: {
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
function FilaFuente({ f, meses, onUpdate, onEliminar, onDuplicar }: {
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
function FilaCheque({ c, onUpdate, onEliminar }: {
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
function InputTexto({ value, onCommit, placeholder }: { value: string | null; onCommit: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState<string>(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <input type="text" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== (value ?? '')) onCommit(local); }}
      placeholder={placeholder}
      className="input" style={{ padding: '4px 6px', fontSize: 12, width: '100%' }} />
  );
}

function InputNum({ value, onCommit, placeholder, decimals = 2 }: {
  value: number | null; onCommit: (v: number | null) => void; placeholder?: string; decimals?: number;
}) {
  const [local, setLocal] = useState<string>(value === null || value === undefined ? '' : fmtNumLocal(value, decimals));
  useEffect(() => {
    setLocal(value === null || value === undefined ? '' : fmtNumLocal(value, decimals));
  }, [value, decimals]);
  return (
    <input type="text" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { const p = parseNum(local); if (p !== value) onCommit(p); }}
      placeholder={placeholder}
      className="input text-right" style={{ padding: '4px 6px', fontSize: 12, width: '100%' }} />
  );
}

function CampoNum({ label, value, onChange, placeholder }: {
  label: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string;
}) {
  const [local, setLocal] = useState<string>(value === null || value === undefined ? '' : fmtNumLocal(value, 2));
  useEffect(() => { setLocal(value === null || value === undefined ? '' : fmtNumLocal(value, 2)); }, [value]);
  return (
    <label className="block">
      <span className="text-xs text-muted block mb-1 font-medium">{label}</span>
      <input type="text" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { const p = parseNum(local); if (p !== value) onChange(p); }}
        placeholder={placeholder} className="input text-right" />
    </label>
  );
}

function CampoTexto({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [local, setLocal] = useState<string>(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <label className="block">
      <span className="text-xs text-muted block mb-1 font-medium">{label}</span>
      <input type="text" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== (value ?? '')) onChange(local); }}
        placeholder={placeholder} className="input" />
    </label>
  );
}

// ====== TAB: RESULTADOS ======
function ResultadosTab({ ejercicio, fuentes, cheques, benchmarks }: {
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
          <div className="p-6 text-sm text-muted text-center">
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

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'border-l-4 border-l-primary' : ''}`}>
      <div className="text-xs text-muted uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
function KpiSemaforo({ label, diff }: { label: string; diff: number | null }) {
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
      <div className="text-xs text-muted uppercase tracking-wide font-semibold">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${textClass}`}>{fmtPpts(diff)}</div>
      <div className="text-xs text-muted mt-1">{mensaje}</div>
    </div>
  );
}
// ====== TAB: AYUDA ======
function AyudaTab() {
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
