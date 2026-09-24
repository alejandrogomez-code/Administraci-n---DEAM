'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Download, Loader2, RefreshCcw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { mesesDeEjercicio, nombreMesAbr } from '@/lib/cfpp/calculos';
import { type Ejercicio, type Fuente, type ChequeOp, type Benchmarks, type TipoFuente, type TipoTasa, type Moneda } from '@/lib/cfpp/types';
import { avisar, confirmar } from '@/components/feedback';
import { CargandoPagina } from '@/components/Cargando';
import { AyudaTab } from './_componentes/AyudaTab';
import { DatosTab } from './_componentes/DatosTab';
import { ResultadosTab } from './_componentes/ResultadosTab';
import { TabButton } from './_componentes/campos';
import { BENCHMARKS_VACIO, EJERCICIOS_DEFAULT, Tab } from './_componentes/tipos';

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
    if (error) { avisar('Error al crear: ' + error.message); return; }
    setFuentes(prev => [...prev, data as any]);
  }

  async function actualizarFuente(id: string, cambios: Partial<Fuente>) {
    setFuentes(prev => prev.map(f => f.id === id ? { ...f, ...cambios } as Fuente : f));
    const { error } = await supabase.from('cfpp_fuentes').update(cambios).eq('id', id);
    if (error) avisar('Error al guardar: ' + error.message);
  }

  async function eliminarFuente(id: string) {
    if (!(await confirmar('¿Eliminar esta fuente?'))) return;
    const { error } = await supabase.from('cfpp_fuentes').delete().eq('id', id);
    if (error) { avisar('Error al eliminar: ' + error.message); return; }
    setFuentes(prev => prev.filter(f => f.id !== id));
  }

  async function duplicarFuente(id: string) {
    if (!userId) return;
    const f = fuentes.find(x => x.id === id);
    if (!f) return;
    const meses = mesesDeEjercicio(ejercicio);
    const idx = meses.indexOf(f.mes);
    if (idx === -1 || idx === meses.length - 1) { avisar('No hay mes siguiente en este ejercicio.'); return; }
    const { id: _, created_at, updated_at, ...rest } = f as any;
    const nueva = { ...rest, mes: meses[idx + 1] };
    const { data, error } = await supabase.from('cfpp_fuentes').insert(nueva).select('*').single();
    if (error) { avisar('Error: ' + error.message); return; }
    setFuentes(prev => [...prev, data as any]);
  }

  async function duplicarMesAnterior() {
    if (!mesFiltro) { avisar('Primero filtrá por el mes destino.'); return; }
    const meses = mesesDeEjercicio(ejercicio);
    const idx = meses.indexOf(mesFiltro);
    if (idx <= 0) { avisar('No hay mes anterior en este ejercicio.'); return; }
    const mesAnterior = meses[idx - 1];
    const fuentesAnt = fuentes.filter(f => f.mes === mesAnterior);
    if (fuentesAnt.length === 0) { avisar(`No hay fuentes en ${nombreMesAbr(mesAnterior)}.`); return; }
    if (!(await confirmar(`Copiar ${fuentesAnt.length} fuente(s) de ${nombreMesAbr(mesAnterior)} a ${nombreMesAbr(mesFiltro)}?`))) return;
    if (!userId) return;
    const nuevas = fuentesAnt.map(f => {
      const { id, created_at, updated_at, ...rest } = f as any;
      return { ...rest, mes: mesFiltro };
    });
    const { data, error } = await supabase.from('cfpp_fuentes').insert(nuevas).select('*');
    if (error) { avisar('Error: ' + error.message); return; }
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
    if (error) { avisar('Error: ' + error.message); return; }
    setCheques(prev => [...prev, data as any]);
  }

  async function actualizarCheque(id: string, cambios: Partial<ChequeOp>) {
    setCheques(prev => prev.map(c => c.id === id ? { ...c, ...cambios } as ChequeOp : c));
    const { error } = await supabase.from('cfpp_cheques').update(cambios).eq('id', id);
    if (error) avisar('Error al guardar: ' + error.message);
  }

  async function eliminarCheque(id: string) {
    if (!(await confirmar('¿Eliminar esta operación?'))) return;
    const { error } = await supabase.from('cfpp_cheques').delete().eq('id', id);
    if (error) { avisar('Error: ' + error.message); return; }
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
    if (error) avisar('Error al guardar benchmarks: ' + error.message);
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

  if (!ready) return <AppShell><CargandoPagina /></AppShell>;

  if (!autorizado) {
    return (
      <AppShell>
        <TopBar titulo="Acceso denegado" />
        <div className="px-4 sm:px-6 py-5 max-w-xl">
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

      <div className="px-4 sm:px-6 py-5 space-y-4">
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
