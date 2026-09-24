'use client';

import { useEffect, useState } from 'react';
import { parseNum, fmtNumLocal } from '@/lib/cfpp/calculos';

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'
      }`}>
      {children}
    </button>
  );
}

// ====== TAB: DATOS ======
export function InputTexto({ value, onCommit, placeholder }: { value: string | null; onCommit: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState<string>(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <input type="text" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== (value ?? '')) onCommit(local); }}
      placeholder={placeholder}
      className="input" style={{ padding: '4px 6px', fontSize: 12, width: '100%' }} />
  );
}

export function InputNum({ value, onCommit, placeholder, decimals = 2 }: {
  value: number | null; onCommit: (v: number | null) => void; placeholder?: string; decimals?: number;
}) {
  const [local, setLocal] = useState<string>(value === null || value === undefined ? '' : fmtNumLocal(value, decimals));
  useEffect(() => {
    setLocal(value === null || value === undefined ? '' : fmtNumLocal(value, decimals));
  }, [value, decimals]);
  return (
    <input type="text" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { const p = parseNum(local); if (p !== value) onCommit(p); }}
      placeholder={placeholder}
      className="input text-right" style={{ padding: '4px 6px', fontSize: 12, width: '100%' }} />
  );
}

export function CampoNum({ label, value, onChange, placeholder }: {
  label: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string;
}) {
  const [local, setLocal] = useState<string>(value === null || value === undefined ? '' : fmtNumLocal(value, 2));
  useEffect(() => { setLocal(value === null || value === undefined ? '' : fmtNumLocal(value, 2)); }, [value]);
  return (
    <label className="block">
      <span className="text-xs text-muted block mb-1 font-medium">{label}</span>
      <input type="text" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { const p = parseNum(local); if (p !== value) onChange(p); }}
        placeholder={placeholder} className="input text-right" />
    </label>
  );
}

export function CampoTexto({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [local, setLocal] = useState<string>(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <label className="block">
      <span className="text-xs text-muted block mb-1 font-medium">{label}</span>
      <input type="text" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== (value ?? '')) onChange(local); }}
        placeholder={placeholder} className="input" />
    </label>
  );
}

// ====== TAB: RESULTADOS ======
