import Link from 'next/link';
import { Banknote, BookOpen, FileSpreadsheet, FileText, Settings, Wallet } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const modulos = [
  { href: '/contabilidad/cierres', label: 'Cierres del mes',  desc: 'Tareas mensuales de cierre contable', icon: FileText,        color: 'bg-primary/10 text-primary' },
  { href: '/contabilidad/iva',     label: 'Control de IVA',   desc: 'Cruce ARCA vs SAP',                   icon: Wallet,          color: 'bg-accent/10 text-accent' },
  { href: '/tesoreria',            label: 'Tesorería',        desc: 'Cuentas, pagos y flujo de caja',      icon: Banknote,        color: 'bg-warning/10 text-warning' },
  { href: '/manuales',             label: 'Manuales',         desc: 'Documentación y capacitaciones',      icon: BookOpen,        color: 'bg-success/10 text-success' },
  { href: '/contabilidad',         label: 'Contabilidad',     desc: 'Acceso al módulo contable completo',  icon: FileSpreadsheet, color: 'bg-primary/10 text-primary' },
  { href: '/configuracion',        label: 'Configuración',    desc: 'Usuarios, permisos, equipo y más',    icon: Settings,        color: 'bg-muted/20 text-muted' },
];

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let nombre = user?.email ?? '';
  if (user) {
    const { data } = await supabase.from('profiles').select('nombre').eq('id', user.id).single();
    nombre = data?.nombre ?? nombre;
  }

  const { count: cierresPendientes } = await supabase
    .from('accounting_closings').select('id', { count: 'exact', head: true }).neq('estado', 'completado');
  const { count: ivaControles } = await supabase
    .from('iva_controls').select('id', { count: 'exact', head: true });
  const { count: manuales } = await supabase
    .from('manuales').select('id', { count: 'exact', head: true });

  return (
    <AppShell>
      <TopBar titulo={`Bienvenido, ${nombre}`} subtitulo="Panel principal" />
      <div className="p-6 max-w-7xl">
        <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">Módulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modulos.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href} className="card p-5 hover:shadow-card transition group">
                <div className={`w-10 h-10 rounded ${m.color} flex items-center justify-center mb-3 group-hover:scale-105 transition`}>
                  <Icon size={20} />
                </div>
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-muted mt-1">{m.desc}</div>
              </Link>
            );
          })}
        </div>

        <h2 className="text-sm font-medium text-muted mt-8 mb-3 uppercase tracking-wide">Resumen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-xs text-muted">Cierres en curso</div>
            <div className="text-2xl font-semibold mt-1">{cierresPendientes ?? 0}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs text-muted">Controles de IVA</div>
            <div className="text-2xl font-semibold mt-1">{ivaControles ?? 0}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs text-muted">Manuales / capacitaciones</div>
            <div className="text-2xl font-semibold mt-1">{manuales ?? 0}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs text-muted">Usuario activo</div>
            <div className="text-base font-medium mt-1 truncate">{user?.email}</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
