'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import { useSesion } from '@/lib/sesion';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const sesion = useSesion();
  const [menu, setMenu] = useState(false);

  // El rol "ventas" solo puede ver la sección Repositorio
  const soloRepo = sesion?.rol === 'ventas';
  const enRepo = pathname.startsWith('/repositorio');
  useEffect(() => { if (soloRepo && !enRepo) router.replace('/repositorio'); }, [soloRepo, enRepo, router]);

  // Cerrar el menú móvil al navegar y bloquear el scroll de fondo mientras está abierto
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menu]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Menú móvil */}
      {menu && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <Sidebar movil onNavegar={() => setMenu(false)} />
          <button className="flex-1 bg-black/40" onClick={() => setMenu(false)} aria-label="Cerrar menú" />
          <button className="absolute top-4 left-[18.25rem] text-white p-1" onClick={() => setMenu(false)} aria-label="Cerrar menú"><X size={22} /></button>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden sticky top-0 z-30 h-14 bg-ink text-ink-fg flex items-center gap-3 px-3">
          <button onClick={() => setMenu(true)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Abrir menú"><Menu size={22} /></button>
          <div className="w-8 h-8 rounded-lg bg-cta text-cta-fg grid place-items-center font-bold text-xs">AD</div>
          <span className="font-semibold text-white">Administración</span>
        </div>
        <main className="flex-1 min-w-0 pb-10">
          {soloRepo && !enRepo ? <div className="p-10 text-center text-muted">Redirigiendo…</div> : children}
        </main>
      </div>
    </div>
  );
}
