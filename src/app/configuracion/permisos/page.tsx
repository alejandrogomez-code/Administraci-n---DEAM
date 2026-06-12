'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';

const ROLES = ['admin', 'usuario_admin_1', 'usuario_admin_2', 'usuario_admin_3'];
const MODULOS_DEFAULT = ['contabilidad.cierres', 'contabilidad.iva', 'configuracion'];

type Perm = {
  id: string;
  rol: string;
  modulo: string;
  puede_ver: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
};

export default function PermisosPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Perm[]>([]);
  const [modulos, setModulos] = useState<string[]>(MODULOS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: p } = await supabase.from('profiles').select('rol').eq('id', user!.id).single();
    setEsAdmin(p?.rol === 'admin');
    const { data } = await supabase.from('role_permissions').select('*').order('rol').order('modulo');
    setItems((data as any) ?? []);
    const mods = Array.from(new Set([...MODULOS_DEFAULT, ...((data ?? []).map((x: any) => x.modulo))]));
    setModulos(mods);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function actualizar(p: Perm | null, rol: string, modulo: string, cambio: Partial<Perm>) {
    if (p) {
      await supabase.from('role_permissions').update(cambio).eq('id', p.id);
      setItems((arr) => arr.map((x) => x.id === p.id ? { ...x, ...cambio } as any : x));
    } else {
      const ins = { rol, modulo, puede_ver: false, puede_editar: false, puede_eliminar: false, ...cambio };
      const { data } = await supabase.from('role_permissions').insert(ins).select('*').single();
      if (data) setItems((arr) => [...arr, data as any]);
    }
  }

  const getPerm = (rol: string, modulo: string) => items.find((x) => x.rol === rol && x.modulo === modulo) ?? null;

  async function agregarModulo() {
    const nombre = prompt('Nombre del módulo (ej: contabilidad.libros, instructivos):');
    if (!nombre) return;
    setModulos((m) => Array.from(new Set([...m, nombre.trim()])));
  }

  return (
    <AppShell>
      <TopBar
        titulo="Permisos por rol"
        subtitulo={esAdmin ? 'Modificá los checkboxes para cambiar permisos' : 'Solo lectura — necesitás ser admin para editar'}
        actions={<>
          <Link href="/configuracion" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>
          {esAdmin && <button onClick={agregarModulo} className="btn-secondary"><Plus size={14}/> Módulo</button>}
        </>}
      />
      <div className="p-6">
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : (
            <table className="tbl min-w-[800px]">
              <thead>
                <tr>
                  <th>Módulo</th>
                  {ROLES.map((r) => <th key={r} className="text-center">{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {modulos.map((m) => (
                  <tr key={m}>
                    <td className="font-medium text-sm whitespace-nowrap">{m}</td>
                    {ROLES.map((r) => {
                      const p = getPerm(r, m);
                      return (
                        <td key={r} className="text-center">
                          <div className="flex justify-center gap-2 text-xs">
                            <CheckBox label="Ver" checked={!!p?.puede_ver} disabled={!esAdmin}
                              onChange={(v) => actualizar(p, r, m, { puede_ver: v })} />
                            <CheckBox label="Editar" checked={!!p?.puede_editar} disabled={!esAdmin}
                              onChange={(v) => actualizar(p, r, m, { puede_editar: v })} />
                            <CheckBox label="Eliminar" checked={!!p?.puede_eliminar} disabled={!esAdmin}
                              onChange={(v) => actualizar(p, r, m, { puede_eliminar: v })} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-muted mt-3">
          Los permisos se aplican en la UI. La base de datos también tiene políticas RLS que requieren al menos sesión iniciada.
        </p>
      </div>
    </AppShell>
  );
}

function CheckBox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-1 cursor-pointer select-none">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
