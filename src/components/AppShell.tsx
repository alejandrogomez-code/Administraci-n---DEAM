'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { createClient } from '@/lib/supabase/client';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [rol, setRol] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setReady(true); return; }
      const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
      if (active) { setRol((data as any)?.rol ?? null); setReady(true); }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El rol "ventas" solo puede ver la sección Repositorio
  const soloRepo = rol === 'ventas';
  const enRepo = !!pathname?.startsWith('/repositorio');

  useEffect(() => {
    if (ready && soloRepo && !enRepo) router.replace('/repositorio');
  }, [ready, soloRepo, enRepo, router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar rol={rol} />
      <main className="flex-1 min-w-0">
        {!ready
          ? <div className="p-10 text-center text-muted">Cargando...</div>
          : (soloRepo && !enRepo)
            ? <div className="p-10 text-center text-muted">Redirigiendo...</div>
            : children}
      </main>
    </div>
  );
}
