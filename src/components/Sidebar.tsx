'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen, Bot, CalendarDays, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardCheck, FileText,
  FolderOpen, Home, Landmark, ListChecks, LogOut, Receipt, Settings, ShieldCheck, SquareCheckBig,
  TrendingUp, Wallet, Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { limpiarSesion, useResumen, useSesion } from '@/lib/sesion';
import type { Modulo } from '@/lib/agenda';
import ThemeSelector from './ThemeSelector';

type Item = {
  href: string;
  label: string;
  icon: any;
  children?: { href: string; label: string; icon: any }[];
  soloAdmin?: boolean;
  contador?: Modulo;
};

const GENERAL: Item[] = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/tareas', label: 'Gestor de tareas', icon: SquareCheckBig, contador: 'Tareas' },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/revision-semanal', label: 'Revisión semanal', icon: ListChecks },
  { href: '/accesos-directos', label: 'Accesos directos', icon: Zap },
];

const MODULOS: Item[] = [
  {
    href: '/contabilidad', label: 'Contabilidad', icon: FileText, contador: 'Contabilidad',
    children: [
      { href: '/contabilidad/cierres', label: 'Cierres del mes', icon: FileText },
      { href: '/contabilidad/iva', label: 'Control de IVA', icon: Wallet },
      { href: '/contabilidad/auditoria', label: 'Auditoría trimestral', icon: ClipboardCheck },
    ],
  },
  {
    href: '/tesoreria', label: 'Tesorería', icon: Landmark, contador: 'Tesorería',
    children: [{ href: '/tesoreria/venta-cheques', label: 'Venta de cheques', icon: Receipt }],
  },
  {
    href: '/repositorio', label: 'Repositorio', icon: FolderOpen, contador: 'Repositorio',
    children: [{ href: '/repositorio/polizas', label: 'Gestión de pólizas', icon: ShieldCheck }],
  },
  { href: '/financiamiento', label: 'Financiamiento', icon: TrendingUp, soloAdmin: true },
  { href: '/requerimientos-ia', label: 'Requerimientos IA', icon: Bot, soloAdmin: true },
  { href: '/manuales', label: 'Manuales', icon: BookOpen },
];

const CONFIG: Item = { href: '/configuracion', label: 'Configuración', icon: Settings };

