# Administración DEAM

Aplicación interna de DEAM SRL para gestión administrativa: cierre contable mensual, control de IVA (cruce ARCA vs SAP), y configuración (usuarios, permisos, categorías).

**Stack:** Next.js 14 (App Router) + TypeScript + Supabase (DB/Auth/Storage) + Tailwind CSS + xlsx.

---

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un nuevo proyecto.
2. Una vez listo, andá a **Settings → API** y copiá:
   - `Project URL`
   - `anon public` key
3. Andá a **SQL Editor → New query**, pegá todo el contenido de `supabase/schema.sql` y ejecutá. Esto crea las tablas, políticas RLS, triggers, las **11 tareas modelo precargadas** del cierre mensual y las **categorías iniciales**.
4. En **Authentication → Providers**, asegurate de que **Email** esté habilitado. Si querés que los usuarios puedan registrarse sin confirmación por email mientras probás, desactivá temporalmente "Confirm email".
5. En **Storage**, verificá que aparecieron los buckets `iva-files` y `accounting-files` (los crea el SQL). Si no, creálos manualmente (privados).

## 2. Configurar variables de entorno

Copiá `.env.local.example` a `.env.local` y completá:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 3. Subir a GitHub

1. Creá un repo nuevo en GitHub (privado).
2. En "Add file" → "Upload files", arrastrá todas las carpetas y archivos del proyecto (excepto `node_modules`, que no debería existir).
3. Commit.

## 4. Deploy en Vercel

1. Entrá a [vercel.com](https://vercel.com) y autorizá GitHub si no lo hiciste.
2. **Add New Project** → seleccioná el repo recién creado.
3. Antes de hacer deploy, andá a **Environment Variables** y pegá las dos variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**.

## 5. Primer acceso

1. Abrí la URL que te da Vercel.
2. La primera vez te redirige al login. Andá a la pestaña **Crear cuenta** y registrate.
3. **El primer usuario que se registra queda como Administrador** automáticamente (lo hace el trigger `handle_new_user` en la DB).
4. Los siguientes usuarios entran con rol `usuario_admin_1`. Como admin podés cambiar el rol desde **Configuración → Usuarios**.

---

## Módulos incluidos

### Dashboard
Tarjetas tipo Odoo de acceso rápido + KPIs.

### Contabilidad → Cierres del mes
- Lista de cierres mensuales con avance %, filtros, KPIs.
- Crear nuevo cierre: elegís mes/año y se generan automáticamente las **11 tareas modelo** con las fechas calculadas sobre el mes siguiente (día 5, 7, 8, 10, 13, 15, etc., según lo configurado).
- Detalle del cierre: tabla de tareas con edición inline de estado (Pendiente / En proceso / Completado), modal de edición completa (responsable, observaciones, fechas), botón "Duplicar mes anterior", agregar/eliminar tareas, eliminar cierre.
- El estado del cierre se actualiza automáticamente según las tareas (todas completadas → completado).

### Contabilidad → Control de IVA
- **Nuevo control:** subís el Excel de ARCA ("Mis Comprobantes Recibidos") y el Excel de SAP ("IVA Compras"), seleccionás el período (YYYY-MM) y la app:
  1. Parsea los dos archivos en el navegador (xlsx).
  2. Normaliza: en SAP hace forward-fill de CUIT y Razón Social, agrupa por número + CUIT (las filas multi-alícuota se suman), descarta la fila de total general final.
  3. Matchea por **CUIT + Punto de Venta + Número + Letra** (sin ceros a la izquierda).
  4. Compara importes al **centavo exacto**, en valor absoluto (para que las NC con signo invertido entre los dos archivos crucen bien).
  5. Sube ambos archivos a Supabase Storage y guarda el resultado del cruce.
- **Detalle del control:** KPIs (OK, diferencias, faltantes), tabs/filtros por tipo, búsqueda por razón social/CUIT/número, **checkbox para marcar como resuelto**, edición de observación por fila, exportación a Excel, descarga de los archivos originales.

### Configuración
- **Usuarios:** edición de nombre, rol y estado activo.
- **Permisos por rol:** matriz de checkboxes Ver / Editar / Eliminar por módulo y rol.
- **Tareas modelo del cierre:** CRUD de la plantilla de tareas; podés editar las 11 cargadas o agregar nuevas.
- **Categorías:** etiquetas clasificadas por tipo. Podés agregar nuevos tipos.

## Sistema de temas
- 6 paletas: Azul corporativo, Verde petróleo, Gris oscuro / eléctrico, Minimalista, Bordó / crema, Verde oliva.
- Modo claro / oscuro independiente de la paleta.
- Preferencias guardadas en localStorage. Selector en el TopBar (icono paleta).

## Formato Argentina
Todos los números usan **punto como separador de miles y coma como decimal** (`$ 1.234.567,89`). Las fechas se muestran como `dd/mm/yyyy`.

---

## Notas técnicas

- **Auth:** Supabase con `@supabase/ssr`. Middleware en `src/middleware.ts` redirige a `/login` si no hay sesión.
- **RLS:** todas las tablas tienen políticas que requieren sesión autenticada. La validación fina de permisos (ver/editar) está en el frontend según `role_permissions`.
- **Parser SAP:** las fechas SAP vienen como objetos `Date` (no como string); por eso el parser usa `cellDates: true` y **NO** `raw: false` en `sheet_to_json`. Si cambia el formato de exportación, ajustar `parseSap.ts`.
- **Cruce:** la comparación de importes es al centavo exacto (tolerancia 0). Si más adelante querés una tolerancia (ej: $1 para errores de redondeo), cambiar la constante `TOLERANCIA` en `src/lib/iva/cruzar.ts`.

## Estructura del proyecto

```
administracion-deam/
├─ supabase/schema.sql         ← schema completo + seeds (ejecutar en Supabase)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ globals.css           ← 6 paletas + light/dark
│  │  ├─ page.tsx              ← redirect a /dashboard
│  │  ├─ login/
│  │  ├─ dashboard/
│  │  ├─ contabilidad/
│  │  │  ├─ cierres/{lista, nuevo, [id]}
│  │  │  └─ iva/{lista, nuevo, [id]}
│  │  └─ configuracion/{landing, usuarios, permisos, tareas-modelo, categorias}
│  ├─ components/              ← Sidebar, TopBar, ThemeProvider, etc.
│  ├─ lib/
│  │  ├─ format.ts             ← formato AR
│  │  ├─ supabase/             ← clients
│  │  └─ iva/                  ← lógica del cruce (parseAfip, parseSap, cruzar)
│  └─ middleware.ts
├─ package.json
├─ tailwind.config.ts
└─ next.config.js
```
