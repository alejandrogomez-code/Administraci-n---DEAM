'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { avisar, confirmar, pedirTexto } from '@/components/feedback';
import { Cargando } from '@/components/Cargando';
import FilaManual, { SeccionChip } from '../../_componentes/FilaManual';
import ManualModal from '../../_componentes/ManualModal';
import {
  Manual, Modulo, SECCION_LABEL, TIPO_LABEL, TipoRecurso,
  coincide, manualVacio, temasPorModulo, tiposDe,
} from '../../_componentes/tipos';

const TODOS_LOS_TIPOS: TipoRecurso[] = ['pdf', 'video', 'link', 'archivo'];

export default function ModuloManualesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [items, setItems] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [tema, setTema] = useState('');
  const [tipos, setTipos] = useState<TipoRecurso[]>(TODOS_LOS_TIPOS);
  const [verInactivos, setVerInactivos] = useState(false);
  const [editing, setEditing] = useState<Manual | null>(null);

  async function load() {
    const [mod, man] = await Promise.all([
      supabase.from('manual_modulos').select('*').order('orden').order('nombre'),
      supabase.from('manuales').select('*').eq('modulo_id', id).order('titulo'),
    ]);
    setModulos((mod.data as Modulo[]) ?? []);
    setItems((man.data as Manual[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  const modulo = modulos.find((m) => m.id === id);

  const temas = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of items) if (m.activo || verInactivos) { const t = m.tema?.trim(); if (t) c[t] = (c[t] ?? 0) + 1; }
    return Object.entries(c).sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [items, verInactivos]);

  const tiposPresentes = useMemo(
    () => TODOS_LOS_TIPOS.filter((t) => items.some((m) => tiposDe(m).includes(t))),
    [items],
  );

  const filtrados = items.filter((m) => {
    if (!verInactivos && !m.activo) return false;
    if (tema && m.tema?.trim() !== tema) return false;
    const tm = tiposDe(m);
    if (tm.length && !tm.some((t) => tipos.includes(t))) return false;
    return coincide(m, buscar, modulo);
  });
  const totalActivos = items.filter((m) => m.activo).length;

  function alternarTipo(t: TipoRecurso) {
    setTipos((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  }

  async function editarModulo() {
    if (!modulo) return;
    const nombre = (await pedirTexto('Nombre', modulo.nombre))?.trim();
    if (!nombre) return;
    const descripcion = await pedirTexto('Descripción corta (se ve en la tarjeta)', modulo.descripcion ?? '');
    if (descripcion === null) return;
    const { error } = await supabase.from('manual_modulos')
      .update({ nombre, descripcion: descripcion.trim() || null }).eq('id', modulo.id);
    if (error) { avisar(error.message, 'error'); return; }
    avisar('Módulo actualizado.');
    load();
  }

  async function eliminarModulo() {
    if (!modulo) return;
    if (items.length) { avisar('Primero mové o eliminá los manuales de este módulo.', 'aviso'); return; }
    if (!(await confirmar(`¿Eliminar el módulo "${modulo.nombre}"?`))) return;
    const { error } = await supabase.from('manual_modulos').delete().eq('id', modulo.id);
    if (error) { avisar(error.message, 'error'); return; }
    router.push('/manuales');
  }

  if (!loading && !modulo) {
    return (
      <AppShell>
        <TopBar titulo="Módulo no encontrado" />
        <div className="px-4 sm:px-6 py-5 text-sm">
          Puede que se haya eliminado. <Link href="/manuales" className="text-primary">Volver a Manuales</Link>.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <nav aria-label="Ruta" className="px-4 sm:px-6 pt-5 -mb-3 flex items-center gap-1 text-sm text-muted">
        <Link href="/manuales" className="hover:text-primary">Manuales</Link>
        {modulo && <>
          <ChevronRight size={14} aria-hidden />
          <span>{SECCION_LABEL[modulo.seccion]}</span>
          <ChevronRight size={14} aria-hidden />
          <span className="text-text">{modulo.nombre}</span>
        </>}
      </nav>

      <TopBar
        titulo={modulo ? (
          <span className="inline-flex flex-wrap items-center gap-3">
            {modulo.seccion === 'odoo' ? `${modulo.nombre} en Odoo` : modulo.nombre}
            <SeccionChip seccion={modulo.seccion} />
          </span>
        ) : '…'}
        subtitulo={modulo?.descripcion ?? `${totalActivos} guía${totalActivos === 1 ? '' : 's'}`}
        actions={<>
          <button className="btn-ghost" onClick={editarModulo} aria-label="Editar módulo" title="Editar nombre y descripción"><Pencil size={14} /></button>
          {items.length === 0 && (
            <button className="btn-ghost text-danger" onClick={eliminarModulo} aria-label="Eliminar módulo" title="Eliminar módulo"><Trash2 size={14} /></button>
          )}
          <button className="btn-primary" onClick={() => setEditing(manualVacio(id))}><Plus size={14} /> Nueva guía</button>
        </>}
      />

      <div className="px-4 sm:px-6 py-5">
        {loading ? <Cargando filas={6} enTarjeta /> : (
          <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-5 items-start">
            <aside className="card p-3 space-y-4">
              <label className="flex items-center gap-2 input !py-1.5">
                <Search size={15} className="text-muted shrink-0" aria-hidden />
                <input
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder={`Buscar en ${modulo?.nombre ?? 'el módulo'}…`}
                  aria-label="Buscar en el módulo"
                  className="flex-1 min-w-0 bg-transparent outline-none"
                />
              </label>

              {temas.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-xs font-semibold text-muted">Temas</div>
                  <div className="flex lg:flex-col flex-wrap gap-0.5">
                    {[['', totalActivos] as [string, number], ...temas].map(([t, n]) => (
                      <button
                        key={t || 'todos'}
                        onClick={() => setTema(t)}
                        aria-pressed={tema === t}
                        className={`flex justify-between gap-3 px-2.5 py-2 rounded-lg text-sm text-left ${tema === t ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-surface-2'}`}
                      >
                        <span>{t || 'Todos'}</span><span className={tema === t ? '' : 'text-muted text-xs'}>{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tiposPresentes.length > 1 && (
                <fieldset>
                  <legend className="px-2 pb-1 text-xs font-semibold text-muted">Tipo</legend>
                  <div className="flex lg:flex-col flex-wrap gap-x-3">
                    {tiposPresentes.map((t) => (
                      <label key={t} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                        <input type="checkbox" checked={tipos.includes(t)} onChange={() => alternarTipo(t)} /> {TIPO_LABEL[t]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <label className="flex items-center gap-2 px-2.5 text-xs text-muted">
                <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Mostrar inactivos
              </label>
            </aside>

            <section className="card overflow-hidden">
              <div className="hidden md:flex gap-4 px-4 py-2.5 bg-surface-2 border-b border-border text-[0.8rem] text-muted font-medium">
                <span className="flex-1">Guía</span>
                <span className="w-40">Tipo</span>
                <span className="w-24">Actualizada</span>
                <span className="w-[164px]" />
              </div>
              {filtrados.length === 0 ? (
                <div className="p-10 text-center text-muted text-sm">
                  {items.length === 0
                    ? <>Este módulo todavía no tiene guías. <button className="text-primary" onClick={() => setEditing(manualVacio(id))}>Cargar la primera</button>.</>
                    : 'Ninguna guía coincide con los filtros.'}
                </div>
              ) : filtrados.map((m) => (
                <FilaManual key={m.id} m={m} modulo={modulo} mostrarFecha onEditar={setEditing} onEliminado={load} />
              ))}
            </section>
          </div>
        )}
      </div>

      {editing && (
        <ManualModal
          inicial={editing}
          modulos={modulos}
          temas={temasPorModulo(items)}
          seccionInicial={modulo?.seccion}
          onCerrar={() => setEditing(null)}
          onGuardado={() => { setEditing(null); load(); }}
          onModuloCreado={(m) => setModulos((l) => [...l, m])}
        />
      )}
    </AppShell>
  );
}
