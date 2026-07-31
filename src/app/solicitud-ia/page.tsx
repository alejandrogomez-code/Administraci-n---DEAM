'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Form = {
  fecha: string;
  area: string;
  coordinador: string;
  problema: string;
  resultado: string;
  requerimiento: string;
  cantidad_licencias: string;
};

const VACIO: Form = {
  fecha: new Date().toISOString().slice(0, 10),
  area: '',
  coordinador: '',
  problema: '',
  resultado: '',
  requerimiento: '',
  cantidad_licencias: '',
};

export default function SolicitudIAPage() {
  const supabase = createClient();
  const [form, setForm] = useState<Form>(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  const valido =
    form.area.trim() &&
    form.coordinador.trim() &&
    form.problema.trim() &&
    form.requerimiento.trim();

  async function enviar() {
    if (!valido) { setError('Completá los campos obligatorios (*).'); return; }
    setEnviando(true);
    setError(null);
    const payload = {
      fecha: form.fecha || new Date().toISOString().slice(0, 10),
      area: form.area.trim(),
      coordinador: form.coordinador.trim(),
      problema: form.problema.trim(),
      resultado: form.resultado.trim() || null,
      requerimiento: form.requerimiento.trim(),
      cantidad_licencias: form.cantidad_licencias === '' ? null : Number(form.cantidad_licencias),
      estado: 'solicitado' as const,
      origen: 'formulario' as const,
    };
    const { error } = await supabase.from('req_ia').insert(payload);
    setEnviando(false);
    if (error) { setError('No se pudo enviar: ' + error.message); return; }
    setOk(true);
  }

  function nuevaSolicitud() {
    setForm({ ...VACIO, fecha: new Date().toISOString().slice(0, 10) });
    setOk(false);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-bg text-text flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-primary text-primary-fg flex items-center justify-center font-bold shrink-0">D</div>
          <div className="leading-tight">
            <div className="font-semibold">DEAM SRL</div>
            <div className="text-xs text-muted">Requerimientos de Sistemas: IA</div>
          </div>
        </div>

        {ok ? (
          <div className="card p-8 text-center">
            <CheckCircle2 className="mx-auto text-success mb-3" size={40} />
            <h1 className="text-lg font-semibold">¡Solicitud enviada!</h1>
            <p className="text-sm text-muted mt-2">
              Tu requerimiento quedó registrado como <strong>Solicitado</strong>. El área de Sistemas lo va a revisar.
            </p>
            <button onClick={nuevaSolicitud} className="btn-primary mt-6">Cargar otra solicitud</button>
          </div>
        ) : (
          <div className="card p-6 sm:p-8">
            <h1 className="text-xl font-semibold">Solicitud de plataforma de IA</h1>
            <p className="text-sm text-muted mt-1 mb-6">
              Completá este formulario para solicitar el acceso a una herramienta de inteligencia artificial
              (ChatGPT, Claude u otra). Los campos con <span className="text-danger">*</span> son obligatorios.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Fecha</label>
                <input
                  type="date"
                  className="input mt-1"
                  value={form.fecha}
                  onChange={e => set('fecha', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Área solicitante <span className="text-danger">*</span></label>
                <input
                  className="input mt-1"
                  placeholder="Ej. Calidad, Administración, Comercial"
                  value={form.area}
                  onChange={e => set('area', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Coordinador del área <span className="text-danger">*</span></label>
                <input
                  className="input mt-1"
                  placeholder="Nombre y apellido"
                  value={form.coordinador}
                  onChange={e => set('coordinador', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Proyecto / automatización que se quiere abordar <span className="text-danger">*</span></label>
                <textarea
                  rows={3}
                  className="input mt-1 resize-y"
                  placeholder="¿Qué proyecto o automatización se busca encarar con IA?"
                  value={form.problema}
                  onChange={e => set('problema', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Resultado esperado</label>
                <textarea
                  rows={3}
                  className="input mt-1 resize-y"
                  placeholder="¿Qué resultado se espera lograr?"
                  value={form.resultado}
                  onChange={e => set('resultado', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Requerimiento de Sistemas / IA <span className="text-danger">*</span></label>
                <input
                  className="input mt-1"
                  placeholder="Plataforma sugerida: ChatGPT, Claude, otra..."
                  value={form.requerimiento}
                  onChange={e => set('requerimiento', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Cantidad de licencias</label>
                <input
                  type="number"
                  min={1}
                  className="input mt-1 max-w-[160px]"
                  placeholder="Ej. 1"
                  value={form.cantidad_licencias}
                  onChange={e => set('cantidad_licencias', e.target.value)}
                />
              </div>

              {error && (
                <div className="text-sm text-danger bg-danger/10 rounded px-3 py-2">{error}</div>
              )}

              <button onClick={enviar} disabled={enviando || !valido} className="btn-primary w-full disabled:opacity-50">
                {enviando ? <><Loader2 className="animate-spin" size={16} /> Enviando...</> : <><Send size={16} /> Enviar solicitud</>}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted mt-6">DEAM SRL · Uso interno</p>
      </div>
    </div>
  );
}
