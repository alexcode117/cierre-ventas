// Genera Excel de ejemplo con datos ficticios y la misma estructura del libro INDICADORES.
// Uso: node scripts/generate-examples.mjs
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';

const PRODUCTS = [
  ['VENTAS CAUCHOS - PASTA ', 'caucho'],
  ['VENTAS MANTUTIL', 'mantutil'],
  ['VENTAS ESMALTES', 'esmaltes'],
  ['VENTAS UTIL TOP', 'utiltop'],
  ['VENTAS METYLUTIL', 'metyl'],
  ['VENTAS OXIDO', 'oxido'],
];

const statusOf = (s) => (s >= 10 ? 'PRODUCTIVO' : s >= 4 ? 'ESTABLE' : 'CRITICO');

function row(name, obj, real, max, override = {}) {
  const pct = (real / obj) * 100;
  const ok = override.ok ?? (/COBRANZA/.test(name) ? real / obj >= 0.9 : pct >= 100);
  return [null, name, obj, real, pct, ok ? 'SI' : 'NO', ok ? max : 0];
}

function sellerSheet(s) {
  const peg = [
    row('VENTAS (SACOS)', s.peg.sacos[0], s.peg.sacos[1], 3, s.peg.sacosOverride),
    row('COBRANZA META PEGUTIL', 1, s.peg.cobr, 3),
    row('NUEVOS CLIENTES  PEGUTIL', 2, s.peg.nc, 3),
    row('ATENCION DE CARTERA (70%)', s.peg.cart[0], s.peg.cart[1], 3),
  ];
  const pru = [
    ...PRODUCTS.map(([n, k]) => row(n, s.pru[k][0], s.pru[k][1], 0.5)),
    row('COBRANZA META PRUVEN', 1, s.pru.cobr, 3),
    row('NUEVOS CLIENTES  PRUVEN', 2, s.pru.nc, 3),
    row('ATENCION DE CARTERA (70%)', s.pru.cart[0], s.pru.cart[1], 3),
  ];
  const sum = (rows) => rows.reduce((a, r) => a + r[6], 0);
  const pegScore = sum(peg), pruScore = sum(pru);
  const head = ['INDICADOR', 'OBJETIVO', 'REAL', '%', 'CUMPLE', 'VALORACION'];
  const t = (score) => `INDICADORES MENSUALES ${s.zonaTitulo} ${s.corto}  (${s.titleStatus?.[0] ?? statusOf(score)})`;
  const galReal = s.galSheet ?? s.galones;
  const aoa = [
    [],
    [null, t(pegScore), null, null, null, null, null, null, 'PRODUCTIVO', ' MAYOR A DE 10 PUNTOS'],
    [null, ...head, null, 'ESTABLE', 'DE 4 A 9 PUNTOS'],
    ...peg.map((r, i) => (i === 0 ? [...r, null, 'CRITICO', 'MENOR A 3'] : r)),
    [null, null, null, null, null, null, s.pegStated ?? pegScore],
    [],
    [null, s.titleStatus?.[1] ? t(pruScore).replace(/\((\w+)\)/, `(${s.titleStatus[1]})`) : t(pruScore)],
    [null, ...head],
    ...pru,
    [null, null, null, null, null, null, pruScore],
    [],
    [null, 'META', s.galMeta],
    [null, 'VENTAS ', galReal],
    [null, '% ALCANZADO', (galReal / s.galMeta) * 100],
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

function build(mes, sellers, extra, awards, metas) {
  const wb = XLSX.utils.book_new();
  for (const s of sellers) XLSX.utils.book_append_sheet(wb, sellerSheet(s), s.sheet);

  const zonas = [...sellers.map((s) => [s.zona, s.vendedor, s.sacosResultados ?? s.peg.sacos[1], s.galones]), ...extra];
  const tot = zonas.reduce((a, z) => [a[0] + z[2], a[1] + z[3]], [0, 0]);
  const res = [
    [],
    [null, `RESULTADOS ${mes}`, null, null, null, null, 'VARIABLE PEGUTL', 'EJECUTIVO', '% SOBRE VENTAS'],
    [null, 'ZONA', 'Vendedor', 'Sacos Vendidos', 'Galones Vendidos', null, ...awards.peg[0]],
    [null, null, null, null, null, null, ...awards.peg[1]],
    ...zonas.map((z, i) => [null, ...z, null, ...(awards.peg[i + 2] ?? [])]),
    [null, 'TOTAL', null, tot[0], tot[1], null, 'VARIABLE PRUVEN', 'EJECUTIVO', '% SOBRE VENTAS'],
    ...awards.pru.map((a, i) => (i === 1 ? [null, 'META', null, metas.team[0], metas.team[1], null, ...a] : i === 2 ? [null, '% ALCANZADO', null, tot[0] / metas.team[0], tot[1] / metas.team[1], null, ...a] : [null, null, null, null, null, null, ...a])),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(res), 'RESULTADOS');

  const cols = ['SACOS', 'CAUCHO', 'MANTUTIL', 'ESMALTES', 'UTIL TOP', 'METYLUTIL', 'OXIDO', 'CIENTES NUEVOS'];
  const general = cols.map((_, i) => metas.next.reduce((a, r) => a + (r[i + 1] ?? 0), 0));
  const met = [[null, metas.title], [null, 'VENDEDOR', ...cols], ...metas.next.map((r) => [null, ...r]), [null, 'Meta General', ...general]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(met), 'METAS');
  return wb;
}

// ---------- datos ficticios ----------
const base = (o) => ({ caucho: [700, 0], mantutil: [100, 0], esmaltes: [150, 0], utiltop: [32, 0], metyl: [7, 0], oxido: [144, 0], ...o });

const agosto = [
  { sheet: 'LAURA MENDEZ', corto: 'LAURA', vendedor: 'Laura Méndez', zona: 'Centro Oeste', zonaTitulo: 'CENTRO OESTE',
    peg: { sacos: [3500, 6120], cobr: 0.95, nc: 4, cart: [43.4, 47] },
    pru: base({ caucho: [700, 860], mantutil: [100, 112], esmaltes: [180, 214], utiltop: [32, 71.5], metyl: [7, 10], oxido: [144, 62], cobr: 0.95, nc: 2, cart: [49, 58] }),
    galMeta: 1150, galones: 1328.5, titleStatus: ['PRODUCTIVO', 'PRODUCTIVO'] },
  { sheet: 'MARIO TORREALBA', corto: 'MARIO', vendedor: 'Mario Torrealba', zona: 'Valle Norte', zonaTitulo: 'VALLE NORTE',
    peg: { sacos: [3500, 5210], cobr: 0.9, nc: 5, cart: [44.8, 58] },
    pru: base({ caucho: [700, 640], mantutil: [100, 104], esmaltes: [120, 61], utiltop: [32, 35.2], metyl: [7, 4], oxido: [144, 80], cobr: 0.9, nc: 3, cart: [44.8, 35] }),
    galMeta: 1100, galones: 924.2 },
  { sheet: 'PATRICIA YANEZ', corto: 'PATRICIA', vendedor: 'Patricia Yánez', zona: 'Centro Este', zonaTitulo: 'CENTRO ESTE',
    peg: { sacos: [2800, 2510], cobr: 0.8, nc: 4, cart: [42, 25], sacosOverride: { ok: true } },
    pru: base({ caucho: [600, 310], mantutil: [80, 76], esmaltes: [100, 88.5], utiltop: [32, 44.1], metyl: [7, 8.5], oxido: [144, 41], cobr: 0.9, nc: 2, cart: [42, 35] }),
    galMeta: 960, galones: 568.1, sacosResultados: 2632 },
  { sheet: 'ZONA LLANOS', corto: '', vendedor: '-', zona: 'Llanos', zonaTitulo: 'ZONA LLANOS',
    peg: { sacos: [3500, 2180], cobr: 0.9, nc: 1, cart: [39.9, 18] },
    pru: base({ caucho: [700, 92], mantutil: [80, 40], esmaltes: [120, 38.75], utiltop: [32, 6.5], metyl: [7, 2], oxido: [144, 49], cobr: 0.8, nc: 2, cart: [39.9, 21] }),
    galMeta: 1080, galones: 243.8, galSheet: 568.1 },
];
const julio = [
  { ...agosto[0], peg: { sacos: [3500, 5480], cobr: 0.95, nc: 3, cart: [43.4, 44] }, pru: base({ caucho: [700, 790], mantutil: [100, 98], esmaltes: [180, 190], utiltop: [32, 58], metyl: [7, 8], oxido: [144, 70], cobr: 0.9, nc: 2, cart: [49, 52] }), galMeta: 1150, galones: 1214, titleStatus: undefined },
  { ...agosto[1], peg: { sacos: [3500, 4890], cobr: 0.9, nc: 3, cart: [44.8, 50] }, pru: base({ caucho: [700, 720], mantutil: [100, 101], esmaltes: [120, 95], utiltop: [32, 30], metyl: [7, 6], oxido: [144, 88], cobr: 0.9, nc: 2, cart: [44.8, 41] }), galMeta: 1100, galones: 1040 },
  { ...agosto[2], peg: { sacos: [2800, 2940], cobr: 0.9, nc: 3, cart: [42, 33] }, pru: base({ caucho: [600, 420], mantutil: [80, 82], esmaltes: [100, 104], utiltop: [32, 40], metyl: [7, 7], oxido: [144, 52], cobr: 0.9, nc: 2, cart: [42, 38] }), galMeta: 960, galones: 705, sacosResultados: undefined },
  { ...agosto[3], peg: { sacos: [3500, 2450], cobr: 0.9, nc: 2, cart: [39.9, 22] }, pru: base({ caucho: [700, 140], mantutil: [80, 46], esmaltes: [120, 52], utiltop: [32, 9], metyl: [7, 3], oxido: [144, 55], cobr: 0.8, nc: 1, cart: [39.9, 24] }), galMeta: 1080, galones: 312, galSheet: undefined },
];

const awards = (who) => ({
  peg: [['MAYOR INCREMENTO EN VENTAS PEGUTIL', who[0], 0.7], ['MEJOR COBRANZA PEGUTIL', who[0], 0.45], ['NUEVOS CLIENTES', who[1], 0.1], ['MEJOR MANEJO DE CARTERA ', who[1], 0.13]],
  pru: [['MAYOR INCREMENTO EN VENTAS ', who[0], 0.6], ['MEJOR COBRANZA', who[0], 0.45], ['NUEVOS CLIENTES', who[1], 0.1], ['MEJOR MANEJO DE CARTERA ', who[0], 0.12]],
});

const metasSep = [
  ['Laura', 4500, 700, 100, 180, 40, 7, 120, 2],
  ['Mario', 4000, 700, 100, 120, 40, 7, 120, 2],
  ['Llanos', 4000, 700, 100, 120, 40, 7, 120, 6],
  ['Patricia', 3000, 600, 80, 100, 40, 7, 120, 4],
  ['Daniela', 4000, null, null, null, null, null, null, null],
];
const metasAgo = [
  ['Laura', 3500, 700, 100, 180, 32, 7, 144, 2],
  ['Mario', 3500, 700, 100, 120, 32, 7, 144, 2],
  ['Llanos', 3500, 700, 80, 120, 32, 7, 144, 2],
  ['Patricia', 2800, 600, 80, 100, 32, 7, 144, 2],
  ['Daniela', 3500, null, null, null, null, null, null, null],
];

mkdirSync('public/ejemplos', { recursive: true });
const write = (wb, file) => writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
write(build('AGOSTO 2026', agosto, [['Centro Norte', 'Daniela Chirinos', 4410, 561.2]], awards(['LAURA', 'MARIO']), { title: 'METAS MES SEPTIEMBRE', team: [16800, 4290], next: metasSep }), 'public/ejemplos/ejemplo-agosto-2026.xlsx');
write(build('JULIO 2026', julio, [['Centro Norte', 'Daniela Chirinos', 4120, 598]], awards(['LAURA', 'PATRICIA']), { title: 'METAS MES AGOSTO', team: [16800, 4290], next: metasAgo }), 'public/ejemplos/ejemplo-julio-2026.xlsx');
console.log('Ejemplos generados en public/ejemplos/');
