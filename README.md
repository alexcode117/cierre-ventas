# Cierre de Ventas

Convierte el Excel mensual de indicadores del equipo de ventas en un dashboard interactivo y en un informe PDF que queda como constancia del cierre.

- **Sin servidor ni base de datos.** El Excel se procesa en el navegador; nada se sube ni se guarda.
- **Comparación opcional** con el Excel del mes anterior: variaciones por vendedor, cambios de estado e indicadores incumplidos dos meses seguidos.
- **Informe PDF** con la huella SHA-256 de cada archivo, para comprobar de qué Excel exacto salió.

## Qué muestra

| Pestaña | Contenido |
|---|---|
| Resumen | Sacos y galones contra meta, puntaje promedio, puntos perdidos por indicador, puntos al alcance y, si hay mes anterior, la evolución del puntaje de cada vendedor |
| Vendedores | Ranking con puntaje Pegutil/Pruven, mapa de cumplimiento (% de meta, lo que falta, puntos o cambio vs mes anterior), detalle por vendedor y revisión de inconsistencias del archivo |
| Zonas y productos | Participación, ventas por zona contra meta, cumplimiento por producto Pruven y reconocimientos |
| Metas | Metas del próximo mes (hoja METAS): si son alcanzables, nivel de riesgo y detalle por producto frente a lo logrado en el mes |
| Simulador | Mueve el resultado de cada indicador y recalcula puntaje y estado del vendedor |
| Procedimiento | Excel frente al Procedimiento de KPI's, fórmulas y rangos, y tabla de incentivos oficial frente a RESULTADOS |

## Formato del Excel

El lector sigue la estructura del libro `INDICADORES.xlsx`:

- **Una hoja por vendedor o zona** con dos bloques de indicadores (Pegutil y Pruven). Cada bloque tiene una fila de encabezado con `INDICADOR`, `OBJETIVO`, `REAL`, `%`, `CUMPLE` y `VALORACION`, y un título como `INDICADORES MENSUALES ... (ESTABLE)`. Debajo del último bloque van las filas `META`, `VENTAS` y `% ALCANZADO` de galones.
- **`RESULTADOS`**: título `RESULTADOS <MES> <AÑO>` (si no coincide con el mes del nombre del archivo o con el anterior al de METAS, se usa ese y se avisa), tabla `ZONA / Vendedor / Sacos Vendidos / Galones Vendidos` con filas `TOTAL`, `META` y `% ALCANZADO`, y los bloques `VARIABLE PEGUTL` y `VARIABLE PRUVEN`.
- **`METAS`**: título `METAS MES <MES>` y tabla `VENDEDOR / SACOS / CAUCHO / ...`.
- **`CALCULOS`** (opcional): sus bloques (`VENDEDOR / Meta … / Ventas`, `TOTAL GALONES`, `CLIENTES NUEVOS …`, `ATENCION DE CARTERA …`) se comparan con las hojas de vendedor y con RESULTADOS; cada diferencia aparece en *Revisión del archivo*.

Las celdas se buscan por su texto, no por posición fija, así que mover tablas de lugar no rompe la lectura. Si cambia el nombre de una columna o de una hoja, el ajuste se hace en `src/lib/parser.ts`.

## Reglas y fuentes de cada cifra

Hay dos bases de cálculo de puntos y estados, que se eligen con el selector **Puntos según: Procedimiento / Excel** del dashboard. Las reglas de ambas están en `src/lib/rules.ts`.

- **Procedimiento** (por defecto): *Procedimiento para el cálculo de KPI's e incentivos de ventas* (modificado el 13/10/2026). Cuatro indicadores por línea con tramos de puntos:
  - Crecimiento en ventas (ventas ÷ meta; sacos en Pegutil, galones en Pruven) y cobranza a tiempo: 3 pts desde el 100%, 2 pts desde el 90%, 1 pt desde el 80%.
  - Atención de cartera (clientes atendidos ÷ objetivo del Excel, que es el 70% de la cartera): 3 pts desde el 70%, 2 pts desde el 60%, 1 pt desde el 50%.
  - Nuevos clientes: 3 pts al 100%, 1,5 pts desde el 50%.
  - Incentivos: crecimiento en ventas 0,70%, cobranza 0,45%, cartera 0,13% (Pegutil) o 0,12% (Pruven), nuevos clientes 0,10%. Total 1,38% en Pegutil y 1,37% en Pruven.
  - Estados (escala corregida por la gerencia, igual en las dos bases): Productivo más de 9, Estable más de 3 y hasta 9, Crítico 3 o menos, por empresa: un vendedor puede ser Productivo en Pegutil y Estable en Pruven, y así se muestra en tarjetas, resumen y PDF. Reemplaza la del documento (≥ 7 / 4 a 6 / < 3) y la leyenda del Excel (> 10 / 4 a 9 / < 3), que dejaban puntajes sin clasificar.
  - Las ventas por producto de Pruven se muestran como información, sin puntos.
- **Excel**: los puntos del libro, que aplica los mismos tramos; la diferencia es que en Pruven el crecimiento se reparte en ventas por producto (0,5 pts cada una desde el 80% de su meta). Si un puntaje del Excel no corresponde a la regla, se marca como **Revisar** (o **Crítico** si cambia el estado).

La pestaña **Procedimiento** compara las dos bases indicador por indicador y valida la tabla de incentivos de RESULTADOS contra la oficial: porcentajes, ganadores (incluido el empate) y premios oficiales que el Excel no asigna. El premio "Mejor manejo de variables" del documento no se usa.

Fuente de cada cifra:

- **Puntos, metas individuales y tarjetas de vendedor:** la hoja de cada vendedor. Si RESULTADOS dice otra cosa, la tarjeta lo muestra.
- **Ventas por zona y totales del equipo:** RESULTADOS.
- **Cumplimiento del equipo:** ventas y meta de la misma base. Si la meta del equipo es la suma de las metas individuales, las zonas sin hoja (sin meta propia) se excluyen de las ventas y se informan aparte.
- **Reconocimientos:** "Mayor incremento" se mide en % de la meta (solo cuenta por encima del 100%). Cobranza, manejo de cartera y nuevos clientes se premian por valor absoluto: el que más cobró (bloque `META COBRANZA` con la columna `Cobrado` en CALCULOS), el que más clientes de la cartera atendió y el que más clientes nuevos activó (CALCULOS si lo trae; si no, las hojas de vendedor).

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