export default function Sidebar({ movil = false, onNavegar }: { movil?: boolean; onNavegar?: () => void }) {
  const path = usePathname() ?? '';
  const router = useRouter();
  const sesion = useSesion();
  const rol = sesion?.rol ?? null;
  const soloRepo = rol === 'ventas';
  const resumen = useResumen(!!sesion && !soloRepo);
  const [colapsada, setColapsada] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const col = colapsada && !movil;

  useEffect(() => {
    try {
      setColapsada(localStorage.getItem('deam.sidebar') === '1');
      const raw = localStorage.getItem('deam.sidebar.exp');
      if (raw) setAbiertos(JSON.parse(raw));
    } catch {}
  }, []);

  function guardar(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }
  function toggleColapsar() { setColapsada((c) => { guardar('deam.sidebar', c ? '0' : '1'); return !c; }); }
  function toggleGrupo(href: string, abierto: boolean) {
    setAbiertos((s) => { const n = { ...s, [href]: !abierto }; guardar('deam.sidebar.exp', JSON.stringify(n)); return n; });
  }

  async function salir() {
    await createClient().auth.signOut();
    limpiarSesion();
    router.push('/login');
  }

  const activo = (href: string) => (href === '/dashboard' ? path === href : path === href || path.startsWith(href + '/'));
  const visible = (it: Item) => (!it.soloAdmin || rol === 'admin') && (!soloRepo || it.href === '/repositorio');
  const contador = (it: Item) => (it.contador && resumen ? resumen.porModulo[it.contador] : 0);

  const base = 'flex items-center gap-3 rounded-[10px] transition';
  const claseItem = (on: boolean) =>
    `${base} ${col ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-[0.45rem] text-[0.95rem]'} ${on ? 'bg-ink-2 text-white font-medium' : 'text-ink-fg/85 hover:bg-white/5 hover:text-white'}`;

  function Badge({ n }: { n: number }) {
    if (!n) return null;
    return col
      ? <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-cta text-cta-fg text-[10px] font-semibold grid place-items-center">{n}</span>
      : <span className="ml-auto text-[0.72rem] font-semibold bg-cta/20 text-[#E7C58A] rounded-md px-1.5 tabular" title={`${n} vencidos`}>{n}</span>;
  }

  function renderItem(it: Item) {
    const Icon = it.icon;
    const on = activo(it.href);
    const n = contador(it);
    const tieneHijos = !!it.children?.length && !col;
    if (!tieneHijos) {
      return (
        <Link key={it.href} href={it.href} onClick={onNavegar} className={`${claseItem(on)} relative`} title={col ? it.label : undefined} aria-current={on ? 'page' : undefined}>
          <Icon size={18} className="shrink-0" />
          {!col && <span className="truncate">{it.label}</span>}
          <Badge n={n} />
        </Link>
      );
    }
    const abierto = abiertos[it.href] ?? on;
    return (
      <div key={it.href}>
        <button onClick={() => toggleGrupo(it.href, abierto)} className={`${base} w-full px-3 py-[0.45rem] text-[0.95rem] ${on ? 'text-white font-medium' : 'text-ink-fg/85 hover:bg-white/5 hover:text-white'}`} aria-expanded={abierto}>
          <Icon size={18} className="shrink-0" />
          <span className="truncate">{it.label}</span>
          <Badge n={n} />
          <ChevronDown size={15} className={`shrink-0 text-ink-muted transition-transform ${n ? '' : 'ml-auto'} ${abierto ? '' : '-rotate-90'}`} />
        </button>
        {abierto && (
          <div className="ml-[1.35rem] mt-0.5 mb-1 border-l border-ink-2 pl-2 space-y-0.5">
            <Link href={it.href} onClick={onNavegar} className={`block px-3 py-1.5 rounded-lg text-[0.85rem] ${path === it.href ? 'bg-ink-2 text-white font-medium' : 'text-ink-muted hover:text-white'}`}>Resumen</Link>
            {it.children!.map((c) => (
              <Link key={c.href} href={c.href} onClick={onNavegar} className={`block px-3 py-1.5 rounded-lg text-[0.9rem] ${activo(c.href) ? 'bg-ink-2 text-white font-medium' : 'text-ink-fg/85 hover:text-white'}`}>{c.label}</Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const iniciales = (sesion?.nombre || sesion?.email || '?').split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
  const usuario = sesion?.email?.split('@')[0] ?? '';

  return (
    <aside className={`${movil ? 'w-[17.5rem] h-full' : `${col ? 'w-[4.5rem]' : 'w-[16rem]'} h-screen sticky top-0 hidden lg:flex`} shrink-0 bg-ink text-ink-fg flex flex-col transition-[width]`}>
      <div className={`flex items-center gap-3 ${col ? 'justify-center px-2' : 'px-5'} pt-5 pb-4`}>
        <div className="w-10 h-10 rounded-xl bg-cta text-cta-fg grid place-items-center font-bold shrink-0">AD</div>
        {!col && (
          <div className="leading-tight min-w-0">
            <div className="font-semibold text-white">Administración</div>
            <div className="text-xs text-ink-muted">DEAM SRL · Finanzas</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-0.5" aria-label="Principal">
        {GENERAL.filter(visible).map(renderItem)}
        {!col && !soloRepo && <div className="text-[0.78rem] font-medium text-ink-muted px-3 pt-5 pb-1.5">Módulos</div>}
        {col && <div className="h-4" />}
        {MODULOS.filter(visible).map(renderItem)}
        {!soloRepo && <div className="pt-3">{renderItem(CONFIG)}</div>}
      </nav>

      <div className={`border-t border-ink-2 ${col ? 'px-2 py-3 space-y-3' : 'px-4 py-3.5 space-y-3'}`}>
        <div className={col ? 'flex justify-center' : ''}><ThemeSelector compacto={col} /></div>
        <div className={`flex items-center gap-2.5 ${col ? 'flex-col' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-cta text-cta-fg grid place-items-center text-xs font-bold shrink-0" title={sesion?.email}>{iniciales || '·'}</div>
          {!col && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold text-white truncate">{usuario || ' '}</div>
              <div className="text-xs text-ink-muted truncate capitalize">{rol ? rol.replace(/_/g, ' ') : ' '}</div>
            </div>
          )}
          <button onClick={salir} className="p-1.5 rounded-lg text-ink-muted hover:text-white hover:bg-white/5" title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={17} /></button>
        </div>
        {!movil && (
          <button onClick={toggleColapsar} className={`flex items-center gap-2 text-xs text-ink-muted hover:text-white ${col ? 'mx-auto' : ''}`} title={col ? 'Expandir menú' : 'Colapsar menú'}>
            {col ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} />Colapsar menú</>}
          </button>
        )}
      </div>
    </aside>
  );
}
