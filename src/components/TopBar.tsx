'use client';

import ThemeSelector from './ThemeSelector';

export default function TopBar({ titulo, subtitulo, actions }: { titulo: string; subtitulo?: string; actions?: React.ReactNode }) {
  return (
    <header className="h-14 sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border flex items-center justify-between px-6">
      <div>
        <h1 className="text-base font-semibold leading-tight">{titulo}</h1>
        {subtitulo && <p className="text-xs text-muted">{subtitulo}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeSelector />
      </div>
    </header>
  );
}
