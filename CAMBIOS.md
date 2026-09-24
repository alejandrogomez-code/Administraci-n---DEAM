# Cambios — rediseño y mejoras (septiembre 2026)

## Diseño
- Nuevo estilo en toda la app: barra lateral verde tinta, acento ocre, tipografía Plus Jakarta Sans, encabezados grandes, tablas y estados unificados.
- Se reemplazaron las 6 paletas por una sola, con modo claro/oscuro y 4 tamaños de letra (pie de la barra lateral).
- Login rediseñado, con mensajes de error en español.

## Experiencia de uso
- Se eliminó el "Cargando..." de pantalla completa: el usuario y el rol se cargan una sola vez por sesión (`src/lib/sesion.ts`). Donde una pantalla espera datos se muestra un esqueleto (`src/components/Cargando.tsx`).
- Se reemplazaron 64 `alert`, 32 `confirm` y 6 `prompt` por avisos y diálogos propios (`src/components/feedback.tsx`).
- Versión para celular: menú desplegable, Inicio y Calendario adaptados.
- Barra lateral con contadores de vencidos por módulo.
- Correcciones: celdas de tabla desalineadas (`<td>` con `flex`), ícono de búsqueda que tapaba el texto (las clases base ahora están en `@layer components`).

## Nuevo
- Inicio con datos reales de todos los módulos (`src/app/dashboard`).
- Calendario (`src/app/calendario`).
- Revisión semanal (`src/app/revision-semanal`).
- El Gestor de tareas acepta `?abrir=<id>` y `?nueva=1`.

## Código
- Pantallas largas divididas en archivos dentro de `_componentes/`: Venta de cheques, Financiamiento, Tareas, Repositorio y Pólizas.

## Seguridad
- Next.js actualizado de 14.2.15 a 14.2.35 (corrige CVE-2025-29927, salteo del middleware de login).

## Pendiente (hacer a mano)
- **Actualizar xlsx**: la versión 0.18.5 tiene vulnerabilidades conocidas y la versión corregida no está en npm. En `package.json` reemplazar
  `"xlsx": "0.18.5"` por `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` y volver a desplegar. La API es compatible, pero conviene probar después una importación de IVA y una de cheques.
- **Guardar el esquema de la base**: `supabase/schema.sql` no está en el repositorio. Exportarlo desde Supabase y subirlo.

## Supuestos a verificar
El Inicio, el Calendario y la Revisión semanal leen campos deducidos del código (sin el schema a mano). Si alguno difiere, esa sección se muestra vacía sin romper la pantalla:
- `accounting_closing_tasks.fecha_estimada_2` se toma como fecha reprogramada (si existe, tiene prioridad sobre `fecha_estimada`).
- Cheques disponibles = `cheques` sin `propuesta_id` y con vencimiento desde hoy.
- Pólizas por vencer = `repo_polizas` no finalizadas con vencimiento en los próximos 30 días (45 en la agenda).
