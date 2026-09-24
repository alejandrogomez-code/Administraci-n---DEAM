'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Modo = 'light' | 'dark';
export type Tamano = 's' | 'm' | 'l' | 'xl';
export const TAMANOS: Tamano[] = ['s', 'm', 'l', 'xl'];

type Ctx = {
  modo: Modo;
  tamano: Tamano;
  setModo: (m: Modo) => void;
  setTamano: (t: Tamano) => void;
  toggleModo: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

/** Script que corre antes del primer render para evitar el parpadeo de tema. */
export const themeInitScript = `(function(){try{var r=document.documentElement;var m=localStorage.getItem('deam.modo')||'light';var t=localStorage.getItem('deam.tamano')||'m';r.classList.add(m==='dark'?'dark':'light','fs-'+t);}catch(e){}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [modo, setModo] = useState<Modo>('light');
  const [tamano, setTamano] = useState<Tamano>('m');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setModo((localStorage.getItem('deam.modo') as Modo) === 'dark' ? 'dark' : 'light');
    const t = localStorage.getItem('deam.tamano') as Tamano;
    setTamano(TAMANOS.includes(t) ? t : 'm');
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark', ...TAMANOS.map((t) => `fs-${t}`));
    root.classList.add(modo, `fs-${tamano}`);
    try {
      localStorage.setItem('deam.modo', modo);
      localStorage.setItem('deam.tamano', tamano);
    } catch {}
  }, [modo, tamano, ready]);

  return (
    <ThemeCtx.Provider value={{ modo, tamano, setModo, setTamano, toggleModo: () => setModo((m) => (m === 'light' ? 'dark' : 'light')) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme fuera de ThemeProvider');
  return ctx;
}
