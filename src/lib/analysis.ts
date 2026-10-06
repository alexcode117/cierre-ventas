import { fmt, itemKey, signed } from './format';
import { findSeller, findZona, matchProduct } from './match';
import { itemMax, nextStep, statusOf } from './rules';
import type { Insight, Line, MonthReport, Status } from './types';

export { itemMax, meetsTarget } from './rules';

export interface PointLoss { line: Line; name: string; lost: number; max: number; fails: number; n: number; avgPct: number }
export interface NearMiss { seller: string; line: Line; name: string; pct: number; needText: string; gain: number; from: Status; to: Status; score: number; newScore: number }
export interface PlanRow { vendedor: string; nombre: string; realS: number | null; metaS: number | null; gS: number | null; realP: number | null; metaP: number | null; gP: number | null; risk: 'alto' | 'medio' | 'bajo' | null }
export interface Share { zona: string; vendedor: string; v: number; p: number }
export interface CrossSell { zona: string; vendedor: string; r: number }

/** Cumplimiento del equipo en una unidad, con ventas y meta de la misma base. */
export interface TeamMetric {
  /** Ventas que se comparan contra la meta. */
  sold: number | null;
  meta: number | null;
  pct: number | null;
  /** Total vendido según RESULTADOS (incluye zonas sin meta individual). */
  total: number | null;
  /** Zonas que se dejaron fuera porque la meta del equipo no las incluye. */
  excluded: { zona: string; vendedor: string; value: number }[];
  /** Suma de las metas individuales de las hojas de vendedor. */
  sumMetas: number | null;
}

export interface Analysis {
  insights: Insight[];
  pointLoss: PointLoss[];
  totalLost: number;
  nearMiss: NearMiss[];
  plan: PlanRow[];
  share: Share[];
  crossSell: CrossSell[];
  teamCross: number | null;
  sacosPct: number | null;
  galonesPct: number | null;
  team: { sacos: TeamMetric; galones: TeamMetric };
  avgScore: number | null;
}

