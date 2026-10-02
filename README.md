# Cierre de Ventas

Convierte el Excel mensual de indicadores del equipo de ventas en un dashboard interactivo y en un informe PDF que queda como constancia del cierre.

- **Sin servidor ni base de datos.** El Excel se procesa en el navegador; nada se sube ni se guarda.
- **Comparación opcional** con el Excel del mes anterior: variaciones por vendedor, cambios de estado e indicadores incumplidos dos meses seguidos.
- **Informe PDF** con la huella SHA-256 de cada archivo, para comprobar de qué Excel exacto salió.

## Qué muestra

| Pestaña | Contenido |
|---|---|
| Resumen | Sacos y galones contra meta, puntaje promedio, venta cruzada, hallazgos priorizados, puntos perdidos por indicador, puntos al alcance y, si hay mes anterior, la evolución del puntaje de cada vendedor |
| Vendedores | Ranking con puntaje Pegutil/Pruven, mapa de cumplimiento (% de meta, lo que falta, puntos o cambio vs mes anterior), detalle por vendedor y revisión de inconsistencias del archivo |
| Zonas y productos | Ventas por zona contra meta, venta cruzada, participación, cumplimiento por producto Pruven, metas del próximo mes con nivel de riesgo y reconocimientos |
| Simulador | Mueve el resultado de cada indicador y recalcula puntaje y estado del vendedor |

## Formato del Excel

El lector sigue la estructura del libro `INDICADORES.xlsx`:

- **Una hoja por vendedor o zona** con dos bloques de indicadores (Pegutil y Pruven). Cada bloque tiene una fila de encabezado con `INDICADOR`, `OBJETIVO`, `REAL`, `%`, `CUMPLE` y `VALORACION`, y un título como `INDICADORES MENSUALES ... (ESTABLE)`. Debajo del último bloque van las filas `META`, `VENTAS` y `% ALCANZADO` de galones.
- **`RESULTADOS`**: título `RESULTADOS <MES> <AÑO>`, tabla `ZONA / Vendedor / Sacos Vendidos / Galones Vendidos` con filas `TOTAL`, `META` y `% ALCANZADO`, y los bloques `VARIABLE PEGUTL` y `VARIABLE PRUVEN`.
- **`METAS`**: título `METAS MES <MES>` y tabla `VENDEDOR / SACOS / CAUCHO / ...`.
- **`CALCULOS`** (opcional): sus bloques (`VENDEDOR / Meta … / Ventas`, `TOTAL GALONES`, `CLIENTES NUEVOS …`, `ATENCION DE CARTERA …`) se comparan con las hojas de vendedor y con RESULTADOS; cada diferencia aparece en *Revisión del archivo*.

Las celdas se buscan por su texto, no por posición fija, así que mover tablas de lugar no rompe la lectura. Si cambia el nombre de una columna o de una hoja, el ajuste se hace en `src/lib/parser.ts`.

## Reglas y fuentes de cada cifra

Las reglas de puntaje están en un solo archivo, `src/lib/rules.ts`, y las usan el lector, el análisis, el simulador y el PDF:

- Un indicador se cumple con el 100% del objetivo; cobranza, con el 90%.
- Cada línea suma hasta 12 puntos: Productivo desde 10, Estable desde 4, Crítico por debajo de 4. La leyenda del Excel ("mayor a 10", "de 4 a 9", "menor a 3") deja huecos en 3 y entre 9 y 10; la herramienta lo indica en la revisión del archivo.
- Los puntos oficiales son los del Excel. Si el CUMPLE del Excel contradice la regla, se marca como **Revisar** (o **Crítico** si cambia el estado del vendedor) y el simulador permite recalcular todo con la regla.

Fuente de cada cifra:

- **Puntos, metas individuales y tarjetas de vendedor:** la hoja de cada vendedor. Si RESULTADOS dice otra cosa, la tarjeta lo muestra.
- **Ventas por zona y totales del equipo:** RESULTADOS.
- **Cumplimiento del equipo:** ventas y meta de la misma base. Si la meta del equipo es la suma de las metas individuales, las zonas sin hoja (sin meta propia) se excluyen de las ventas y se informan aparte.
- **Reconocimientos:** se verifican contra las hojas de vendedor (empates, ganador distinto). "Mayor incremento" solo se verifica si se carga el mes anterior.

## Desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:3000 y usa **Probar con archivos de ejemplo**. Los ejemplos de `public/ejemplos/` tienen datos ficticios y se regeneran con:

```bash
node scripts/generate-examples.mjs
```

Pruebas (lector, análisis, comparación y generación del PDF; los PDF de prueba quedan en `tests/.output/`):

```bash
npx vitest run
```

## Publicar en Vercel

1. Sube el repositorio a GitHub.
2. En [vercel.com/new](https://vercel.com/new), importa el repositorio. Vercel detecta Next.js; no hace falta configurar nada ni definir variables de entorno.
3. Cada `git push` a la rama principal publica una nueva versión.

El sitio es estático (`output: 'export'` en `next.config.ts`), así que también puede publicarse en cualquier hosting de archivos estáticos con el contenido de `out/` tras `npm run build`.

## Estructura

```
src/lib/          lectura del Excel, análisis, comparación y huella SHA-256 (sin dependencias de la interfaz)
src/components/   pantalla de carga, dashboard, gráficas (ECharts) e informe PDF (react-pdf)
scripts/          generador de los Excel de ejemplo
tests/            pruebas con Vitest
```

## Colores

La paleta está en las variables de `src/app/globals.css` (bloque `:root` y su versión oscura). Para aplicar colores corporativos basta con cambiar ese bloque; el PDF usa los mismos tonos definidos al inicio de `src/components/pdf/Report.tsx`.
