'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { avisar, pedirTexto } from '@/components/feedback';
import { BUCKET, Manual, Modulo, Seccion, TIPO_LABEL, TIPOS_ELEGIBLES, TipoRecurso, deducirTipos, tiposDe } from './tipos';

const NUEVO_MODULO = '__nuevo__';

type Props = {
  inicial: Manual;
  modulos: Modulo[];
  temas: Record<string, string[]>;
  /** Sección preseleccionada para un manual nuevo sin módulo. */
  seccionInicial?: Seccion;
  onCerrar: () => void;
  onGuardado: () => void;
  onModuloCreado: (m: Modulo) => void;
};

export default function ManualModal({ inicial, modulos, temas, seccionInicial = 'odoo', onCerrar, onGuardado, onModuloCreado }: Props) {
  const supabase = createClient();
  const moduloInicial = modulos.find((x) => x.id === inicial.modulo_id);

  const [form, setForm] = useState<Manual>({ ...inicial, tipos: tiposDe(inicial).filter((t) => t !== 'archivo') });
  const [seccion, setSeccion] = useState<Seccion>(moduloInicial?.seccion ?? seccionInicial);
  const [file, setFile] = useState<File | null>(null);
  const [aBorrar, setABorrar] = useState<string[]>([]);
  const [tiposTocados, setTiposTocados] = useState(!!inicial.tipos?.length);
  const [busy, setBusy] = useState(false);

  const set = (cambios: Partial<Manual>) => setForm((f) => ({ ...f, ...cambios }));
  const opciones = modulos.filter((x) => x.seccion === seccion && (x.activo || x.id === form.modulo_id));
  const tiposSel = (form.tipos ?? []) as TipoRecurso[];

  // Mientras no se marquen a mano, los tipos se deducen del archivo y el link.
  useEffect(() => {
    if (tiposTocados) return;
    const t = deducirTipos(file?.name ?? form.archivo_nombre, form.link).filter((x) => x !== 'archivo');
    set({ tipos: t });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, form.archivo_nombre, form.link, tiposTocados]);

  function cambiarSeccion(s: Seccion) {
    setSeccion(s);
    if (!modulos.some((x) => x.id === form.modulo_id && x.seccion === s)) set({ modulo_id: null });
  }

  async function elegirModulo(valor: string) {
    if (valor !== NUEVO_MODULO) { set({ modulo_id: valor || null }); return; }
    const nombre = (await pedirTexto(seccion === 'odoo' ? 'Nombre del nuevo módulo de Odoo' : 'Nombre de la nueva área'))?.trim();
    if (!nombre) return;
    const orden = Math.max(0, ...modulos.filter((x) => x.seccion === seccion).map((x) => x.orden)) + 1;
    const { data, error } = await supabase.from('manual_modulos').insert({ seccion, nombre, orden }).select().single();
    if (error || !data) { avisar(error?.message ?? 'No se pudo crear el módulo.', 'error'); return; }
    onModuloCreado(data as Modulo);
    set({ modulo_id: (data as Modulo).id });
  }

  function alternarTipo(t: TipoRecurso) {
    setTiposTocados(true);
    set({ tipos: tiposSel.includes(t) ? tiposSel.filter((x) => x !== t) : [...tiposSel, t] });
  }

  function quitarArchivo() {
    if (form.archivo_url) setABorrar((l) => [...l, form.archivo_url!]);
    set({ archivo_url: null, archivo_nombre: null });
  }

  async function guardar() {
    if (!form.titulo.trim()) { avisar('Escribí un título.', 'aviso'); return; }
    if (!form.modulo_id) { avisar(seccion === 'odoo' ? 'Elegí el módulo de Odoo.' : 'Elegí el área.', 'aviso'); return; }
    if (!file && !form.archivo_url && !form.link?.trim()) { avisar('Subí un archivo o pegá un link.', 'aviso'); return; }

    setBusy(true);
    try {
      let archivo_url = form.archivo_url;
      let archivo_nombre = form.archivo_nombre;
      const borrarDespues = [...aBorrar];

      if (file) {
        const path = `${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (error) throw error;
        if (archivo_url) borrarDespues.push(archivo_url);
        archivo_url = path;
        archivo_nombre = file.name;
      }

      const payload = {
        titulo: form.titulo.trim(),
        modulo_id: form.modulo_id,
        tema: form.tema?.trim() || null,
        descripcion: form.descripcion?.trim() || null,
        tipos: tiposSel,
        archivo_url,
        archivo_nombre,
        link: form.link?.trim() || null,
        palabras_clave: form.palabras_clave?.trim() || null,
        observaciones: form.observaciones?.trim() || null,
        activo: form.activo,
      };

      if (form.id) {
        const { error } = await supabase.from('manuales').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('manuales').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }

      // Los archivos reemplazados o quitados se borran recién cuando el guardado salió bien.
      if (borrarDespues.length) await supabase.storage.from(BUCKET).remove(borrarDespues);
      avisar(form.id ? 'Manual actualizado.' : 'Manual guardado.');
      onGuardado();
    } catch (err: any) {
      avisar(err?.message ?? 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const listaTemas = form.modulo_id ? temas[form.modulo_id] ?? [] : [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-modal-titulo"
        className="card max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="manual-modal-titulo" className="font-semibold text-lg mb-4">{form.id ? 'Editar' : 'Nuevo'} manual / capacitación</h3>

        <div className="space-y-4">
          <fieldset>
            <legend className="text-xs text-muted mb-2">Sección *</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {(['odoo', 'interno'] as Seccion[]).map((s) => {
                const on = seccion === s;
                const color = s === 'odoo' ? 'border-cta bg-cta/10' : 'border-primary bg-primary/10';
                return (
                  <label key={s} className={`flex gap-2.5 items-start rounded-[10px] p-3 cursor-pointer ${on ? `border-2 ${color}` : 'border border-border hover:bg-surface-2'}`}>
                    <input type="radio" name="seccion" className="mt-1" checked={on} onChange={() => cambiarSeccion(s)} />
                    <span>
                      <span className="block text-sm font-semibold">{s === 'odoo' ? 'Odoo' : 'Manual interno'}</span>
                      <span className="block text-xs text-muted">{s === 'odoo' ? 'Guías del sistema nuevo' : 'Procedimientos propios DEAM'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted">{seccion === 'odoo' ? 'Módulo *' : 'Área *'}</span>
              <select className="input mt-1" value={form.modulo_id ?? ''} onChange={(e) => elegirModulo(e.target.value)}>
                <option value="">Elegir…</option>
                {opciones.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                <option value={NUEVO_MODULO}>+ {seccion === 'odoo' ? 'Nuevo módulo' : 'Nueva área'}…</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Tema (opcional)</span>
              <input
                className="input mt-1"
                list="manual-temas"
                placeholder="Ej.: Conciliación bancaria"
                value={form.tema ?? ''}
                onChange={(e) => set({ tema: e.target.value })}
              />
              <datalist id="manual-temas">{listaTemas.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-muted">Título *</span>
            <input className="input mt-1" value={form.titulo} onChange={(e) => set({ titulo: e.target.value })} />
          </label>

          <label className="block">
            <span className="text-xs text-muted">Descripción corta (se ve en el listado)</span>
            <input className="input mt-1" maxLength={140} value={form.descripcion ?? ''} onChange={(e) => set({ descripcion: e.target.value })} />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted">Archivo (PDF, Excel u otro)</span>
              {form.archivo_url ? (
                <div className="mt-1 flex items-center gap-2 border border-border rounded-[10px] px-3 py-2 text-sm">
                  <FileText size={16} className="shrink-0" />
                  <span className="truncate flex-1">{form.archivo_nombre}</span>
                  <button onClick={quitarArchivo} className="text-danger text-xs hover:underline">Quitar</button>
                </div>
              ) : (
                <label className="mt-1 border-2 border-dashed border-border rounded-[10px] px-3 py-2 text-sm cursor-pointer hover:border-primary flex items-center gap-2 min-h-[42px]">
                  {file ? <FileText size={16} className="text-success shrink-0" /> : <Upload size={16} className="text-muted shrink-0" />}
                  <span className="truncate">{file ? file.name : 'Seleccionar PDF, Excel…'}</span>
                  <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>
            <label className="block">
              <span className="text-xs text-muted">Link (Drive, YouTube, web)</span>
              <input className="input mt-1" placeholder="https://…" value={form.link ?? ''} onChange={(e) => set({ link: e.target.value })} />
            </label>
          </div>

          <fieldset>
            <legend className="text-xs text-muted mb-2">Tipo {!tiposTocados && <span>(se completa solo según el archivo y el link)</span>}</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS_ELEGIBLES.map((t) => {
                const on = tiposSel.includes(t);
                return (
                  <label key={t} className={`flex items-center gap-2 rounded-[9px] px-3 py-1.5 text-sm cursor-pointer ${on ? 'border-2 border-primary bg-primary/10 font-medium' : 'border border-border'}`}>
                    <input type="checkbox" checked={on} onChange={() => alternarTipo(t)} /> {TIPO_LABEL[t]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs text-muted">Palabras clave (ayudan al buscador)</span>
            <input className="input mt-1" placeholder="Ej.: extracto, banco, conciliar" value={form.palabras_clave ?? ''} onChange={(e) => set({ palabras_clave: e.target.value })} />
          </label>

          <label className="block">
            <span className="text-xs text-muted">Observaciones</span>
            <textarea className="input mt-1 min-h-16" value={form.observaciones ?? ''} onChange={(e) => set({ observaciones: e.target.value })} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activo} onChange={(e) => set({ activo: e.target.checked })} /> Activo
          </label>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={busy} onClick={onCerrar}>Cancelar</button>
            <button className="btn-primary" disabled={busy} onClick={guardar}>
              {busy ? <><Loader2 className="animate-spin" size={14} /> Guardando…</> : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