export function analyze(d: MonthReport): Analysis {
  const R = d.results ?? { zonas: [], total: { sacos: null, galones: null }, meta: { sacos: null, galones: null } };
  const insights: Insight[] = [];
  const add = (sev: Insight['sev'], title: string, body: string, tags: string[] = []) => insights.push({ sev, title, body, tags });

  // Pérdida de puntos por indicador
  const loss = new Map<string, PointLoss & { pcts: number[] }>();
  for (const s of d.sellers)
    for (const b of s.blocks)
      for (const it of b.items) {
        const name = itemKey(it.name);
        const k = `${b.line}|${name}`;
        const e = loss.get(k) ?? { line: b.line, name, lost: 0, max: 0, fails: 0, n: 0, avgPct: 0, pcts: [] };
        const mx = itemMax(b, it);
        if (!mx) continue; // indicadores informativos (ventas por producto en el procedimiento)
        e.max += mx;
        e.lost += mx - it.pts;
        e.n++;
        if (!it.ok) e.fails++;
        if (it.pct != null) e.pcts.push(it.pct);
        loss.set(k, e);
      }
  const pointLoss = [...loss.values()]
    .map(({ pcts, ...e }) => ({ ...e, avgPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0 }))
    .filter((x) => x.lost > 0)
    .sort((a, b) => b.lost - a.lost);
  const totalLost = pointLoss.reduce((a, b) => a + b.lost, 0);

  // Casi-logros
  const nearMiss: (NearMiss & { cost: number })[] = [];
  for (const s of d.sellers)
    for (const b of s.blocks)
      for (const it of b.items) {
        const step = nextStep(b, it);
        if (!step || it.pct == null || !it.obj || it.pct < step.pct * 0.7) continue;
        const need = (it.obj * step.pct) / 100 - (it.real ?? 0);
        if (need <= 0) continue;
        const ratio = it.obj <= 1;
        const gain = step.gain;
        const newScore = b.score + gain;
        nearMiss.push({
          seller: s.display, line: b.line, name: itemKey(it.name), pct: it.pct,
          needText: ratio ? `${fmt(need * 100)} puntos porcentuales` : `${fmt(need, 1)} unidades`,
          gain, from: b.status, to: statusOf(newScore, d.basis), score: b.score, newScore,
          cost: (ratio ? need * 100 : need) / gain,
        });
      }
  nearMiss.sort((a, b) => Number(b.to !== b.from) - Number(a.to !== a.from) || a.cost - b.cost);

  // Concentración y venta cruzada
  const zs = R.zonas.filter((z) => z.sacos != null);
  const tot = zs.reduce((a, z) => a + (z.sacos ?? 0), 0);
  const share = zs.map((z) => ({ zona: z.zona, vendedor: z.vendedor, v: z.sacos ?? 0, p: tot ? ((z.sacos ?? 0) / tot) * 100 : 0 })).sort((a, b) => b.v - a.v);
  const crossSell = R.zonas
    .filter((z) => z.sacos && z.galones != null)
    .map((z) => ({ zona: z.zona, vendedor: z.vendedor, r: ((z.galones ?? 0) / (z.sacos ?? 1)) * 100 }))
    .sort((a, b) => b.r - a.r);
  const teamCross = R.total.sacos ? ((R.total.galones ?? 0) / R.total.sacos) * 100 : null;

  const plan = buildPlan(d);

  const team = { sacos: teamMetric(d, 'sacos'), galones: teamMetric(d, 'galones') };
  const sacosPct = team.sacos.pct;
  const galonesPct = team.galones.pct;
  const avgScore = d.sellers.length ? d.sellers.reduce((a, s) => a + s.total, 0) / d.sellers.length : null;

  // ----- hallazgos -----
  if (sacosPct != null && galonesPct != null) {
    if (sacosPct >= 100 && galonesPct < 100)
      add('warn', 'Pegutil supera la meta y Pruven queda corto',
        `El equipo vendió ${fmt(sacosPct)}% de la meta de sacos pero solo ${fmt(galonesPct)}% de la de galones. Faltaron ${fmt((team.galones.meta ?? 0) - (team.galones.sold ?? 0))} galones${excludedNote(team.galones, 'galones')}; el crecimiento depende de vender Pruven a los mismos clientes de Pegutil.`, ['Pegutil', 'Pruven']);
    else if (sacosPct < 100 && galonesPct >= 100)
      add('warn', 'Pruven supera la meta y Pegutil queda corto', `Galones al ${fmt(galonesPct)}% y sacos al ${fmt(sacosPct)}% de la meta. Faltaron ${fmt((team.sacos.meta ?? 0) - (team.sacos.sold ?? 0))} sacos${excludedNote(team.sacos, 'sacos')}.`, ['Pegutil', 'Pruven']);
    else add(sacosPct >= 100 ? 'good' : 'crit', `Sacos ${fmt(sacosPct)}% · galones ${fmt(galonesPct)}% de la meta`, 'Cumplimiento del equipo en ambas líneas frente a la meta del mes.', ['Equipo']);
  }
  if (share.length >= 3) {
    const top2 = share[0].p + share[1].p;
    if (top2 >= 50)
      add('info', `Dos zonas hacen el ${fmt(top2)}% de los sacos`,
        `${share[0].zona} (${fmt(share[0].p)}%) y ${share[1].zona} (${fmt(share[1].p)}%) sostienen el volumen. Una caída en cualquiera de ellas mueve el resultado del equipo más que el resto.`, ['Riesgo']);
  }
  if (crossSell.length >= 2 && teamCross) {
    const hi = crossSell[0], lo = crossSell[crossSell.length - 1];
    const loSacos = R.zonas.find((z) => z.zona === lo.zona)?.sacos ?? 0;
    add('warn', `Venta cruzada desigual: ${fmt(hi.r, 1)} vs ${fmt(lo.r, 1)} galones por cada 100 sacos`,
      `${hi.zona} vende ${fmt(hi.r, 1)} galones Pruven por cada 100 sacos Pegutil; ${lo.zona} solo ${fmt(lo.r, 1)}. Si ${lo.zona} llegara al promedio del equipo (${fmt(teamCross, 1)}) sumaría unos ${fmt(((teamCross - lo.r) / 100) * loSacos)} galones.`, ['Pruven']);
  }
  pointLoss.filter((x) => x.n >= 3 && x.fails / x.n >= 0.75).slice(0, 2).forEach((x) =>
    add('crit', `${x.name}: falla en ${x.fails} de ${x.n} vendedores`,
      `Cumplimiento promedio ${fmt(x.avgPct)}%. Cuando casi todo el equipo falla un indicador, la causa suele estar en la meta, el precio o la disponibilidad del producto, no en el vendedor. Conviene revisarlo antes de exigirlo individualmente.`, [x.line]));
  if (pointLoss.length && totalLost) {
    const top = pointLoss.slice(0, 3);
    const sum = top.reduce((a, b) => a + b.lost, 0);
    add('info', `3 indicadores explican el ${fmt((sum / totalLost) * 100)}% de los puntos perdidos`,
      `${top.map((x) => `${x.name} ${x.line} (${fmt(x.lost, 1)} pts)`).join(', ')}. Ahí está el mayor retorno para subir el puntaje del equipo.`, ['Puntaje']);
  }
  const mover = nearMiss.find((n) => n.to !== n.from);
  if (mover)
    add('good', `${mover.seller} sube a ${mover.to.toLowerCase()} con ${mover.needText} más`,
      `En ${mover.line} tiene ${mover.name} al ${fmt(mover.pct)}%. Cerrar esa brecha suma ${fmt(mover.gain, 1)} pts (${fmt(mover.score, 1)} → ${fmt(mover.newScore, 1)}) y cambia su estado.`, ['Oportunidad']);
  else if (nearMiss[0])
    add('good', `Punto más barato de ganar: ${nearMiss[0].seller} · ${nearMiss[0].name}`,
      `Le faltan ${nearMiss[0].needText} (está al ${fmt(nearMiss[0].pct)}%) para sumar ${fmt(nearMiss[0].gain, 1)} pts en ${nearMiss[0].line}.`, ['Oportunidad']);
  const hard = plan.filter((p) => p.risk === 'alto');
  if (hard.length)
    add('crit', `Meta del próximo mes exigente para ${hard.map((p) => p.nombre).join(', ')}`,
      hard.map((p) => `${p.nombre}: ${[p.gS != null ? `sacos ${signed(p.gS)}%` : '', p.gP != null ? `Pruven ${signed(p.gP)}%` : ''].filter(Boolean).join(' · ')} sobre lo vendido este mes`).join('. ') +
        '. Sin un plan de apoyo (clientes, inventario, visitas), es probable que no se cumpla.', ['Metas']);
  const crits = d.sellers.filter((s) => s.status === 'CRITICO');
  if (crits.length)
    add('crit', `${crits.map((s) => s.display).join(', ')} en estado crítico`,
      crits.map((s) => `${s.display}: ${s.blocks.map((b) => `${b.line} ${fmt(b.score, 1)}/12`).join(' · ')}; cumple ${s.blocks.reduce((a, b) => a + b.items.filter((i) => itemMax(b, i) > 0 && i.ok).length, 0)} de ${s.blocks.reduce((a, b) => a + b.items.filter((i) => itemMax(b, i) > 0).length, 0)} indicadores`).join('. ') + '.', ['Equipo']);
  const issues = d.alerts.filter((a) => a.level !== 'info').length;
  if (issues)
    add('warn', `${issues} ${issues === 1 ? 'cifra no cuadra' : 'cifras no cuadran'} entre hojas`,
      'Hay diferencias entre las hojas del archivo. Corríjalas antes de pagar variables o presentar resultados (detalle en la pestaña Vendedores).', ['Datos']);

  const ord = { crit: 0, warn: 1, good: 2, info: 3 } as const;
  insights.sort((a, b) => ord[a.sev] - ord[b.sev]);

  return { insights, pointLoss, totalLost, nearMiss: nearMiss.map((n) => { const { cost, ...rest } = n; void cost; return rest; }), plan, share, crossSell, teamCross, sacosPct, galonesPct, team, avgScore };
}

