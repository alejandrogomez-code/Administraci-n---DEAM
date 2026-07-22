'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';

type Template = {
  id: string;
  orden: number;
  rubro: string | null;
  nombre: string;
  descripcion: string | null;
  responsable_default: string | null;
};

type Miembro = { id: string; nombre: string };

const NOMBRES_TRIM = ['', '1° Trimestre (Abril a Junio)', '2° Trimestre (Julio a Septiembre)', '3° Trimestre (Octubre a Diciembre)', '4° Trimestre (Enero a Marzo)'];

// Último día del trimestre (fecha estimada de cierre)
function ultimoDiaTrimestre(trim: number, anio: number): string {
  const mesFin: Record<number, [number, number]> = {
    1: [5, anio],       // junio → mes 6, día 30 (índice mes 5 en Date + 0)
    2: [8, anio],       // septiembre → mes 9
    3: [11, anio],      // diciembre → mes 12
    4: [2, anio + 1],   // marzo del año siguiente
  };
  const [m, a] = mesFin[trim];
  // último día del mes m (0-indexed) → new Date(a, m+1, 0)
  const d = new Date(a, m + 1, 0);
  return d.toISOString().slice(0, 10);
}

export default function NuevoTrimestrePage() {
  const router = useRouter();
  const supabase = createClient();
  const hoy = new Date();

  const [trimestre, setTrimestre] = useState(1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [responsable, setResponsable] = useState('');
  const [auditor, setAuditor] = useState('Grupo Conforto');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: tpl } = await supabase.from('audit_task_templates').select('*').eq('activo', true).order('orden');
      setTemplates(tpl ?? []);
      const { data: ms } = await supabase.from('team_members').select('id, nombre').eq('activo', true).order('orden').order('nombre');
      setMiembros(ms ?? []);
    })();
  }, []);

  // Agrupar templates por rubro (manteniendo orden)
  const gruposTemplates = useMemo(() => {
    const map = new Map<string, Template[]>();
    for (const t of templates) {
      const k = t.rubro ?? '';
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([k, arr]) => ({ rubro: k, items: arr }));
  }, [templates]);

  async function crear() {
    setLoading(true); setError(null); setConflictId(null);
    try {
      const respUuid = responsable || null;
      const { data: { user } } = await supabase.auth.getUser();
      const fechaEst = ultimoDiaTrimestre(trimestre, anio);

      // ¿existe ya un trimestre para ese período?
      const { data: existing } = await supabase
        .from('audit_trimestres')
        .select('id')
        .eq('trimestre', trimestre)
        .eq('anio', anio)
        .maybeSingle();

      let trimId: string;
      const yaExistia = !!existing;

      if (existing) {
        const { count } = await supabase
          .from('audit_trimestre_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('trimestre_id', existing.id);

        if ((count ?? 0) > 0) {
          setConflictId(existing.id);
          setError(`Ya existe un ${NOMBRES_TRIM[trimestre]} de ${anio} con ${count} tareas cargadas.`);
          setLoading(false);
          return;
        }

        trimId = existing.id;
        await supabase.from('audit_trimestres').update({
          fecha_estimada_cierre: fechaEst,
          responsable_principal: respUuid,
          auditor_externo: auditor.trim() || null,
        }).eq('id', existing.id);
      } else {
        const { data: cl, error: e1 } = await supabase
          .from('audit_trimestres')
          .insert({
            trimestre, anio,
            fecha_estimada_cierre: fechaEst,
            estado: 'pendiente',
            responsable_principal: respUuid,
            auditor_externo: auditor.trim() || null,
            created_by: user?.id,
          })
          .select('id')
          .single();
        if (e1) throw e1;
        trimId = cl.id;
      }

      const tareas = templates.map((t) => ({
        trimestre_id: trimId,
        template_id: t.id,
        orden: t.orden,
        rubro: t.rubro,
        nombre: t.nombre,
        descripcion: t.descripcion,
        responsable_id: t.responsable_default ?? respUuid,
        fecha_vencimiento: fechaEst,
        estado: 'pendiente',
      }));
      if (tareas.length) {
        const { error: e2 } = await supabase.from('audit_trimestre_tasks').insert(tareas);
        if (e2) {
          if (!yaExistia) {
            await supabase.from('audit_trimestres').delete().eq('id', trimId);
          }
          throw e2;
        }
      }

      router.push(`/contabilidad/auditoria/${trimId}`);
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el trimestre.');
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <TopBar
        titulo="Nuevo trimestre de auditoría"
        subtitulo={`${NOMBRES_TRIM[trimestre]} · ${anio}`}
        actions={<Link href="/contabilidad/auditoria" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6 max-w-4xl space-y-6">
        <div className="card p-5 space-y-4">
          <h3 className="font-medium">Período</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Trimestre</label>
              <select className="input" value={trimestre} onChange={(e) => { setTrimestre(parseInt(e.target.value)); setError(null); setConflictId(null); }}>
                <option value={1}>1° Trimestre (Abril a Junio)</option>
                <option value={2}>2° Trimestre (Julio a Septiembre)</option>
                <option value={3}>3° Trimestre (Octubre a Diciembre)</option>
                <option value={4}>4° Trimestre (Enero a Marzo)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Año</label>
              <input type="number" className="input" value={anio} onChange={(e) => { setAnio(parseInt(e.target.value)||anio); setError(null); setConflictId(null); }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted">Auditor externo</label>
              <input className="input" value={auditor} onChange={(e) => setAuditor(e.target.value)} placeholder="Grupo Conforto" />
            </div>
            <div>
              <label className="text-xs text-muted">Responsable principal (opcional)</label>
              <select className="input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                <option value="">Sin asignar</option>
                {miembros.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted">
            La fecha estimada de cierre se calcula automáticamente como el último día del trimestre. Podés editarla después.
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Tareas que se van a crear ({templates.length})</h3>
          </div>
          <p className="text-xs text-muted mb-3">
            Basado en la Solicitud Preliminar de Información de Grupo Conforto.
            Todas las tareas se crearán con el mismo vencimiento (último día del trimestre) y podés
            ajustar fecha, responsable y estado individualmente después.
          </p>
          <div className="space-y-4">
            {gruposTemplates.map((g) => (
              <div key={g.rubro}>
                <div className="text-xs uppercase tracking-wide text-primary font-semibold border-b border-border pb-1 mb-2">
                  {g.rubro || 'Sin rubro'}
                </div>
                <ul className="space-y-2">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex gap-3 text-sm">
                      <span className="text-muted w-6 text-right">{t.orden}</span>
                      <div>
                        <div className="font-medium">{t.nombre}</div>
                        {t.descripcion && <div className="text-xs text-muted">{t.descripcion}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className={`card p-4 border-l-4 ${conflictId ? 'border-l-warning' : 'border-l-danger'} flex items-start gap-3`}>
            <AlertTriangle className={conflictId ? 'text-warning shrink-0 mt-0.5' : 'text-danger shrink-0 mt-0.5'} size={18}/>
            <div className="flex-1">
              <div className={`text-sm font-medium ${conflictId ? 'text-warning' : 'text-danger'}`}>{error}</div>
              {conflictId && (
                <Link href={`/contabilidad/auditoria/${conflictId}`} className="btn-primary text-sm mt-3 inline-flex">
                  Ir al trimestre existente <ArrowRight size={14}/>
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link href="/contabilidad/auditoria" className="btn-secondary">Cancelar</Link>
          <button onClick={crear} disabled={loading} className="btn-primary">
            {loading ? 'Creando...' : 'Crear trimestre y tareas'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
