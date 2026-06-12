'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen, Building2, ChevronDown, ChevronLeft, ChevronRight,
  FileSpreadsheet, FileText, LayoutDashboard, LogOut, Settings, Wallet, Banknote,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Item = { href: string; label: string; icon: any; children?: Item[] };

const items: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/contabilidad',
    label: 'Contabilidad',
    icon: FileSpreadsheet,
    children: [
      { href: '/contabilidad/cierres', label: 'Cierres del mes', icon: FileText },
      { href: '/contabilidad/iva',     label: 'Control de IVA',  icon: Wallet },
    ],
  },
  { href: '/tesoreria', label: 'Tesorería', icon: Banknote },
  { href: '/manuales',  label: 'Manuales y Capacitaciones', icon: BookOpen },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(localStorage.getItem('deam.sidebar') === '1');
    const raw = localStorage.getItem('deam.sidebar.exp');
    if (raw) try { setExpanded(JSON.parse(raw)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem('deam.sidebar', collapsed ? '1' : '0'); }, [collapsed]);
  useEffect(() => { localStorage.setItem('deam.sidebar.exp', JSON.stringify(expanded)); }, [expanded]);

  // expandir automáticamente la categoría activa
  useEffect(() => {
    const auto: Record<string, boolean> = { ...expanded };
    let changed = false;
    for (const it of items) {
      if (it.children && it.children.some((c) => path.startsWith(c.href))) {
        if (!auto[it.href]) { auto[it.href] = true; changed = true; }
      }
    }
    if (changed) setExpanded(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  function isActive(href: string) {
    if (href === '/dashboard') return path === href;
    return path === href || path.startsWith(href + '/');
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
          const active = isActive(it.href);
          const hasChildren = !!it.children?.length;
          const isExp = expanded[it.href] ?? active;

          if (hasChildren && !collapsed) {
            return (
              <div key={it.href}>
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [it.href]: !isExp }))}
                  className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded text-sm transition ${active ? 'text-primary font-medium' : 'text-text hover:bg-surface-2'}`}
                >
                  <span className="flex items-center gap-3 truncate">
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${isExp ? '' : '-rotate-90'}`} />
                </button>
                {isExp && (
                  <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    <Link href={it.href}
                      className={`flex items-center gap-3 px-2.5 py-1.5 rounded text-xs transition ${path === it.href ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:bg-surface-2'}`}
                    >
                      Resumen
                    </Link>
                    {it.children!.map((c) => {
                      const CI = c.icon;
                      const ca = isActive(c.href);
                      return (
                        <Link key={c.href} href={c.href}
                          className={`flex items-center gap-3 px-2.5 py-1.5 rounded text-sm transition ${ca ? 'bg-primary/10 text-primary font-medium' : 'text-text hover:bg-surface-2'}`}
                        >
                          <CI size={14} className="shrink-0" />
                          <span className="truncate">{c.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

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
