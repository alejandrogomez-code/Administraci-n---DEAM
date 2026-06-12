import Link from 'next/link';
import { ListTodo, Shield, Tags, Users, UserCircle2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';

const items = [
  { href: '/configuracion/usuarios',      label: 'Usuarios',             desc: 'Cuentas con acceso a la app y sus roles', icon: Users },
  { href: '/configuracion/equipo',        label: 'Equipo (responsables)', desc: 'Personas a las que asignar tareas',     icon: UserCircle2 },
  { href: '/configuracion/permisos',      label: 'Permisos por rol',     desc: 'Qué puede ver y hacer cada rol',          icon: Shield },
  { href: '/configuracion/tareas-modelo', label: 'Tareas modelo cierre', desc: 'Plantilla de tareas mensuales',           icon: ListTodo },
  { href: '/configuracion/categorias',    label: 'Categorías',           desc: 'Etiquetas para clasificar ítems',         icon: Tags },
];

export default function ConfigPage() {
  return (
    <AppShell>
      <TopBar titulo="Configuración" subtitulo="Ajustes generales del sistema" />
      <div className="p-6 max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} className="card p-5 hover:shadow-card transition">
                <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon size={20} />
                </div>
                <div className="font-medium">{it.label}</div>
                <div className="text-xs text-muted mt-1">{it.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
