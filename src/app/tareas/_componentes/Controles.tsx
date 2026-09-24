'use client';

import { useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ESTADOS, Estado, estadoInfo } from './tipos';

/* =====================================================================
   COMPONENTES AUXILIARES
   ===================================================================== */

export function EstadoSelect({ estado, onChange }: { estado: Estado; onChange: (e: Estado) => void }) {
  const info = estadoInfo(estado);
  return (
    <select
      value={estado}
      onChange={(e) => onChange(e.target.value as Estado)}
      className={`text-xs px-2 py-1 rounded border-0 outline-none cursor-pointer ${info.bg} ${info.color} font-medium`}
    >
      {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
    </select>
  );
}

export function IconAdjunto({ tareaId }: { tareaId: string }) {
  const supabase = createClient();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    supabase.from('tareas_adjuntos').select('id', { count: 'exact', head: true }).eq('tarea_id', tareaId)
      .then(({ count }) => setCount(count ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId]);
  if (count === null || count === 0) return <span className="text-muted text-xs">—</span>;
  return <span className="inline-flex items-center gap-1 text-primary text-xs"><Paperclip size={12}/> {count}</span>;
}
