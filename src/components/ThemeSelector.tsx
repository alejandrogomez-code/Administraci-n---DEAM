'use client';

import { Moon, Sun } from 'lucide-react';
import { TAMANOS, useTheme } from './ThemeProvider';

const TAM_PX: Record<string, number> = { s: 11, m: 13, l: 15, xl: 17 };

/** Controles de modo claro/oscuro y tamaño de letra (pie de la barra lateral). */
export default function ThemeSelector({ compacto = false }: { compacto?: boolean }) {
  const { modo, setModo, tamano, setTamano } = useTheme();
  const seg = 'flex items-center rounded-[10px] border border-ink-2 p-0.5';
  const opt = (on: boolean) =>
    `h-7 min-w-7 px-1.5 rounded-lg grid place-items-center font-semibold transition ${on ? 'bg-ink-2 text-white' : 'text-ink-muted hover:text-ink-fg'}`;

  return (
    <div className={`flex ${compacto ? 'flex-col' : ''} gap-2`}>
      <div className={seg} role="group" aria-label="Modo de color">
        <button className={opt(modo === 'light')} onClick={() => setModo('light')} title="Modo claro" aria-pressed={modo === 'light'}><Sun size={15} /></button>
        <button className={opt(modo === 'dark')} onClick={() => setModo('dark')} title="Modo oscuro" aria-pressed={modo === 'dark'}><Moon size={15} /></button>
      </div>
      {!compacto && (
        <div className={seg} role="group" aria-label="Tamaño de letra">
          {TAMANOS.map((t) => (
            <button key={t} className={opt(tamano === t)} style={{ fontSize: TAM_PX[t] }} onClick={() => setTamano(t)} title={`Letra ${t.toUpperCase()}`} aria-pressed={tamano === t}>A</button>
          ))}
        </div>
      )}
    </div>
  );
}
