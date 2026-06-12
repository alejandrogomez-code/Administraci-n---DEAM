'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Paleta = 'azul' | 'petroleo' | 'electrico' | 'minimal' | 'bordo' | 'oliva';
export type Modo = 'light' | 'dark';

export const PALETAS: { id: Paleta; nombre: string; desc: string }[] = [
  { id: 'azul',      nombre: 'Azul corporativo',         desc: 'Azul / gris claro' },
  { id: 'petroleo',  nombre: 'Verde petróleo',           desc: 'Petróleo / beige' },
  { id: 'electrico', nombre: 'Gris oscuro / eléctrico',  desc: 'Gris / azul eléctrico' },
  { id: 'minimal',   nombre: 'Minimalista',              desc: 'Negro / gris / blanco' },
  { id: 'bordo',     nombre: 'Bordó / crema',            desc: 'Bordó / crema' },
  { id: 'oliva',     nombre: 'Verde oliva',              desc: 'Oliva / gris claro' },
];

type Ctx = {
  paleta: Paleta;
  modo: Modo;
  setPaleta: (p: Paleta) => void;
  setModo: (m: Modo) => void;
  toggleModo: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [paleta, setPaletaState] = useState<Paleta>('azul');
  const [modo, setModoState] = useState<Modo>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = (localStorage.getItem('deam.paleta') as Paleta) || 'azul';
    const m = (localStorage.getItem('deam.modo') as Modo) || 'light';
    setPaletaState(p);
    setModoState(m);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    // limpiar clases previas
    root.classList.forEach((c) => {
      if (c.startsWith('theme-')) root.classList.remove(c);
    });
    root.classList.remove('light', 'dark');
    root.classList.add(`theme-${paleta}`);
    root.classList.add(modo);
    localStorage.setItem('deam.paleta', paleta);
    localStorage.setItem('deam.modo', modo);
  }, [paleta, modo, ready]);

  return (
    <ThemeCtx.Provider value={{
      paleta, modo,
      setPaleta: setPaletaState,
      setModo: setModoState,
      toggleModo: () => setModoState((m) => m === 'light' ? 'dark' : 'light'),
    }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme fuera de ThemeProvider');
  return ctx;
}