function buildPlan(d: MonthReport): PlanRow[] {
  if (!d.metas) return [];
  const iS = d.metas.cols.findIndex((c) => /SACOS/i.test(c));
  const prodCols = d.metas.cols.map((_, i) => i).filter((i) => i !== iS && !/CLIENTES/i.test(d.metas!.cols[i]) && d.metas!.cols[i]);

  return d.metas.rows
    .filter((r) => !/GENERAL|TOTAL/i.test(r.vendedor))
    .map((r) => {
      const s = findSeller(d, r.vendedor);
      const z = findZona(d, r.vendedor);
      const realS = z?.sacos ?? s?.sacos.real ?? null;
      const metaS = iS >= 0 ? r.values[iS] : null;
      let realP: number | null = null, metaP: number | null = null;
      const pb = s?.blocks.find((b) => b.line === 'Pruven');
      if (pb) {
        let rp = 0, mp = 0;
        for (const i of prodCols) {
          // Palabras completas: "UTIL TOP" no debe tomar "MANTUTIL".
          const it = matchProduct(d.metas!.cols[i], pb.items);
          if (it && r.values[i] != null) { rp += it.real ?? 0; mp += r.values[i]!; }
        }
        if (mp) { realP = rp; metaP = mp; }
      }
      const gS = realS && metaS ? (metaS / realS - 1) * 100 : null;
      const gP = realP && metaP ? (metaP / realP - 1) * 100 : null;
      const worst = Math.max(gS ?? -Infinity, gP ?? -Infinity);
      const nombre = s?.display ?? (z ? (z.vendedor && z.vendedor !== '-' ? z.vendedor : z.zona) : r.vendedor);
      return { vendedor: r.vendedor, nombre, realS, metaS, gS, realP, metaP, gP, risk: worst === -Infinity ? null : worst > 40 ? 'alto' : worst > 15 ? 'medio' : 'bajo' };
    });
}

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * 0.05;

