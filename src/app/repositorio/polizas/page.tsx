'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Search } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { avisar, confirmar } from '@/components/feedback';
import { Cargando } from '@/components/Cargando';
import { PolizaModal } from './_componentes/PolizaModal';
import { FilaAlerta, GrupoRow, TablaPolizas, VacioRow } from './_componentes/TablaPolizas';
import { ADJUNTOS, AdjuntoKey, BUCKET, DIAS_AVISO, Jurisdiccion, Poliza, hoy0, norm, parseISODate, sanitizeKey } from './_componentes/utils';

export default function PolizasPage() {
  const supabase = createClient();
  const [jurs, setJurs] = useState<Jurisdiccion[]>([]);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Poliza | null>(null);
  const [busy, setBusy] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtroJur, setFiltroJur] = useState<string>('todas');

  async function load() {
    setLoading(true);
    const [{ data: j }, { data: p }] = await Promise.all([
      supabase.from('repo_jurisdicciones').select('*').order('orden').order('nombre'),
      supabase.from('repo_polizas').select('*').order('vencimiento', { ascending: true }),
    ]);
    setJurs((j as any) ?? []);
    setPolizas((p as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const jurById = useMemo(() => {
    const m: Record<string, Jurisdiccion> = {};
    jurs.forEach((j) => { m[j.id] = j; });
    return m;
  }, [jurs]);

  // Vigentes = no finalizadas ; Finalizadas = cerradas / dadas de baja
  const vigentes = useMemo(() => polizas.filter((p) => !p.finalizada), [polizas]);
  const finalizadas = useMemo(() => polizas.filter((p) => p.finalizada), [polizas]);

  // ---------- alertas (solo sobre pólizas vigentes) ----------
  const { vencidas, proximas, avisosBaja } = useMemo(() => {
    const hoy = hoy0();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + DIAS_AVISO);

    const conVenc = vigentes.filter((p) => p.vencimiento);
    const vencidas = conVenc
      .filter((p) => parseISODate(p.vencimiento!) < hoy)
      .sort((a, b) => parseISODate(a.vencimiento!).getTime() - parseISODate(b.vencimiento!).getTime());
    const proximas = conVenc
      .filter((p) => {
        const f = parseISODate(p.vencimiento!);
        return f >= hoy && f <= limite;
      })
      .sort((a, b) => parseISODate(a.vencimiento!).getTime() - parseISODate(b.vencimiento!).getTime());

    const avisosBaja = vigentes
      .filter((p) => p.aviso_baja && parseISODate(p.aviso_baja) <= limite)
      .sort((a, b) => parseISODate(a.aviso_baja!).getTime() - parseISODate(b.aviso_baja!).getTime());

    return { vencidas, proximas, avisosBaja };
  }, [vigentes]);

  // ---------- acciones ----------
  function nuevaPoliza() {
    setEditing({
      id: '', jurisdiccion_id: jurs[0]?.id ?? '', fecha_alta: new Date().toISOString().slice(0, 10),
      empresa: '', monto_asegurado: null, vencimiento: null, fecha_revision: null,
      aviso_baja: null, baja_link: '', poliza_url: null, poliza_nombre: null,
      cert_url: null, cert_nombre: null, factura_url: null, factura_nombre: null,
      detalle: '', finalizada: false, orden: 0, created_at: '', updated_at: '',
    });
  }

  async function subirArchivo(jurId: string, tipo: AdjuntoKey, file: File): Promise<string> {
    const ts = Date.now();
    const path = `polizas/${jurId}/${ts}_${tipo}_${sanitizeKey(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  async function guardar(files: Record<AdjuntoKey, File | null>) {
    if (!editing) return;
    if (!editing.empresa.trim()) { avisar('La empresa de seguros es obligatoria.'); return; }
    if (!editing.jurisdiccion_id) { avisar('Elegí una jurisdicción.'); return; }
    setBusy(true);
    try {
      const payload: any = {
        jurisdiccion_id: editing.jurisdiccion_id,
        fecha_alta: editing.fecha_alta || null,
        empresa: editing.empresa.trim(),
        monto_asegurado: editing.monto_asegurado,
        vencimiento: editing.vencimiento || null,
        fecha_revision: editing.fecha_revision || null,
        aviso_baja: editing.aviso_baja || null,
        baja_link: editing.baja_link?.trim() || null,
        poliza_url: editing.poliza_url, poliza_nombre: editing.poliza_nombre,
        cert_url: editing.cert_url, cert_nombre: editing.cert_nombre,
        factura_url: editing.factura_url, factura_nombre: editing.factura_nombre,
        detalle: editing.detalle?.trim() || null,
        finalizada: editing.finalizada,
      };

      for (const { key, urlKey, nomKey } of ADJUNTOS) {
        const f = files[key];
        if (f) {
          payload[urlKey] = await subirArchivo(editing.jurisdiccion_id, key, f);
          payload[nomKey] = f.name;
        }
      }

      if (editing.id) {
        await supabase.from('repo_polizas').update(payload).eq('id', editing.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('repo_polizas').insert({ ...payload, created_by: user?.id });
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      avisar(err.message ?? 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFinalizada(p: Poliza) {
    const nueva = !p.finalizada;
    const verbo = nueva ? 'cerrar / finalizar' : 'reabrir';
    if (!(await confirmar(`¿Querés ${verbo} la póliza de "${p.empresa}"?`))) return;
    await supabase.from('repo_polizas').update({ finalizada: nueva }).eq('id', p.id);
    load();
  }

  async function eliminar(p: Poliza) {
    if (!(await confirmar(`¿Eliminar la póliza de "${p.empresa}"? También se borrarán los archivos adjuntos.`))) return;
    const archivos = [p.poliza_url, p.cert_url, p.factura_url].filter(Boolean) as string[];
    if (archivos.length) await supabase.storage.from(BUCKET).remove(archivos);
    await supabase.from('repo_polizas').delete().eq('id', p.id);
    load();
  }

  async function descargar(url: string | null, nombre: string | null) {
    if (!url) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(url, 60);
    if (error || !data?.signedUrl) { avisar('No se pudo generar el enlace.'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = nombre ?? 'archivo';
    a.click();
  }

  // ---------- filtros (aplican a ambos recuadros) ----------
  function aplicarFiltros(lista: Poliza[]): Poliza[] {
    const q = norm(buscar);
    return lista.filter((p) => {
      if (filtroJur !== 'todas' && p.jurisdiccion_id !== filtroJur) return false;
      if (!q) return true;
      return norm(p.empresa).includes(q)
        || norm(jurById[p.jurisdiccion_id]?.nombre ?? '').includes(q)
        || norm(p.detalle ?? '').includes(q);
    });
  }
  const vigentesFiltradas = useMemo(() => aplicarFiltros(vigentes), [vigentes, buscar, filtroJur, jurById]);
  const finalizadasFiltradas = useMemo(() => aplicarFiltros(finalizadas), [finalizadas, buscar, filtroJur, jurById]);

  const hoy = hoy0();

  return (
    <AppShell>
      <TopBar
        titulo="Gestión de Pólizas"
        subtitulo="Pólizas de seguros por jurisdicción"
        actions={
          <>
            <button onClick={load} className="btn-ghost" title="Refrescar"><RefreshCcw size={14} /></button>
            <button onClick={nuevaPoliza} className="btn-primary" disabled={jurs.length === 0}>
              <Plus size={14} /> Nueva póliza
            </button>
          </>
        }
      />

      <div className="px-4 sm:px-6 py-5 space-y-4">
        {loading ? (
          <Cargando filas={6} enTarjeta />
        ) : jurs.length === 0 ? (
          <div className="card p-10 text-center text-muted text-sm">
            No hay jurisdicciones cargadas todavía. Creá al menos una desde{' '}
            <a href="/repositorio" className="text-primary hover:underline">Repositorio → Gestionar jurisdicciones</a>{' '}
            para poder dar de alta pólizas.
          </div>
        ) : (
          <>
            {/* ---------- Panel de alertas ---------- */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="text-xs text-muted">Vencidas</div>
                <div className="text-2xl font-semibold text-danger">{vencidas.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-muted">Próximas a vencer ({DIAS_AVISO} días)</div>
                <div className="text-2xl font-semibold text-warning">{proximas.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-muted">Avisos de baja ({DIAS_AVISO} días)</div>
                <div className="text-2xl font-semibold text-warning">{avisosBaja.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-muted">Vigentes</div>
                <div className="text-2xl font-semibold">{vigentes.length}</div>
              </div>
            </div>

            {(vencidas.length > 0 || proximas.length > 0 || avisosBaja.length > 0) && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tbl min-w-[680px]">
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Jurisdicción</th>
                        <th>Fecha</th>
                        <th>Plazo</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <GrupoRow titulo="Vencidas" color="danger" />
                      {vencidas.length === 0
                        ? <VacioRow msg="Sin pólizas vencidas." />
                        : vencidas.map((p) => <FilaAlerta key={p.id} p={p} campo="vencimiento" jurById={jurById} hoy={hoy} onIr={setEditing} />)}

                      <GrupoRow titulo={`Próximas a vencer (${DIAS_AVISO} días)`} color="warning" />
                      {proximas.length === 0
                        ? <VacioRow msg="Sin pólizas próximas a vencer." />
                        : proximas.map((p) => <FilaAlerta key={p.id} p={p} campo="vencimiento" jurById={jurById} hoy={hoy} onIr={setEditing} />)}

                      <GrupoRow titulo={`Avisos de baja próximos (${DIAS_AVISO} días)`} color="warning" />
                      {avisosBaja.length === 0
                        ? <VacioRow msg="Sin avisos de baja próximos." />
                        : avisosBaja.map((p) => <FilaAlerta key={p.id} p={p} campo="aviso_baja" jurById={jurById} hoy={hoy} onIr={setEditing} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---------- Filtros ---------- */}
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <select className="input !w-auto !py-1.5 text-sm" value={filtroJur} onChange={(e) => setFiltroJur(e.target.value)}>
                <option value="todas">Todas las jurisdicciones</option>
                {jurs.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
              </select>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input className="input !w-56 !py-1.5 !pl-8 text-sm" placeholder="Buscar empresa..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              </div>
            </div>

            {/* ---------- Recuadro: Pólizas vigentes ---------- */}
            <TablaPolizas
              titulo="Pólizas vigentes"
              variante="vigentes"
              filas={vigentesFiltradas}
              totalSinFiltro={vigentes.length}
              jurById={jurById}
              onEdit={setEditing}
              onToggle={toggleFinalizada}
              onEliminar={eliminar}
              descargar={descargar}
              onNueva={nuevaPoliza}
            />

            {/* ---------- Recuadro: Pólizas cerradas / finalizadas ---------- */}
            <TablaPolizas
              titulo="Pólizas cerradas / finalizadas"
              variante="finalizadas"
              filas={finalizadasFiltradas}
              totalSinFiltro={finalizadas.length}
              jurById={jurById}
              onEdit={setEditing}
              onToggle={toggleFinalizada}
              onEliminar={eliminar}
              descargar={descargar}
            />
          </>
        )}
      </div>

      {editing && (
        <PolizaModal
          editing={editing} setEditing={setEditing} jurs={jurs}
          guardar={guardar} descargar={descargar} busy={busy}
        />
      )}
    </AppShell>
  );
}

// ===================== Filas de la tabla de alertas =====================
