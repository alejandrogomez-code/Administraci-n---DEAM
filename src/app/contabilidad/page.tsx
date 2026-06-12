import Link from 'next/link';
import { FileText, Wallet } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';

export default function ContabilidadPage() {
  const items = [
    { href: '/contabilidad/cierres', label: 'Cierres del mes',  desc: 'Gestión de tareas de cierre contable mensual', icon: FileText },
    { href: '/contabilidad/iva',     label: 'Control de IVA',   desc: 'Cruce de comprobantes ARCA vs SAP',           icon: Wallet },
  ];
  return (
    <AppShell>
      <TopBar titulo="Contabilidad" subtitulo="Módulos contables" />
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
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
