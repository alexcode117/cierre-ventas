# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

App Next.js que convierte el Excel mensual de indicadores de ventas (libro `INDICADORES.xlsx`: una hoja por vendedor, `RESULTADOS`, `METAS` y opcionalmente `CALCULOS`) en un dashboard y un informe PDF. Todo ocurre en el navegador: el sitio es estático (`output: 'export'`), sin servidor ni base de datos, y se publica en Vercel con cada push a `main`. La interfaz, los comentarios y los mensajes están en español.

## Comandos

```bash
npm run dev                          # http://localhost:3000 → "Probar con archivos de ejemplo"
npm run build                        # export estático en out/ (también hace lint y typecheck)
npx eslint src tests scripts
npx tsc --noEmit
npx vitest run                       # todas las pruebas
npx vitest run tests/lib.test.ts -t "auditoría"   # un archivo / un grupo por nombre
node scripts/generate-examples.mjs   # regenera public/ejemplos/*.xlsx (datos ficticios)
```

- En Windows, `npm run build` falla con `EPERM … .next/trace` si `npm run dev` está corriendo: detener el dev server antes.
- `tests/pdf.test.tsx` renderiza el informe con `renderToBuffer` y deja los PDF en `tests/.output/` (ignorado por git) para revisarlos visualmente.
- `vitest.config.mts` anula la config de PostCSS de Next (si no, Vitest falla al cargarla) y activa JSX automático y el alias `@/`.

## Arquitectura

Flujo de datos, todo en `src/lib/` (sin dependencias de la interfaz):

1. `parser.ts` → `parseFile(buf)` lee el libro con SheetJS y produce un `MonthReport` (`types.ts`). Las celdas se ubican **por su texto** (`INDICADOR`, `ZONA`, `VENDEDOR`, `VARIABLE …`), no por posición fija. Cada hoja con una celda `INDICADOR` es un vendedor; cada bloque `INDICADOR` dentro de ella es una línea (Pegutil o Pruven, detectada por los nombres de los indicadores). Al final, `checkConsistency` cruza hojas de vendedor con RESULTADOS y llena `report.alerts`.
2. `calculos.ts` lee los bloques de la hoja `CALCULOS` (encabezado `VENDEDOR` + título en la fila de arriba) y agrega alertas comparándolos con las hojas de vendedor y RESULTADOS.
3. `analysis.ts` → `analyze(report)`: hallazgos (`insights`), puntos perdidos, casi-logros, plan de metas del mes siguiente, venta cruzada y `team` (cumplimiento del equipo con base comparable, ver abajo).
4. `compare.ts` → `compare(cur, prev)`: variaciones contra el Excel del mes anterior. `validatePair` rechaza el mismo mes o el orden invertido.
5. `awards.ts` → `checkAwards(cur, prev)`: verifica los reconocimientos de RESULTADOS contra los datos (empates, ganador distinto; "mayor incremento" solo con mes anterior).
6. `load.ts` → `buildSession(cur, prev)` junta todo en un `Session`, incluido `session.insights` (análisis + comparación + premios, ya ordenados). **Dashboard y PDF consumen el `Session`**; no recalculan nada por su cuenta.

Módulos de apoyo que conviene usar en vez de reescribir lógica:

- `rules.ts`: **única fuente** de las reglas de puntaje (umbral 100%, cobranza 90%, Productivo ≥ 10, Estable ≥ 4, puntos por indicador), `statusOf`, `meetsTarget`, `rulePoints` y `RULES_TEXT` (texto que muestran la app y el PDF). `format.ts` reexporta `statusOf`.
- `match.ts`: `matchProduct` empareja productos por **palabra completa** (evita que "UTIL TOP" tome "MANTUTIL"); `findSeller` / `findZona` resuelven nombres de pila o zonas ("Portuguesa" → hoja ACARIGUA).

Interfaz (`src/components/`): `App.tsx` alterna `UploadScreen` y `Dashboard` (cargado con `next/dynamic`, al igual que el lector de Excel en `loadFile`, para que la pantalla inicial pese poco). Las gráficas usan ECharts vía `charts/EChart.tsx`, que lee los colores de las variables CSS (`usePalette`) para respetar el modo claro y oscuro. El PDF (`pdf/Report.tsx`) usa `@react-pdf/renderer` con barras dibujadas con `View`, no imágenes; `pdf/generate.tsx` se importa dinámicamente al pulsar el botón.

## Decisiones que no son obvias

- **Fuente de cada cifra:** puntos, metas individuales y tarjetas de vendedor salen de la **hoja del vendedor**; ventas por zona y totales salen de **RESULTADOS**. Cuando discrepan no se elige en silencio: se muestra la otra cifra y se genera una alerta.
- **Puntos oficiales = los del Excel.** Si el `CUMPLE` del Excel contradice `rules.ts`, se genera una alerta `warn` (o `crit` si cambia el estado). El simulador ofrece recalcular todo con la regla.
- **Cumplimiento del equipo (`teamMetric`):** si la meta del equipo es la suma de las metas individuales (±5%), las zonas sin hoja de vendedor se excluyen de las ventas y se informan en `excluded`; si es mayor, se asume que las incluye y se usa el total.
- **PDF con Helvetica (Latin-1):** los textos pasan por `t()` en `Report.tsx`, que reemplaza `→`, `≥`, `▲`, etc. No poner `lineHeight` en el estilo de `Page` ni del contenedor: con eso react-pdf deja de dibujar el número de página (`render`) del pie.
- **SheetJS se instala desde su CDN oficial** (`https://cdn.sheetjs.com/xlsx-0.20.3/...` en `package.json`), no desde npm, porque la versión de npm (0.18.5) está desactualizada y tiene vulnerabilidades. ECharts debe ser ≥ 6.1 (XSS en 5.x).
- La paleta está en las variables CSS de `src/app/globals.css` (bloque `:root` y su versión oscura); el PDF tiene sus propios colores al inicio de `Report.tsx`.

## Datos y repositorio

- El repositorio es **público** (github.com/alexcode117/cierre-ventas). No subir Excel reales ni informes con nombres o cifras de vendedores. Las pruebas y la demo usan los ejemplos ficticios de `public/ejemplos/`, generados por `scripts/generate-examples.mjs`. El ejemplo de agosto trae inconsistencias sembradas a propósito (hoja CALCULOS con diferencias, CUMPLE erróneo, galones copiados, empate en un premio), y `tests/lib.test.ts` depende de esos valores: si se cambia el generador, actualizar las pruebas.
- El grupo de pruebas `auditoría` en `tests/lib.test.ts` cubre los hallazgos de una auditoría externa (puntos 1.1 a 1.7); mantenerlo verde al tocar el lector, el análisis o las reglas.
