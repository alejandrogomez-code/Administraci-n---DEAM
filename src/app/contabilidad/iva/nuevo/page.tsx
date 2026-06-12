'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileCheck2, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { parseAfip } from '@/lib/iva/parseAfip';
import { parseSap } from '@/lib/iva/parseSap';
import { cruzar } from '@/lib/iva/cruzar';
import { fmtMoney } from '@/lib/format';

export default function NuevoIvaPage() {
  const router = useRouter();
  const supabase = createClient();
  const hoy = new Date();
  const periodoDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const [periodo, setPeriodo] = useState(periodoDefault);
  const [archivoAfip, setArchivoAfip] = useState<File | null>(null);
  const [archivoSap, setArchivoSap] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  async function procesar() {
    setError(null);
    if (!archivoAfip || !archivoSap) {
      setError('Subí ambos archivos (ARCA y SAP).');
      return;
    }
    setLoading(true);
    try {
      setStep('Parseando archivo ARCA...');
      const { rows: afip } = await parseAfip(archivoAfip);

      setStep('Parseando archivo SAP...');
      const { rows: sap } = await parseSap(archivoSap);

      setStep('Cruzando comprobantes...');
      const { resultados, resumen } = cruzar(afip, sap);

      setStep('Subiendo archivos a almacenamiento...');
      const ts = Date.now();
      const pathAfip = `${periodo}/afip_${ts}_${archivoAfip.name}`;
      const pathSap  = `${periodo}/sap_${ts}_${archivoSap.name}`;
      const up1 = await supabase.storage.from('iva-files').upload(pathAfip, archivoAfip, { upsert: false });
      const up2 = await supabase.storage.from('iva-files').upload(pathSap, archivoSap, { upsert: false });
      if (up1.error) console.warn('Error subiendo AFIP:', up1.error.message);
      if (up2.error) console.warn('Error subiendo SAP:', up2.error.message);

      setStep('Guardando control y resultados...');
      const { data: { user } } = await supabase.auth.getUser();
      const { data: control, error: e1 } = await supabase.from('iva_controls').insert({
        periodo,
        archivo_afip_nombre: archivoAfip.name,
        archivo_afip_url: pathAfip,
        archivo_sap_nombre: archivoSap.name,
        archivo_sap_url: pathSap,
        total_afip: resumen.total_afip,
        total_sap: resumen.total_sap,
        total_coincidencias: resumen.total_coincidencias,
        total_diferencias_importe: resumen.total_diferencias_importe,
        total_faltantes_sap: resumen.total_faltantes_sap,
        total_faltantes_afip: resumen.total_faltantes_afip,
        importe_total_afip: resumen.importe_total_afip,
        importe_total_sap: resumen.importe_total_sap,
        estado: 'procesado',
        created_by: user?.id,
      }).select('id').single();
      if (e1) throw e1;

      // Insertar resultados en batches
      const rows = resultados.map((r) => {
        const a = (r as any).afip;
        const s = (r as any).sap;
        const dif = r.tipo === 'diferencia_importe'
          ? (Math.abs((a?.importe_total ?? 0)) - Math.abs((s?.importe_total ?? 0)))
          : null;
        return {
          iva_control_id: control.id,
          tipo: r.tipo,
          resuelto: false,
          cuit: a?.cuit ?? s?.cuit ?? null,
          punto_venta: a?.punto_venta ?? s?.punto_venta ?? null,
          numero: a?.numero ?? s?.numero ?? null,
          letra: a?.letra ?? s?.letra ?? null,
          fecha_afip: a?.fecha ?? null,
          tipo_afip: a?.tipo ?? null,
          razon_social_afip: a?.razon_social ?? null,
          importe_afip: a?.importe_total ?? null,
          fecha_sap: s?.fecha ?? null,
          tipo_sap: s?.tipo ?? null,
          razon_social_sap: s?.razon_social ?? null,
          importe_sap: s?.importe_total ?? null,
          diferencia: dif,
        };
      });
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const slice = rows.slice(i, i + batchSize);
        const { error: e2 } = await supabase.from('iva_control_results').insert(slice);
        if (e2) throw e2;
      }

      setPreview({ id: control.id, resumen });
      setStep('Listo, redirigiendo...');
      router.push(`/contabilidad/iva/${control.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Error al procesar.');
      setLoading(false);
      setStep('');
    }
  }

  return (
    <AppShell>
      <TopBar
        titulo="Nuevo control de IVA"
        subtitulo="Cargar archivos y cruzar"
        actions={<Link href="/contabilidad/iva" className="btn-ghost"><ArrowLeft size={14}/> Volver</Link>}
      />
      <div className="p-6 max-w-3xl space-y-6">
        <div className="card p-5 space-y-4">
          <div>
            <label className="text-xs text-muted">Período (YYYY-MM)</label>
            <input className="input !w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2026-04" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FilePicker
              titulo="Archivo ARCA"
              descripcion='“Mis Comprobantes Recibidos”'
              file={archivoAfip}
              onChange={setArchivoAfip}
            />
            <FilePicker
              titulo="Archivo SAP"
              descripcion="IVA Compras exportado del SAP"
              file={archivoSap}
              onChange={setArchivoSap}
            />
          </div>
        </div>

        <div className="card p-5 space-y-2 text-sm">
          <div className="font-medium">Lógica del cruce</div>
          <ul className="text-xs text-muted space-y-1 ml-4 list-disc">
            <li>Se matchea por <b>CUIT + Punto de Venta + Número + Letra</b>.</li>
            <li>Importes comparados <b>al centavo exacto</b>. Notas de crédito se comparan en valor absoluto.</li>
            <li>Filas SAP de un mismo comprobante (alícuotas separadas) se agrupan sumando el total.</li>
          </ul>
        </div>

        {error && <div className="text-sm text-danger">{error}</div>}
        {step && <div className="text-sm text-muted flex items-center gap-2"><Loader2 className="animate-spin" size={14}/> {step}</div>}
        {preview && (
          <div className="card p-5 space-y-2">
            <div className="font-medium text-success">Procesado con éxito</div>
            <div className="text-sm grid grid-cols-2 gap-1">
              <div>OK exactos: <b>{preview.resumen.total_coincidencias}</b></div>
              <div>Diferencias importe: <b>{preview.resumen.total_diferencias_importe}</b></div>
              <div>Faltantes SAP: <b>{preview.resumen.total_faltantes_sap}</b></div>
              <div>Faltantes ARCA: <b>{preview.resumen.total_faltantes_afip}</b></div>
              <div>Importe ARCA: <b>{fmtMoney(preview.resumen.importe_total_afip)}</b></div>
              <div>Importe SAP: <b>{fmtMoney(preview.resumen.importe_total_sap)}</b></div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link href="/contabilidad/iva" className="btn-secondary">Cancelar</Link>
          <button disabled={loading || !archivoAfip || !archivoSap} onClick={procesar} className="btn-primary">
            {loading ? <><Loader2 className="animate-spin" size={14}/> Procesando...</> : <>Procesar control</>}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function FilePicker({ titulo, descripcion, file, onChange }: { titulo: string; descripcion: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="block cursor-pointer">
      <div className={`border-2 border-dashed rounded p-4 text-center transition ${file ? 'border-success bg-success/5' : 'border-border hover:border-primary'}`}>
        {file ? (
          <>
            <FileCheck2 className="mx-auto mb-1 text-success" size={28} />
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB</div>
          </>
        ) : (
          <>
            <Upload className="mx-auto mb-1 text-muted" size={28} />
            <div className="text-sm font-medium">{titulo}</div>
            <div className="text-xs text-muted">{descripcion}</div>
          </>
        )}
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.xlsm"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
