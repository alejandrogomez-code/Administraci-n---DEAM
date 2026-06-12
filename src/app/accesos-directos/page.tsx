import Link from 'next/link';
import { ExternalLink, Sparkles } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COLOR_CLASSES: Record<string, string> = {
  primary: 'bg-primary/10 text-primary hover:bg-primary/20',
  accent:  'bg-accent/10 text-accent hover:bg-accent/20',
  success: 'bg-success/10 text-success hover:bg-success/20',
  warning: 'bg-warning/10 text-warning hover:bg-warning/20',
  danger:  'bg-danger/10 text-danger hover:bg-danger/20',
  muted:   'bg-muted/15 text-muted hover:bg-muted/25',
};

export default async function AccesosDirectosPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('accesos_directos')
    .select('*')
    .eq('activo', true)
    .order('orden')
    .order('titulo');

  const items = data ?? [];

  return (
    <AppShell>
      <TopBar
        titulo="Accesos directos"
        subtitulo="Enlaces rápidos a sistemas externos y recursos"
        actions={<Link href="/configuracion/accesos-directos" className="btn-ghost text-sm">Gestionar</Link>}
      />
      <div className="p-6 max-w-6xl">
        {items.length === 0 ? (
          <div className="card p-10 text-center">
            <Sparkles className="mx-auto text-muted mb-3" size={32} />
            <div className="font-medium">Sin accesos directos cargados</div>
            <p className="text-sm text-muted mt-1">
              El administrador puede agregar enlaces desde <Link className="text-primary" href="/configuracion/accesos-directos">Configuración → Accesos directos</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((a: any) => (
              <a key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-5 hover:shadow-card transition group"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition ${COLOR_CLASSES[a.color] ?? COLOR_CLASSES.primary} group-hover:scale-105`}>
                  <ExternalLink size={22} />
                </div>
                <div className="font-medium">{a.titulo}</div>
                {a.descripcion && <div className="text-xs text-muted mt-1 line-clamp-2">{a.descripcion}</div>}
              </a>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
