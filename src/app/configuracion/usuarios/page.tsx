'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { fmtFechaHora } from '@/lib/format';

type Profile = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
};

const ROLES = ['admin', 'usuario_admin_1', 'usuario_admin_2', 'usuario_admin_3', 'ventas'];

export default function UsuariosPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: meProf } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
    setMe(meProf as any);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function actualizar(p: Profile, cambio: Partial<Profile>) {
    await supabase.from('profiles').update(cambio).eq('id', p.id);
    setItems((arr) => arr.map((x) => x.id === p.id ? { ...x, ...cambio } as any : x));
  }

  const esAdmin = me?.rol === 'admin';

  return (
    <AppShell>
      <TopBar
        titulo="Usuarios"
        subtitulo={esAdmin ? 'Podés editar nombre, rol y estado' : 'Solo lectura (rol admin requerido para editar)'}
        actions={<Link href="/configuracion" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm">{items.length} usuario{items.length === 1 ? '' : 's'}</div>
            <button onClick={load} className="btn-ghost text-sm"><RefreshCcw size={14}/></button>
          </div>
          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Activo</th>
                  <th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        defaultValue={p.nombre}
                        disabled={!esAdmin && p.id !== me?.id}
                        onBlur={(e) => { if (e.target.value !== p.nombre) actualizar(p, { nombre: e.target.value }); }}
                        className="input !py-1 text-sm"
                      />
                    </td>
                    <td className="text-sm">{p.email}</td>
                    <td>
                      <select
                        value={p.rol}
                        disabled={!esAdmin}
                        onChange={(e) => actualizar(p, { rol: e.target.value })}
                        className="input !w-auto !py-1 text-sm"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.activo}
                        disabled={!esAdmin}
                        onChange={(e) => actualizar(p, { activo: e.target.checked })}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="text-xs text-muted">{fmtFechaHora(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 text-xs text-muted">
          Nuevos usuarios se crean autoregistrándose desde la pantalla de login. El primer registro queda como Administrador automáticamente.
        </div>
      </div>
    </AppShell>
  );
}
