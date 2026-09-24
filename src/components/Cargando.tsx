/** Esqueletos de carga: muestran la forma del contenido mientras llegan los datos. */
export function Cargando({ filas = 5, enTarjeta = false }: { filas?: number; enTarjeta?: boolean }) {
  const cuerpo = (
    <div className="p-4 space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skel w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skel h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <div className="skel h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
  return enTarjeta ? <div className="card">{cuerpo}</div> : cuerpo;
}

export function CargandoPagina() {
  return (
    <div className="px-4 sm:px-6 pt-7 space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2"><div className="skel h-8 w-64" /><div className="skel h-4 w-40" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skel h-24 rounded-2xl" />)}</div>
      <Cargando filas={6} enTarjeta />
    </div>
  );
}
