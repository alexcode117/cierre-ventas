import type { Item, MonthReport, Seller, Zona } from './types';

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palabras de un nombre de producto, sin "VENTAS", "PASTA" ni plurales: "VENTAS CAUCHOS - PASTA" → ["CAUCHO"]. */
export function productWords(name: string): string[] {
  return deaccent(name.toUpperCase())
    .replace(/^\s*VENTAS\s+/, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 'PASTA')
    .map((w) => (w.length > 3 ? w.replace(/S$/, '') : w));
}

/**
 * Busca el indicador de ventas que corresponde a un producto ("UTIL TOP", "Caucho", "Esmalte").
 * Compara palabras completas: "UTIL TOP" no coincide con "MANTUTIL" aunque contenga "UTIL".
 */
export function matchProduct(product: string, items: Item[]): Item | undefined {
  const target = productWords(product);
  if (!target.length) return undefined;
  const sales = items.filter((i) => /^\s*VENTAS/i.test(i.name) && !/SACOS/i.test(i.name));
  const key = target.join(' ');
  return (
    sales.find((i) => productWords(i.name).join(' ') === key) ??
    sales.find((i) => {
      const w = productWords(i.name);
      return target.every((t) => w.includes(t));
    })
  );
}

const firstToken = (s: string) => deaccent(s.toUpperCase()).trim().split(/\s+/)[0] ?? '';

/** Encuentra la hoja de un vendedor por su nombre, nombre de pila o zona ("Portuguesa" → hoja ACARIGUA). */
export function findSeller(d: MonthReport, name: string): Seller | undefined {
  const t = firstToken(name);
  if (!t || t === '-') return undefined;
  return (
    d.sellers.find((s) => firstToken(s.sheet) === t) ??
    d.sellers.find((s) => deaccent(s.sheet.toUpperCase()).split(/\s+/).includes(t)) ??
    d.sellers.find((s) => s.zona && deaccent(s.zona.toUpperCase()).split(/\s+/).includes(t))
  );
}

/** Fila de RESULTADOS de un vendedor o zona. */
export function findZona(d: MonthReport, name: string): Zona | undefined {
  const t = firstToken(name);
  const zonas = d.results?.zonas ?? [];
  const words = (s: string) => deaccent(s.toUpperCase()).split(/\s+/);
  return zonas.find((z) => words(z.vendedor).includes(t) || words(z.zona).includes(t)) ?? (() => {
    const s = findSeller(d, name);
    return s ? zonas.find((z) => z.sheet === s.sheet) : undefined;
  })();
}
