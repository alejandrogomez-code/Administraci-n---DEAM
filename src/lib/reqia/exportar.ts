import * as XLSX from 'xlsx';

export type SolicitudExport = {
  fecha: string | null;
  area: string;
  coordinador: string;
  problema: string;
  requerimiento: string;
  cantidad_licencias: number | null;
  estado: string;       // etiqueta legible (ej. "Aprobado")
  origen: string;       // etiqueta legible (ej. "Formulario")
  notas?: string | null;
};

const CAMPOS: { label: string; key: keyof SolicitudExport }[] = [
  { label: 'Fecha', key: 'fecha' },
  { label: 'Área solicitante', key: 'area' },
  { label: 'Coordinador del área', key: 'coordinador' },
  { label: 'Problema que se quiere abordar', key: 'problema' },
  { label: 'Requerimiento de Sistemas / IA (plataforma sugerida)', key: 'requerimiento' },
  { label: 'Cantidad de licencias', key: 'cantidad_licencias' },
  { label: 'Estado del requerimiento', key: 'estado' },
  { label: 'Origen', key: 'origen' },
];

function val(s: SolicitudExport, k: keyof SolicitudExport): string {
  const v = s[k];
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function slug(s: SolicitudExport): string {
  const base = `${s.fecha ?? ''}-${s.area || 'solicitud'}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'solicitud-ia';
}

/** Descarga la solicitud como archivo Excel (.xlsx), un campo por fila. */
export function exportarSolicitudExcel(s: SolicitudExport) {
  const filas: (string | number)[][] = [['Campo', 'Detalle']];
  for (const c of CAMPOS) filas.push([c.label, val(s, c.key)]);
  if (s.notas) filas.push(['Notas', s.notas]);

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 42 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitud IA');
  XLSX.writeFile(wb, `solicitud-ia-${slug(s)}.xlsx`);
}

/** Abre una ventana de impresión con la solicitud maquetada para "Guardar como PDF". */
export function exportarSolicitudPDF(s: SolicitudExport) {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const filas = CAMPOS.map(c => `
      <tr>
        <th>${esc(c.label)}</th>
        <td>${esc(val(s, c.key))}</td>
      </tr>`).join('');
  const notas = s.notas ? `
      <tr><th>Notas</th><td>${esc(s.notas)}</td></tr>` : '';

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Solicitud IA — ${esc(s.area || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; margin: 40px; }
  .hd { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #1f3864; padding-bottom: 14px; margin-bottom: 24px; }
  .logo { width: 40px; height: 40px; border-radius: 6px; background: #1f3864; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; }
  .hd h1 { font-size: 18px; margin: 0; color: #1f3864; }
  .hd .sub { font-size: 12px; color: #6b7280; }
  h2 { font-size: 15px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 9px 12px; border: 1px solid #d0d7e4; font-size: 13px; }
  th { width: 42%; background: #f2f5fa; font-weight: 600; }
  .foot { margin-top: 28px; font-size: 11px; color: #6b7280; }
  @media print { body { margin: 18mm; } }
</style></head>
<body>
  <div class="hd">
    <div class="logo">D</div>
    <div>
      <h1>DEAM SRL — Requerimientos de Sistemas: IA</h1>
      <div class="sub">Solicitud de plataforma de inteligencia artificial</div>
    </div>
  </div>
  <table>${filas}${notas}</table>
  <div class="foot">Documento generado el ${new Date().toLocaleDateString('es-AR')} · Uso interno DEAM SRL</div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { alert('Permití las ventanas emergentes para descargar el PDF.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
