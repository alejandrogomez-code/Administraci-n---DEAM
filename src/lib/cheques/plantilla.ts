// Genera y descarga un archivo Excel modelo para la importación de cheques.

import * as XLSX from 'xlsx';

export function descargarPlantillaCheques() {
  // Headers en el orden esperado por el parser
  const headers = [
    'Vencimiento',
    'Asignación',
    'Importe',
    'Librador',
    'Banco',
    'CUIT',
    'Tipo',
    'Status',
  ];

  // Filas de ejemplo (con la primera de las imágenes del usuario, sin datos sensibles)
  const ejemplos: any[][] = [
    [new Date(2026, 5, 4),  '99078232', 1017666.67, 'Sanatorio San Jorge SRL', 'Echeq - BANCO MACRO S.A.',       '30546154439', '7', 7],
    [new Date(2026, 5, 5),  '72497340', 2567632.50, 'R Y O VALLE S R L',       'e cheque BANCO MACRO S.A.',      '30668229073', '7', 7],
    [new Date(2026, 5, 7),  '9786117',  1730300.00, 'UJHELYI CLAUDIO DANIEL',  'E CHEQUE BANCO DE LA PROVINCIA','20148424935',  '7', 7],
    [new Date(2026, 5, 11), '341',      6942112.75, 'Renta Med Equipamiento Sa','E CHEQUE BANCO SANTANDER',     '30663631906', '7', 7],
  ];

  // Construir la hoja con AOA (array of arrays) para preservar tipos
  const data: any[][] = [headers, ...ejemplos];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Anchos de columna razonables
  ws['!cols'] = [
    { wch: 13 },  // Vencimiento
    { wch: 12 },  // Asignación
    { wch: 14 },  // Importe
    { wch: 32 },  // Librador
    { wch: 32 },  // Banco
    { wch: 14 },  // CUIT
    { wch: 6 },   // Tipo
    { wch: 8 },   // Status
  ];

  // Hoja con instrucciones
  const instr = [
    ['INSTRUCCIONES — Plantilla de carga de cheques'],
    [],
    ['Columna', 'Obligatorio', 'Descripción'],
    ['Vencimiento', 'Sí', 'Fecha de vencimiento del cheque. Formato dd/mm/aaaa.'],
    ['Asignación', 'No', 'Número de asignación interno (texto libre).'],
    ['Importe', 'Sí', 'Importe del cheque. Sólo números (sin signo $).'],
    ['Librador', 'No', 'Nombre o razón social del librador.'],
    ['Banco', 'No', 'Banco / tipo (Echeq, E-Cheque, etc.).'],
    ['CUIT', 'No', 'CUIT del librador (11 dígitos, con o sin guiones).'],
    ['Tipo', 'No', 'Tipo del comprobante (ej: 7).'],
    ['Status', 'No', 'Número del 1 al 8.'],
    [],
    ['Notas:'],
    ['• Borrá las filas de ejemplo antes de cargar tus cheques.'],
    ['• Mantené el nombre de las columnas tal como están.'],
    ['• La fecha de venta se ingresa en la aplicación, no en este archivo.'],
    ['• Los días al vencimiento se calculan automáticamente.'],
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instr);
  wsI['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,  'Cheques');
  XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');

  XLSX.writeFile(wb, 'Plantilla_Carga_Cheques.xlsx');
}
