'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';

type Miembro = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export default function EquipoPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Miembro[]>([]);
  const [nuevo, setNuevo] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('team_members').select('*').order('orden').order('nombre');
    setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function agregar() {
    if (!nuevo.trim()) return;
    const maxOrden = items.reduce((m, x) => Math.max(m, x.orden), 0) + 1;
    const { error } = await supabase.from('team_members').insert({ nombre: nuevo.trim(), orden: maxOrden, activo: true });
    if (error) { alert(error.message); return; }
    setNuevo('');
    load();
  }

  async function actualizar(m: Miembro, cambios: Partial<Miembro>) {
    await supabase.from('team_members').update(cambios).eq('id', m.id);
    setItems((arr) => arr.map((x) => x.id === m.id ? { ...x, ...cambios } : x));
  }

  async function eliminar(m: Miembro) {
    if (!confirm(`¿Eliminar a "${m.nombre}"? Las tareas asignadas pasarán a "Sin asignar".`)) return;
    await supabase.from('team_members').delete().eq('id', m.id);
    load();
  }

  return (
    <AppShell>
      <TopBar
        titulo="Equipo (responsables)"
        subtitulo="Personas que pueden ser asignadas como responsables de tareas. Independiente de los usuarios con login en la app."
        actions={<Link href="/configuracion" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6 max-w-2xl space-y-4">
        <div className="card p-4">
          <label className="text-xs text-muted">Agregar persona</label>
          <div className="flex gap-2 mt-1">
            <input
              className="input"
              placeholder="Nombre"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
            />
            <button className="btn-primary" onClick={agregar}><Plus size={14}/> Agregar</button>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">Sin miembros todavía.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Orden</th><th>Nombre</th><th>Activo</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className={!m.activo ? 'opacity-50' : ''}>
                    <td className="w-20">
                      <input
                        type="number"
                        className="input !py-1 text-sm"
                        defaultValue={m.orden}
                        onBlur={(e) => { const n = parseInt(e.target.value) || 0; if (n !== m.orden) actualizar(m, { orden: n }); }}
                      />
                    </td>
                    <td>
                      <input
                        className="input !py-1 text-sm"
                        defaultValue={m.nombre}
                        onBlur={(e) => { if (e.target.value && e.target.value !== m.nombre) actualizar(m, { nombre: e.target.value }); }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={m.activo}
                        onChange={(e) => actualizar(m, { activo: e.target.checked })}
                        className="cursor-pointer"
                      />
                    </td>
                    <td>
                      <button className="text-danger text-xs" onClick={() => eliminar(m)}><Trash2 size={12} className="inline"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-muted">
          Estas personas no necesitan tener login en la app. Si querés que alguien pueda iniciar sesión, registralo desde la pantalla de login y luego asignale rol en Configuración → Usuarios.
        </p>
      </div>
    </AppShell>
  );
}
