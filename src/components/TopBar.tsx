/** Encabezado de página: título grande, subtítulo y acciones a la derecha. */
export default function TopBar({ titulo, subtitulo, actions }: { titulo: React.ReactNode; subtitulo?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="px-4 sm:px-6 pt-5 sm:pt-7 pb-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[1.45rem] sm:text-[1.7rem] font-semibold tracking-tight leading-tight">{titulo}</h1>
        {subtitulo && <p className="text-muted mt-1 text-[0.93rem]">{subtitulo}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
