'use client';

import { useState } from 'react';
import { Moon, Palette, Sun } from 'lucide-react';
import { PALETAS, useTheme } from './ThemeProvider';

export default function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const { paleta, modo, setPaleta, toggleModo } = useTheme();

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button onClick={toggleModo} className="btn-ghost p-2" title={modo === 'light' ? 'Modo oscuro' : 'Modo claro'}>
          {modo === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost p-2" title="Paleta de colores">
          <Palette size={16} />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 card p-2 z-40">
            <div className="px-2 py-1.5 text-xs text-muted uppercase tracking-wide">Paleta</div>
            {PALETAS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPaleta(p.id); setOpen(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between gap-2 hover:bg-surface-2 ${paleta === p.id ? 'bg-surface-2' : ''}`}
              >
                <div>
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-xs text-muted">{p.desc}</div>
                </div>
                {paleta === p.id && <div className="w-2 h-2 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
