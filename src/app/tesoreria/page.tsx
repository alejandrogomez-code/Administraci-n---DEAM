import Link from 'next/link';
import { Banknote, Clock, CreditCard, LineChart, Receipt, Wallet } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';

const disponibles = [
  { href: '/tesoreria/venta-cheques', label: 'Venta de cheques', desc: 'Carga, simulador y propuestas de venta', icon: Receipt },
];

const proximamente = [
  { icon: Wallet,     titulo: 'Cuentas bancarias',        desc: 'Saldos por cuenta, conciliaciones, movimientos.' },
  { icon: CreditCard, titulo: 'Pagos y cobros',           desc: 'Calendario de pagos a proveedores y cobros de clientes.' },
  { icon: LineChart,  titulo: 'Flujo de caja proyectado', desc: 'Proyección semanal / mensual de ingresos y egresos.' },
  { icon: Banknote,   titulo: 'Préstamos e inversiones',  desc: 'Capital de trabajo, plazos, vencimientos.' },
];

export default function TesoreriaPage() {
  return (
    <AppShell>
      <TopBar titulo="Tesorería" subtitulo="Operaciones de tesorería y flujo de caja" />
      <div className="p-6 max-w-4xl space-y-6">
        <div>
          <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">Módulos disponibles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {disponibles.map((d) => {
              const Icon = d.icon;
              return (
                <Link key={d.href} href={d.href} className="card p-5 hover:shadow-card transition">
                  <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <Icon size={20} />
                  </div>
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-muted mt-1">{d.desc}</div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="card p-6 border-l-4 border-l-warning">
          <div className="flex items-start gap-3">
            <Clock className="text-warning shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-semibold">Próximamente</div>
              <p className="text-sm text-muted mt-1">
                Otras funcionalidades de tesorería en construcción.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">En construcción</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {proximamente.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.titulo} className="card p-5 opacity-70">
                  <div className="w-10 h-10 rounded bg-muted/15 text-muted flex items-center justify-center mb-3">
                    <Icon size={20} />
                  </div>
                  <div className="font-medium">{p.titulo}</div>
                  <div className="text-xs text-muted mt-1">{p.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
