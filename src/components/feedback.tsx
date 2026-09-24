'use client';

/**
 * Avisos y confirmaciones propias de la app (reemplazan alert / confirm / prompt del navegador).
 *
 *   avisar('Guardado')                         → aviso que se cierra solo
 *   avisar('No se pudo guardar', 'error')
 *   if (!(await confirmar('¿Eliminar X?'))) return;
 *   const nombre = await pedirTexto('Nombre de la propuesta', 'Propuesta 1');
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type TipoAviso = 'ok' | 'error' | 'info' | 'aviso';
type Aviso = { id: number; texto: string; tipo: TipoAviso };
type Dialogo = {
  id: number;
  tipo: 'confirmar' | 'texto';
  texto: string;
  valorInicial?: string;
  peligro?: boolean;
  textoOk?: string;
  resolver: (v: any) => void;
};

let seq = 0;
let avisos: Aviso[] = [];
let dialogos: Dialogo[] = [];
const subs = new Set<() => void>();
const emitir = () => subs.forEach((f) => f());

function inferirTipo(texto: string): TipoAviso {
  if (/error|no se pudo|fall[óo]|inválid|invalid|incorrect/i.test(texto)) return 'error';
  if (/complet[áa]|seleccion[áa]|ingres[áa]|deb[eé]s|falta|primero/i.test(texto)) return 'aviso';
  if (/guardad|cread|eliminad|actualizad|import|export|copiad|listo|ok\b/i.test(texto)) return 'ok';
  return 'info';
}

export function avisar(texto: unknown, tipo?: TipoAviso) {
  const t = String(texto ?? '');
  const aviso: Aviso = { id: ++seq, texto: t, tipo: tipo ?? inferirTipo(t) };
  avisos = [...avisos, aviso];
  emitir();
  setTimeout(() => cerrarAviso(aviso.id), aviso.tipo === 'error' ? 8000 : 4500);
}
function cerrarAviso(id: number) {
  avisos = avisos.filter((a) => a.id !== id);
  emitir();
}

const PELIGRO = /eliminar|borrar|quitar|cancelar/i;

export function confirmar(texto: string, opts: { textoOk?: string; peligro?: boolean } = {}): Promise<boolean> {
  return new Promise((resolver) => {
    dialogos = [...dialogos, { id: ++seq, tipo: 'confirmar', texto, resolver, peligro: opts.peligro ?? PELIGRO.test(texto), textoOk: opts.textoOk }];
    emitir();
  });
}

export function pedirTexto(texto: string, valorInicial = ''): Promise<string | null> {
  return new Promise((resolver) => {
    dialogos = [...dialogos, { id: ++seq, tipo: 'texto', texto, valorInicial, resolver }];
    emitir();
  });
}

function cerrarDialogo(d: Dialogo, valor: any) {
  dialogos = dialogos.filter((x) => x.id !== d.id);
  emitir();
  d.resolver(valor);
}

const ICONO = { ok: CheckCircle2, error: XCircle, info: Info, aviso: AlertTriangle };
const COLOR = { ok: 'text-success', error: 'text-danger', info: 'text-primary', aviso: 'text-warning' };

export function FeedbackHost() {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  const dialogo = dialogos[0];

  return (
    <>
      <div className="fixed z-[70] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {avisos.map((a) => {
          const I = ICONO[a.tipo];
          return (
            <div key={a.id} className="pointer-events-auto card shadow-pop px-4 py-3 flex items-start gap-3 text-sm">
              <I size={18} className={`${COLOR[a.tipo]} shrink-0 mt-0.5`} />
              <div className="flex-1 whitespace-pre-line">{a.texto}</div>
              <button onClick={() => cerrarAviso(a.id)} className="text-muted hover:text-text" aria-label="Cerrar aviso"><X size={16} /></button>
            </div>
          );
        })}
      </div>
      {dialogo && <DialogoView key={dialogo.id} d={dialogo} />}
    </>
  );
}

function DialogoView({ d }: { d: Dialogo }) {
  const [valor, setValor] = useState(d.valorInicial ?? '');
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (d.tipo === 'texto' ? inputRef.current : okRef.current)?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarDialogo(d, d.tipo === 'texto' ? null : false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d]);

  const aceptar = () => cerrarDialogo(d, d.tipo === 'texto' ? (valor.trim() || null) : true);
  const cancelar = () => cerrarDialogo(d, d.tipo === 'texto' ? null : false);
  const textoOk = d.textoOk ?? (d.tipo === 'texto' ? 'Aceptar' : d.peligro ? (/quitar/i.test(d.texto) ? 'Quitar' : 'Eliminar') : 'Confirmar');

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 grid place-items-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) cancelar(); }}>
      <div role="dialog" aria-modal="true" className="card shadow-pop w-full max-w-md p-5">
        <div className="flex gap-3">
          {d.peligro && <div className="w-9 h-9 rounded-full bg-danger/10 text-danger grid place-items-center shrink-0"><AlertTriangle size={18} /></div>}
          <div className="flex-1 min-w-0">
            <p className="text-[0.95rem] font-medium whitespace-pre-line">{d.texto}</p>
            {d.tipo === 'texto' && (
              <input ref={inputRef} className="input mt-3" value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') aceptar(); }} />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-secondary" onClick={cancelar}>Cancelar</button>
          <button ref={okRef} className={d.peligro ? 'btn-danger' : 'btn-primary'} onClick={aceptar}>{textoOk}</button>
        </div>
      </div>
    </div>
  );
}
