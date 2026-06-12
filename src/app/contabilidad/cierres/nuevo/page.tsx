'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { MESES, nombreMes } from '@/lib/format';

type Template = {
  id: string;
  orden: number;
  nombre: string;
  descripcion: string | null;
  dia_objetivo_1: number | null;
  dia_objetivo_2: number | null;
  responsable_default: string | null;
};

type Profile = { id: string; nombre: string };

export default function NuevoCierrePage() {
  const router = useRouter();
  const supabase = createClient();
  const hoy = new Date();
  const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);

  const [mes, setMes] = useState(mesPasado.getMonth() + 1);
  const [anio, setAnio] = useState(mesPasado.getFullYear());
  const [responsable, setResponsable] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: tpl } = await supabase.from('closing_task_templates').select('*').eq('activo', true).order('orden');
      setTemplates(tpl ?? []);
      const { data: profs } = await supabase.from('profiles').select('id, nombre').eq('activo', true).order('nombre');
      setProfiles(profs ?? []);
    })();
  }, []);

  // Calcula fecha objetivo en base al día del mes SIGUIENTE al cierre
  function fechaObjetivo(dia: number | null): string | null {
    if (!dia) return null;
    // mes siguiente = mes + 1
    const m = mes === 12 ? 1 : mes + 1;
    const a = mes === 12 ? anio + 1 : anio;
    const d = new Date(a, m - 1, dia);
    return d.toISOString().slice(0, 10);
  }

  async function crear() {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // último día del mes siguiente como fecha estimada de cierre por defecto
      const ms = mes === 12 ? 1 : mes + 1;
      const ay = mes === 12 ? anio + 1 : anio;
      const finMesSig = new Date(ay, ms, 0).toISOString().slice(0, 10);

      const { data: cl, error: e1 } = await supabase
        .from('accounting_closings')
        .insert({
          mes, anio,
          fecha_estimada_cierre: finMesSig,
          estado: 'pendiente',
          responsable_principal: responsable || null,
          created_by: user?.id,
        })
        .select('id')
        .single();
      if (e1) throw e1;

      // Crear tareas desde templates
      const tareas = templates.map((t) => ({
        closing_id: cl.id,
        template_id: t.id,
        orden: t.orden,
        nombre: t.nombre,
        descripcion: t.descripcion,
        responsable_id: t.responsable_default ?? responsable ?? null,
        fecha_estimada: fechaObjetivo(t.dia_objetivo_1),
        fecha_estimada_2: fechaObjetivo(t.dia_objetivo_2),
        estado: 'pendiente',
      }));
      if (tareas.length) {
        const { error: e2 } = await supabase.from('accounting_closing_tasks').insert(tareas);
        if (e2) throw e2;
      }

      router.push(`/contabilidad/cierres/${cl.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el cierre.');
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <TopBar
        titulo="Nuevo cierre del mes"
        subtitulo={`${nombreMes(mes)} ${anio}`}
        actions={<Link href="/contabilidad/cierres" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6 max-w-3xl space-y-6">
        <div className="card p-5 space-y-4">
          <h3 className="font-medium">Período a cerrar</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Mes</label>
              <select className="input" value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
                {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Año</label>
              <input type="number" className="input" value={anio} onChange={(e) => setAnio(parseInt(e.target.value)||anio)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Responsable principal (opcional)</label>
            <select className="input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">Sin asignar</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Tareas que se van a crear ({templates.length})</h3>
            <Link href="/configuracion/tareas-modelo" className="text-xs text-primary">Editar tareas modelo</Link>
          </div>
          <p className="text-xs text-muted mb-3">
            Las fechas se calculan automáticamente sobre el mes siguiente al cierre.
          </p>
          <table className="tbl">
            <thead><tr><th>#</th><th>Tarea</th><th>Fecha objetivo</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="text-muted">{t.orden}</td>
                  <td>
                    <div className="font-medium text-sm">{t.nombre}</div>
                    {t.descripcion && <div className="text-xs text-muted">{t.descripcion}</div>}
                  </td>
                  <td className="text-xs whitespace-nowrap">
                    {t.dia_objetivo_1 && <div>Día {t.dia_objetivo_1} del mes siguiente</div>}
                    {t.dia_objetivo_2 && <div>Día {t.dia_objetivo_2} del mes siguiente</div>}
                    {!t.dia_objetivo_1 && !t.dia_objetivo_2 && <div className="text-muted">Sin fecha</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <div className="text-sm text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <Link href="/contabilidad/cierres" className="btn-secondary">Cancelar</Link>
          <button onClick={crear} disabled={loading} className="btn-primary">
            {loading ? 'Creando...' : 'Crear cierre y tareas'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
