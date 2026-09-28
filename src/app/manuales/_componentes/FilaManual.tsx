'use client';

import { Download, ExternalLink, FileSpreadsheet, FileText, Link2, Paperclip, PlayCircle, Trash2 } from 'lucide-react';
import { fmtFecha } from '@/lib/format';
import { Manual, Modulo, Seccion, TIPO_LABEL, TipoRecurso, tiposDe } from './tipos';
import { abrir, abrirArchivo, abrirLink, eliminarManual } from './acciones';

const ICONO: Record<TipoRecurso, typeof FileText> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  video: PlayCircle,
  link: Link2,
  archivo: Paperclip,
};

export function TipoChips({ tipos }: { tipos: TipoRecurso[] }) {
  if (!tipos.length) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tipos.map((t) => {
        const Icono = ICONO[t];
        return (
          <span key={t} className="chip bg-primary/10 text-primary">
            <Icono size={12} aria-hidden /> {TIPO_LABEL[t]}
          </span>
        );
      })}
    </span>
  );
}

export function SeccionChip({ seccion }: { seccion: Seccion }) {
  return seccion === 'odoo'
    ? <span className="chip bg-cta/15 text-warning font-semibold">Odoo</span>
    : <span className="chip bg-primary/10 text-primary font-semibold">Interno</span>;
}

type Props = {
  m: Manual;
  modulo?: Modulo;
  /** Muestra la sección y el módulo debajo del título (resultados de búsqueda). */
  mostrarModulo?: boolean;
  /** Muestra la fecha de actualización. */
  mostrarFecha?: boolean;
  onEditar: (m: Manual) => void;
  onEliminado: () => void;
};

export default function FilaManual({ m, modulo, mostrarModulo, mostrarFecha, onEditar, onEliminado }: Props) {
  const tipos = tiposDe(m);
  const esPdf = /\.pdf$/i.test(m.archivo_nombre ?? m.archivo_url ?? '');
  const detalle = [
    mostrarModulo && modulo ? modulo.nombre : null,
    m.tema?.trim() || null,
  ].filter(Boolean).join(' › ');

  return (
    <div className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3 border-b border-border/70 last:border-b-0 hover:bg-surface-2 ${!m.activo ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {mostrarModulo && modulo && <SeccionChip seccion={modulo.seccion} />}
          <button onClick={() => abrir(m)} className="text-left font-medium hover:text-primary hover:underline">
            {m.titulo}
          </button>
          {!m.activo && <span className="chip-neutro">Inactivo</span>}
        </div>
        {(m.descripcion || detalle) && (
          <div className="text-xs text-muted mt-0.5">
            {detalle && <span className="font-medium">{detalle}</span>}
            {detalle && m.descripcion && <span> · </span>}
            {m.descripcion}
          </div>
        )}
      </div>

      <div className="md:w-40 shrink-0"><TipoChips tipos={tipos} /></div>

      {mostrarFecha && (
        <div className="md:w-24 shrink-0 text-xs text-muted" title="Última actualización">{fmtFecha(m.updated_at)}</div>
      )}

      <div className="flex items-center gap-3 text-xs whitespace-nowrap shrink-0">
        {m.archivo_url && (
          <button onClick={() => abrirArchivo(m)} className="text-primary inline-flex items-center gap-1 hover:underline" title={m.archivo_nombre ?? 'Archivo'}>
            {esPdf
              ? <><FileText size={13} aria-hidden /> Ver PDF</>
              : <><Download size={13} aria-hidden /> Descargar</>}
          </button>
        )}
        {m.link && (
          <button onClick={() => abrirLink(m)} className="text-primary inline-flex items-center gap-1 hover:underline">
            <ExternalLink size={13} aria-hidden /> Link
          </button>
        )}
        <button className="text-muted hover:text-text" onClick={() => onEditar(m)}>Editar</button>
        <button
          className="text-danger"
          aria-label={`Eliminar ${m.titulo}`}
          onClick={async () => { if (await eliminarManual(m)) onEliminado(); }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