/**
 * Cumplimiento del equipo comparando ventas y meta de la misma base. Si la meta del equipo es (casi)
 * la suma de las metas individuales, las zonas sin meta propia (sin hoja de vendedor) quedan fuera
 * de las ventas; si la meta del equipo es mayor, se asume que ya las incluye y se usa el total.
 */
function teamMetric(d: MonthReport, key: 'sacos' | 'galones'): TeamMetric {
  const R = d.results;
  const total = R?.total[key] ?? null;
  const meta = R?.meta[key] ?? null;
  const zonas = R?.zonas ?? [];
  const metaOf = (sheet: string | null) => d.sellers.find((s) => s.sheet === sheet)?.[key].meta ?? null;
  const withMeta = zonas.filter((z) => metaOf(z.sheet) != null);
  const sumMetas = withMeta.length ? withMeta.reduce((a, z) => a + (metaOf(z.sheet) ?? 0), 0) : null;
  const without = zonas.filter((z) => metaOf(z.sheet) == null && (z[key] ?? 0) > 0);
  if (meta && sumMetas != null && without.length && near(meta, sumMetas)) {
    const sold = withMeta.reduce((a, z) => a + (z[key] ?? 0), 0);
    return { sold, meta, pct: (sold / meta) * 100, total, sumMetas, excluded: without.map((z) => ({ zona: z.zona, vendedor: z.vendedor, value: z[key] ?? 0 })) };
  }
  return { sold: total, meta, pct: meta && total != null ? (total / meta) * 100 : null, total, sumMetas, excluded: [] };
}

function excludedNote(m: TeamMetric, unit: string): string {
  if (!m.excluded.length) return '';
  return ` (sin contar ${m.excluded.map((z) => `${z.vendedor && z.vendedor !== '-' ? z.vendedor : z.zona}, ${fmt(z.value)} ${unit}`).join('; ')}, que no ${m.excluded.length > 1 ? 'tienen' : 'tiene'} meta individual)`;
}
