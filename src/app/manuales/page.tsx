'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, X } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { avisar } from '@/components/feedback';
import { Cargando } from '@/components/Cargando';
import FilaManual, { SeccionChip } from './_componentes/FilaManual';
import ManualModal from './_componentes/ManualModal';
import { abrir } from './_componentes/acciones';
import { Manual, Modulo, coincide, manualVacio, temasPorModulo } from './_componentes/tipos';

export default function ManualesPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Manual[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [editing, setEditing] = useState<Manual | null>(null);

  async function load() {
    const [man, mod] = await Promise.all([
      supabase.from('manuales').select('*').order('titulo'),
      supabase.from('manual_modulos').select('*').order('orden').order('nombre'),
    ]);
    if (mod.error) avisar('Falta ejecutar la migración de Manuales (supabase/migraciones/2026-09_manuales_odoo.sql).', 'error');
    setItems((man.data as Manual[]) ?? []);
    setModulos((mod.data as Modulo[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const porId = useMemo(() => new Map(modulos.map((m) => [m.id, m])), [modulos]);
  const visibles = items.filter((m) => verInactivos || m.activo);
  const q = buscar.trim();
  const resultados = q ? visibles.filter((m) => coincide(m, q, m.modulo_id ? porId.get(m.modulo_id) : undefined)) : [];

  const cantidad = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of items) if (m.activo && m.modulo_id) c[m.modulo_id] = (c[m.modulo_id] ?? 0) + 1;
    return c;
  }, [items]);

  const modulosOdoo = modulos.filter((m) => m.seccion === 'odoo' && m.activo);
  const moduloVisible = (id: string | null) => !!id && !!porId.get(id)?.activo;
  const gruposInternos = modulos
    .filter((m) => m.seccion === 'interno' && m.activo)
    .map((mod) => ({ mod, items: visibles.filter((m) => m.modulo_id === mod.id) }))
    .filter((g) => g.items.length > 0);
  const sinClasificar = visibles.filter((m) => !moduloVisible(m.modulo_id));

  const recientes = [...items]
    .filter((m) => m.activo)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .slice(0, 5);

  const fila = (m: Manual, extra: { mostrarModulo?: boolean } = {}) => (
    <FilaManual
      key={m.id}
      m={m}
      modulo={m.modulo_id ? porId.get(m.modulo_id) : undefined}
      onEditar={setEditing}
      onEliminado={load}
      {...extra}
    />
  );

  return (
    <AppShell>
      <TopBar
        titulo="Manuales y Capacitaciones"
        subtitulo="Guías paso a paso, instructivos y grabaciones"
        actions={<button onClick={() => setEditing(manualVacio())} className="btn-primary"><Plus size={14} /> Nuevo</button>}
      />

      <div className="px-4 sm:px-6 py-5 space-y-6">
        <section className="flex flex-col items-center gap-3 pt-1">
          <h2 className="text-lg sm:text-xl font-semibold">¿Qué necesitás hacer?</h2>
          <label className="w-full max-w-3xl card shadow-card flex items-center gap-3 px-4 h-[52px] focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary">
            <Search size={18} className="text-muted shrink-0" aria-hidden />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscá por tarea o palabra clave: factura de proveedor, conciliación, libro IVA…"
              aria-label="Buscar manuales"
              className="flex-1 min-w-0 bg-transparent outline-none text-[0.95rem]"
            />
            {buscar && (
              <button onClick={() => setBuscar('')} className="text-muted hover:text-text" aria-label="Limpiar búsqueda"><X size={16} /></button>
            )}
          </label>
        </section>

        {loading ? (
          <Cargando filas={6} enTarjeta />
        ) : q ? (
          <section className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm">
              {resultados.length} resultado{resultados.length === 1 ? '' : 's'} para “{q}”
            </div>
            {resultados.length === 0 ? (
              <div className="p-10 text-center text-muted text-sm">
                No encontramos manuales con esas palabras. Probá con otra palabra o <button className="text-primary" onClick={() => setEditing(manualVacio())}>cargá uno nuevo</button>.
              </div>
            ) : resultados.map((m) => fila(m, { mostrarModulo: true }))}
          </section>
        ) : (
          <>
            <section className="rounded-[16px] border border-cta/40 bg-cta/[0.07] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold">Guías de Odoo por módulo</h2>
                <span className="chip bg-cta text-cta-fg font-semibold">Sistema nuevo</span>
              </div>
              {modulosOdoo.length === 0 ? (
                <p className="text-sm text-muted">Todavía no hay módulos de Odoo. Se crean desde el formulario al cargar la primera guía.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {modulosOdoo.map((mod) => {
                    const n = cantidad[mod.id] ?? 0;
                    return (
                      <Link
                        key={mod.id}
                        href={`/manuales/modulo/${mod.id}`}
                        className="card p-4 flex flex-col gap-1.5 hover:border-primary/50 hover:shadow-card transition"
                      >
                        <span className="font-semibold">{mod.nombre}</span>
                        {mod.descripcion && <span className="text-sm text-muted leading-snug">{mod.descripcion}</span>}
                        <span className="mt-auto pt-2 flex justify-between items-center text-xs">
                          <span className="text-muted">{n === 0 ? 'Sin guías todavía' : `${n} guía${n === 1 ? '' : 's'}`}</span>
                          <span className="text-primary font-semibold text-sm">Abrir</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
              <section className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">Manuales internos DEAM</h2>
                    <p className="text-xs text-muted">Procedimientos propios, por área</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Mostrar inactivos
                  </label>
                </div>

                {gruposInternos.length === 0 && sinClasificar.length === 0 && (
                  <div className="p-10 text-center text-muted text-sm">
                    No hay manuales internos. <button className="text-primary" onClick={() => setEditing(manualVacio())}>Cargar el primero</button>.
                  </div>
                )}

                {gruposInternos.map(({ mod, items: lista }) => (
                  <div key={mod.id}>
                    <div className="px-4 py-2 bg-surface-2 border-b border-border flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted">{mod.nombre}</span>
                      <Link href={`/manuales/modulo/${mod.id}`} className="text-primary">Ver área</Link>
                    </div>
                    {lista.map((m) => fila(m))}
                  </div>
                ))}

                {sinClasificar.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-surface-2 border-b border-border text-xs">
                      <span className="font-semibold text-muted">Sin clasificar</span>
                      <span className="text-muted"> · Editalos para asignarles un módulo o área</span>
                    </div>
                    {sinClasificar.map((m) => fila(m))}
                  </div>
                )}
              </section>

              <aside className="card p-4">
                <h2 className="font-semibold mb-2">Actualizado recientemente</h2>
                {recientes.length === 0 ? (
                  <p className="text-sm text-muted">Todavía no hay manuales.</p>
                ) : (
                  <ul>
                    {recientes.map((m) => {
                      const mod = m.modulo_id ? porId.get(m.modulo_id) : undefined;
                      return (
                        <li key={m.id} className="py-2.5 border-b border-border/70 last:border-b-0">
                          <button onClick={() => abrir(m)} className="text-left text-sm font-medium hover:text-primary">{m.titulo}</button>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                            {mod && <SeccionChip seccion={mod.seccion} />}
                            {new Date(m.updated_at).toLocaleDateString('es-AR')}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      {editing && (
        <ManualModal
          inicial={editing}
          modulos={modulos}
          temas={temasPorModulo(items)}
          onCerrar={() => setEditing(null)}
          onGuardado={() => { setEditing(null); load(); }}
          onModuloCreado={(m) => setModulos((l) => [...l, m])}
        />
      )}
    </AppShell>
  );
}
