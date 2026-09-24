'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { limpiarSesion } from '@/lib/sesion';

function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Tenés que confirmar tu email antes de ingresar. Revisá tu casilla.';
  if (/already registered/i.test(msg)) return 'Ya existe una cuenta con ese email. Ingresá desde la pestaña Ingresar.';
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  return msg;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(traducir(error.message));
    else { limpiarSesion(); router.push('/dashboard'); router.refresh(); }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setInfo(null);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre } },
    });
    setLoading(false);
    if (error) setError(traducir(error.message));
    else setInfo('Cuenta creada. Si la verificación por email está habilitada, revisá tu casilla.');
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-ink text-ink-fg p-12">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cta text-cta-fg grid place-items-center font-bold">AD</div>
          <div className="leading-tight">
            <div className="font-semibold text-white text-lg">Administración</div>
            <div className="text-sm text-ink-muted">DEAM SRL · Finanzas</div>
          </div>
        </div>
        <div className="max-w-md">
          <p className="text-[2rem] font-bold leading-tight text-white tracking-tight">Cierres, IVA, tesorería y pólizas en un solo lugar.</p>
          <p className="mt-4 text-ink-muted">Cada mañana vas a ver lo vencido, lo que vence hoy y lo que viene en la semana.</p>
        </div>
        <p className="text-sm text-ink-muted">Acceso interno de DEAM SRL</p>
      </aside>

      <main className="flex items-center justify-center p-6 relative">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-ink text-white grid place-items-center font-bold">AD</div>
            <div className="leading-tight">
              <div className="font-semibold">Administración DEAM</div>
              <div className="text-sm text-muted">Acceso interno</div>
            </div>
          </div>

          <h1 className="text-[1.75rem] font-bold tracking-tight">{tab === 'signin' ? 'Ingresá a tu cuenta' : 'Creá tu cuenta'}</h1>
          <p className="text-muted mt-1 mb-6">{tab === 'signin' ? 'Usá tu email de DEAM.' : 'El primer usuario registrado queda como administrador.'}</p>

          <div className="seg w-full mb-5" role="tablist">
            <button role="tab" aria-selected={tab === 'signin'} onClick={() => { setTab('signin'); setError(null); }} className={`flex-1 ${tab === 'signin' ? 'on' : ''}`}>Ingresar</button>
            <button role="tab" aria-selected={tab === 'signup'} onClick={() => { setTab('signup'); setError(null); }} className={`flex-1 ${tab === 'signup' ? 'on' : ''}`}>Crear cuenta</button>
          </div>

          <form onSubmit={tab === 'signin' ? signIn : signUp} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium mb-1">Nombre y apellido</label>
                <input id="nombre" className="input" required value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Contraseña</label>
              <input id="password" type="password" className="input" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} />
            </div>
            {error && <div className="text-sm text-danger bg-danger/10 rounded-[10px] px-3 py-2">{error}</div>}
            {info && <div className="text-sm text-success bg-success/10 rounded-[10px] px-3 py-2">{info}</div>}
            <button disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (tab === 'signin' ? 'Ingresando…' : 'Creando cuenta…') : (tab === 'signin' ? 'Ingresar' : 'Crear cuenta')}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
