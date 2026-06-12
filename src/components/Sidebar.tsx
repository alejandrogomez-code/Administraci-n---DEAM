'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, LayoutDashboard, LogOut, Settings, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Item = { href: string; label: string; icon: any };
const items: Item[] = [
  { href: '/dashboard',                  label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/contabilidad',               label: 'Contabilidad',  icon: FileSpreadsheet },
  { href: '/contabilidad/cierres',       label: 'Cierres del mes', icon: FileText },
  { href: '/contabilidad/iva',           label: 'Control de IVA', icon: Wallet },
  { href: '/configuracion',              label: 'Configuración', icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem('deam.sidebar') === '1';
    setCollapsed(c);
  }, []);
  useEffect(() => { localStorage.setItem('deam.sidebar', collapsed ? '1' : '0'); }, [collapsed]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} shrink-0 border-r border-border bg-surface h-screen sticky top-0 flex flex-col transition-all`}>
      <div className="h-14 flex items-center gap-2 px-3 border-b border-border">
        <div className="w-8 h-8 rounded bg-primary text-primary-fg flex items-center justify-center font-bold shrink-0">D</div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-semibold text-sm">Administración</div>
            <div className="text-xs text-muted">DEAM SRL</div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {items.map((it) => {
          const Icon = it.icon;
          const active = path === it.href || (it.href !== '/dashboard' && path.startsWith(it.href));
          return (
            <Link key={it.href} href={it.href}
              className={`flex items-center gap-3 px-2.5 py-2 rounded text-sm transition ${active ? 'bg-primary/10 text-primary font-medium' : 'text-text hover:bg-surface-2'}`}
              title={collapsed ? it.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border space-y-0.5">
        <button onClick={logout} className="w-full flex items-center gap-3 px-2.5 py-2 rounded text-sm text-text hover:bg-surface-2" title={collapsed ? 'Cerrar sesión' : undefined}>
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
        <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center gap-3 px-2.5 py-2 rounded text-sm text-muted hover:bg-surface-2">
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Colapsar</span></>}
        </button>
      </div>
    </aside>
  );
}
