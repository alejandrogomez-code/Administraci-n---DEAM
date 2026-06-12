'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ThemeSelector from '@/components/ThemeSelector';

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
    if (error) setError(error.message);
    else router.push('/dashboard');
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setInfo(null);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre } },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setInfo('Cuenta creada. Si la verificación por email está habilitada, revisá tu casilla.');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4"><ThemeSelector /></div>
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-primary text-primary-fg flex items-center justify-center font-bold">D</div>
          <div>
            <div className="font-semibold">Administración DEAM</div>
            <div className="text-xs text-muted">Acceso interno</div>
          </div>
        </div>

        <div className="flex gap-1 mb-4 bg-surface-2 p-1 rounded text-sm">
          <button onClick={() => setTab('signin')} className={`flex-1 py-1.5 rounded ${tab==='signin'?'bg-surface shadow-soft':''}`}>Ingresar</button>
          <button onClick={() => setTab('signup')} className={`flex-1 py-1.5 rounded ${tab==='signup'?'bg-surface shadow-soft':''}`}>Crear cuenta</button>
        </div>

        <form onSubmit={tab==='signin'?signIn:signUp} className="space-y-3">
          {tab==='signup' && (
            <div>
              <label className="text-xs text-muted">Nombre y apellido</label>
              <input className="input" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs text-muted">Email</label>
            <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">Contraseña</label>
            <input type="password" className="input" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="text-sm text-danger">{error}</div>}
          {info && <div className="text-sm text-success">{info}</div>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? 'Cargando...' : (tab==='signin' ? 'Ingresar' : 'Crear cuenta')}
          </button>
        </form>

        <p className="text-xs text-muted mt-4 text-center">
          El primer usuario registrado queda como Administrador.
        </p>
      </div>
    </div>
  );
}
