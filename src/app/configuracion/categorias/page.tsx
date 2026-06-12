'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';

type Categoria = {
  id: string;
  tipo: string;
  nombre: string;
  activo: boolean;
};

const TIPOS_DEFAULT = ['instructivo', 'cierre_tarea', 'iva', 'otro'];

export default function CategoriasPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Categoria[]>([]);
  const [tipoSel, setTipoSel] = useState<string>('instructivo');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('categorias').select('*').order('tipo').order('nombre');
    setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const tipos = useMemo(() => {
    const all = new Set<string>(TIPOS_DEFAULT);
    items.forEach((x) => all.add(x.tipo));
    return Array.from(all);
  }, [items]);

  const filtradas = items.filter((c) => c.tipo === tipoSel);

  async function agregar() {
    if (!nuevoNombre.trim()) return;
    await supabase.from('categorias').insert({ tipo: tipoSel, nombre: nuevoNombre.trim(), activo: true });
    setNuevoNombre('');
    load();
  }

  async function eliminar(c: Categoria) {
    if (!confirm(`Eliminar "${c.nombre}"?`)) return;
    await supabase.from('categorias').delete().eq('id', c.id);
    load();
  }

  async function toggleActivo(c: Categoria) {
    await supabase.from('categorias').update({ activo: !c.activo }).eq('id', c.id);
    setItems((arr) => arr.map((x) => x.id === c.id ? { ...x, activo: !c.activo } : x));
  }

  async function agregarTipo() {
    const t = prompt('Nombre del nuevo tipo (ej: proveedor, banco):');
    if (!t) return;
    setTipoSel(t.trim());
  }

  return (
    <AppShell>
      <TopBar
        titulo="Categorías"
        subtitulo="Etiquetas para clasificar instructivos, tareas de cierre y otros ítems"
        actions={<Link href="/configuracion" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6 max-w-3xl space-y-4">
        <div className="card p-4">
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs text-muted">Tipo de categoría</label>
              <div className="flex gap-2 items-center">
                <select className="input !w-auto" value={tipoSel} onChange={(e) => setTipoSel(e.target.value)}>
                  {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={agregarTipo} className="btn-ghost text-sm"><Plus size={14}/> Nuevo tipo</button>
              </div>
            </div>
            <div className="flex-1 min-w-64">
              <label className="text-xs text-muted">Agregar categoría a “{tipoSel}”</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Nombre de la categoría"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregar()}
                />
                <button className="btn-primary" onClick={agregar}>Agregar</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-muted">Cargando...</div>
          ) : filtradas.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">Sin categorías en este tipo todavía.</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Nombre</th><th>Activa</th><th></th></tr></thead>
              <tbody>
                {filtradas.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-sm">{c.nombre}</td>
                    <td>
                      <input type="checkbox" checked={c.activo} onChange={() => toggleActivo(c)} className="cursor-pointer" />
                    </td>
                    <td>
                      <button className="text-danger text-xs" onClick={() => eliminar(c)}><Trash2 size={12} className="inline"/> Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
