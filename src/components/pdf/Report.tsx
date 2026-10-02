import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { prevItem } from '@/lib/compare';
import { band, fmt, prettyItem, STATUS_LABEL, titleCase } from '@/lib/format';
import type { LoadedFile, Session } from '@/lib/load';
import type { Insight, Status } from '@/lib/types';

// Helvetica (fuente estándar del PDF) solo cubre Latin-1: se reemplazan los símbolos que no incluye.
const t = (s: string | number) =>
  String(s).replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/▲/g, '+').replace(/▼/g, '-').replace(/[“”]/g, '"');

const C = {
  ink: '#16181a', ink2: '#4e5458', ink3: '#7d8387', line: '#dfe2df', line2: '#eceeec', panel: '#f6f7f5', accent: '#1d5fae',
  peg: '#2a78d6', pru: '#eb6834', prev: '#b9bdb9',
  good: '#0ca30c', goodBg: '#e2f3e2', goodInk: '#0b6b0b',
  warn: '#fab219', warnBg: '#fdf1d6', warnInk: '#8a5a00',
  crit: '#d03b3b', critBg: '#f9e1e1', critInk: '#a32626',
};
const STATUS_C: Record<Status, [string, string]> = { PRODUCTIVO: [C.goodBg, C.goodInk], ESTABLE: [C.warnBg, C.warnInk], CRITICO: [C.critBg, C.critInk] };
const BAND_C = { good: [C.goodBg, C.goodInk], warn: [C.warnBg, C.warnInk], crit: [C.critBg, C.critInk], none: ['#ffffff', C.ink3] } as const;
const SEV_C = { crit: C.crit, warn: C.warn, good: C.good, info: C.accent };

const st = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 54, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9.5, color: C.ink },
  // Sin lineHeight en la página ni en el contenido: con él, react-pdf deja de dibujar el número de página.
  body: { flexGrow: 1 },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.2, color: C.ink3, textTransform: 'uppercase' },
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 26, lineHeight: 1.1 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginBottom: 2 },
  sub: { fontSize: 8.5, color: C.ink2, marginBottom: 8 },
  section: { marginBottom: 16 },
  row: { flexDirection: 'row' },
  th: { fontSize: 7, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.6, paddingVertical: 4, paddingHorizontal: 4 },
  td: { paddingVertical: 4, paddingHorizontal: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  mono: { fontFamily: 'Courier', fontSize: 8 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.ink3 },
});

const RISK: Record<'alto' | 'medio' | 'bajo', Status> = { alto: 'CRITICO', medio: 'ESTABLE', bajo: 'PRODUCTIVO' };
const Pill = ({ s, label }: { s: Status; label?: string }) => (
  <Text style={{ backgroundColor: STATUS_C[s][0], color: STATUS_C[s][1], fontSize: 7, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 6, fontFamily: 'Helvetica-Bold' }}>{(label ?? STATUS_LABEL[s]).toUpperCase()}</Text>
);

function Section({ title, sub, children, wrap = true }: { title: string; sub?: string; children: ReactNode; wrap?: boolean }) {
  return (
    <View style={st.section} wrap={wrap}>
      <View wrap={false}>
        <Text style={st.h2}>{t(title)}</Text>
        {sub ? <Text style={st.sub}>{t(sub)}</Text> : <View style={{ height: 6 }} />}
      </View>
      {children}
    </View>
  );
}

/** Barra horizontal con marca de meta y valor del mes anterior. */
function HBar({ label, sub, value, max, color, meta, prev, right }: { label: string; sub?: string; value: number; max: number; color: string; meta?: number | null; prev?: number | null; right: string }) {
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <View style={[st.row, { alignItems: 'center', marginBottom: 5 }]} wrap={false}>
      <View style={{ width: 120 }}>
        <Text>{t(label)}</Text>
        {sub ? <Text style={{ fontSize: 7, color: C.ink3 }}>{t(sub)}</Text> : null}
      </View>
      <View style={{ flex: 1, height: prev != null ? 16 : 11, position: 'relative', backgroundColor: C.line2, borderRadius: 2 }}>
        {prev != null && <View style={{ position: 'absolute', left: 0, bottom: 0, height: 4, width: w(prev), backgroundColor: C.prev, borderRadius: 1 }} />}
        <View style={{ position: 'absolute', left: 0, top: 0, height: 11, width: w(value), backgroundColor: color, borderRadius: 2 }} />
        {meta ? <View style={{ position: 'absolute', top: -2, height: prev != null ? 20 : 15, width: 1.5, left: w(meta), backgroundColor: C.ink }} /> : null}
      </View>
      <Text style={[st.bold, { width: 62, textAlign: 'right' }]}>{t(right)}</Text>
    </View>
  );
}

function InsightRow({ i }: { i: Insight }) {
  return (
    <View style={[st.row, { marginBottom: 6 }]} wrap={false}>
      <View style={{ width: 3, backgroundColor: SEV_C[i.sev], marginRight: 8, borderRadius: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[st.bold, { fontSize: 9.5 }]}>{t(i.title)}</Text>
        <Text style={{ color: C.ink2, fontSize: 8.5 }}>{t(i.body)}</Text>
      </View>
    </View>
  );
}

function Kpi({ label, value, sub, extra }: { label: string; value: string; sub: string; extra?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.panel, borderRadius: 4, padding: 9 }}>
      <Text style={st.eyebrow}>{t(label)}</Text>
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 19, lineHeight: 1.15, marginTop: 4, marginBottom: 3 }}>{t(value)}</Text>
      <Text style={{ fontSize: 8, color: C.ink2 }}>{t(sub)}</Text>
      {extra ? <Text style={{ fontSize: 8, color: extra.startsWith('+') ? C.goodInk : C.critInk, marginTop: 1 }}>{t(extra)}</Text> : null}
    </View>
  );
}

const Footer = ({ month }: { month: string }) => (
  <View style={st.footer} fixed>
    <Text>{t(`Informe de cierre · ${month}`)}</Text>
    <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
  </View>
);

const pctDelta = (cur?: number | null, prev?: number | null) => (cur != null && prev ? ((cur - prev) / prev) * 100 : null);
const signedPct = (v: number | null, label: string) => (v == null ? undefined : `${v >= 0 ? '+' : '-'}${fmt(Math.abs(v), 1)}% vs ${label}`);
const fileSize = (n: number) => (n > 1e6 ? `${fmt(n / 1e6, 1)} MB` : `${fmt(n / 1e3, 0)} KB`);

export default function ReportDoc({ s }: { s: Session }) {
  const { cur, prev, analysis: a, comparison: c } = s;
  const d = cur.report;
  const R = d.results;
  const month = titleCase(d.month ?? 'Mes sin identificar');
  const prevShort = c ? titleCase(c.prevMonth.replace(/\s*20\d\d/, '')).toLowerCase() : '';
  const insights = [...(c?.insights ?? []), ...a.insights].sort((x, y) => ({ crit: 0, warn: 1, good: 2, info: 3 })[x.sev] - ({ crit: 0, warn: 1, good: 2, info: 3 })[y.sev]);
  const when = s.generatedAt.toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });
  const zonas = R?.zonas ?? [];
  const metaOf = (sheet: string | null) => d.sellers.find((x) => x.sheet === sheet);
  const prevZona = (zona: string) => prev?.report.results?.zonas.find((z) => z.zona.toUpperCase() === zona.toUpperCase());
  const sellerCols = d.sellers.length;
  const cellW = Math.min(80, Math.floor(370 / Math.max(1, sellerCols)));

  const fileRow = (label: string, f: LoadedFile) => (
    <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, paddingVertical: 7 }} wrap={false}>
      <View style={st.row}>
        <Text style={[st.eyebrow, { width: 110 }]}>{label}</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.bold}>{t(f.name)}</Text>
          <Text style={{ color: C.ink2, fontSize: 8.5 }}>{t(`${titleCase(f.report.month ?? 'Mes no identificado')} · ${fileSize(f.size)} · ${f.report.sellers.length} vendedores con hoja`)}</Text>
          <Text style={[st.mono, { color: C.ink2, marginTop: 3 }]}>SHA-256: {f.hash.slice(0, 32)}</Text>
          <Text style={[st.mono, { color: C.ink2, marginLeft: 48 }]}>{f.hash.slice(32)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Document title={`Informe de cierre ${month}`} author="Cierre de Ventas" subject="Indicadores mensuales del equipo de ventas" language="es">
      {/* 1 · Portada */}
      <Page size="A4" style={st.page}>
        <View style={st.body}>
        <View style={{ marginTop: 90 }}>
          <Text style={st.eyebrow}>Gerencia de Ventas · Informe de cierre</Text>
          <Text style={[st.h1, { marginTop: 8 }]}>Resultados {t(month)}</Text>
          {c && <Text style={{ fontSize: 12, color: C.ink2, marginTop: 6 }}>Comparado con {t(titleCase(c.prevMonth))}</Text>}
          <Text style={{ fontSize: 10, color: C.ink2, marginTop: 14 }}>Emitido el {t(when)}</Text>
        </View>

        <View style={[st.row, { gap: 8, marginTop: 40 }]}>
          <Kpi label="Pegutil · sacos" value={fmt(R?.total.sacos)} sub={`${fmt(a.sacosPct, 1)}% de la meta (${fmt(R?.meta.sacos)})`} extra={c ? signedPct(pctDelta(c.team.sacos.cur, c.team.sacos.prev), prevShort) : undefined} />
          <Kpi label="Pruven · galones" value={fmt(R?.total.galones)} sub={`${fmt(a.galonesPct, 1)}% de la meta (${fmt(R?.meta.galones)})`} extra={c ? signedPct(pctDelta(c.team.galones.cur, c.team.galones.prev), prevShort) : undefined} />
          <Kpi label="Puntaje promedio" value={`${fmt(a.avgScore, 1)} / 24`} sub={(['PRODUCTIVO', 'ESTABLE', 'CRITICO'] as const).map((k) => { const n = d.sellers.filter((x) => x.status === k).length; return `${n} ${STATUS_LABEL[k].toLowerCase()}${n === 1 ? '' : 's'}`; }).join(' · ')} />
        </View>

        <View style={{ marginTop: 50 }}>
          <Text style={[st.h2, { fontSize: 11 }]}>Archivos analizados</Text>
          <Text style={st.sub}>La huella SHA-256 identifica cada archivo de forma única. Si el Excel se modifica, la huella cambia: así se puede comprobar de qué archivo exacto salió este informe.</Text>
          {fileRow('Mes analizado', cur)}
          {prev && fileRow('Mes anterior', prev)}
        </View>

        <View style={[st.row, { gap: 40, marginTop: 'auto', marginBottom: 24 }]} wrap={false}>
          {['Revisado por', 'Firma', 'Fecha'].map((l) => (
            <View key={l} style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: 0.75, borderBottomColor: C.ink, height: 28 }} />
              <Text style={[st.eyebrow, { marginTop: 4 }]}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 8 }}>
          <Text style={{ fontSize: 8, color: C.ink3 }}>Informe generado automáticamente en el navegador a partir de los archivos indicados; no se almacenó ningún dato. Escala de puntaje por línea (máx. 12): Productivo 10 o más · Estable 4 a 9,5 · Crítico menos de 4.</Text>
        </View>
        </View>
        <Footer month={month} />
      </Page>

      {/* 2 · Resumen */}
      <Page size="A4" style={st.page}>
        <View style={st.body}>
        <Section title="Hallazgos del mes" sub={`${insights.length} hallazgos calculados a partir de los datos, ordenados por prioridad`}>
          {insights.map((i) => <InsightRow key={i.title} i={i} />)}
        </Section>

        <Section title="Ranking de vendedores" sub="Puntaje por línea sobre 12; total sobre 24" wrap={false}>
          <View style={[st.row, { borderBottomWidth: 0.5, borderBottomColor: C.line }]}>
            {['#', 'Vendedor', 'Zona', 'Pegutil', 'Pruven', 'Total', c ? `vs ${prevShort}` : '', 'Estado'].map((h, i) => (
              <Text key={i} style={[st.th, { width: [18, 120, 85, 50, 50, 50, 55, 70][i], textAlign: i >= 3 && i <= 6 ? 'right' : 'left' }]}>{t(h)}</Text>
            ))}
          </View>
          {d.sellers.map((x, i) => {
            const cd = c?.sellers.get(x.sheet);
            const diff = cd ? x.total - cd.prevTotal : null;
            return (
              <View key={x.sheet} style={[st.row, { borderBottomWidth: 0.5, borderBottomColor: C.line2, alignItems: 'center' }]}>
                <Text style={[st.td, { width: 18, color: C.ink3 }]}>{i + 1}</Text>
                <Text style={[st.td, st.bold, { width: 120 }]}>{t(x.display)}</Text>
                <Text style={[st.td, { width: 85, color: C.ink2 }]}>{t(x.zona ?? '')}</Text>
                {(['Pegutil', 'Pruven'] as const).map((l) => <Text key={l} style={[st.td, { width: 50, textAlign: 'right' }]}>{fmt(x.blocks.find((b) => b.line === l)?.score, 1)}</Text>)}
                <Text style={[st.td, st.bold, { width: 50, textAlign: 'right' }]}>{fmt(x.total, 1)}</Text>
                <Text style={[st.td, { width: 55, textAlign: 'right', color: diff == null || diff === 0 ? C.ink3 : diff > 0 ? C.goodInk : C.critInk }]}>{diff == null ? '' : diff === 0 ? '0' : `${diff > 0 ? '+' : '-'}${fmt(Math.abs(diff), 1)}`}</Text>
                <View style={[st.td, { width: 70 }]}><Pill s={x.status} /></View>
              </View>
            );
          })}
        </Section>
        </View>
        <Footer month={month} />
      </Page>

      {/* 3 · Equipo */}
      <Page size="A4" style={st.page}>
        <View style={st.body}>
        <Section title="Mapa de cumplimiento" sub="% logrado frente al objetivo · verde 100% o más, ámbar 80 a 99%, rojo menos de 80%">
          <View style={[st.row, { borderBottomWidth: 0.5, borderBottomColor: C.line }]}>
            <Text style={[st.th, { width: 145 }]}>Indicador</Text>
            {d.sellers.map((x) => <Text key={x.sheet} style={[st.th, { width: cellW, textAlign: 'center' }]}>{t(x.display.split(' ')[0])}</Text>)}
          </View>
          {(['Pegutil', 'Pruven'] as const).map((ln) => {
            const ref = d.sellers.map((x) => x.blocks.find((b) => b.line === ln)).find(Boolean);
            if (!ref) return null;
            return (
              <View key={ln}>
                <Text style={[st.th, { color: ln === 'Pegutil' ? C.peg : C.pru, paddingTop: 7 }]}>{ln}</Text>
                {ref.items.map((it, k) => (
                  <View key={it.name} style={[st.row, { alignItems: 'center' }]} wrap={false}>
                    <Text style={{ width: 145, paddingHorizontal: 4, fontSize: 8.5 }}>{t(prettyItem(it.name))}</Text>
                    {d.sellers.map((x) => {
                      const b = x.blocks.find((y) => y.line === ln);
                      const v = b && (b.items.find((y) => y.name === it.name) ?? b.items[k]);
                      const [bg, fg] = BAND_C[band(v?.pct)];
                      const p = v && prevItem(c, x.sheet, ln, v.name);
                      return (
                        <View key={x.sheet} style={{ width: cellW, padding: 1.5 }}>
                          <View style={{ backgroundColor: bg, borderRadius: 2, paddingVertical: 2.5, alignItems: 'center' }}>
                            <Text style={{ color: fg, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>{v ? `${fmt(v.pct)}%` : '-'}</Text>
                            {p?.pct != null && v?.pct != null && <Text style={{ color: fg, fontSize: 6 }}>{t(`ant. ${fmt(p.pct)}%`)}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
                <View style={[st.row, { alignItems: 'center', borderTopWidth: 0.5, borderTopColor: C.line }]} wrap={false}>
                  <Text style={[st.bold, { width: 145, paddingHorizontal: 4, fontSize: 8.5 }]}>Puntaje {ln}</Text>
                  {d.sellers.map((x) => {
                    const b = x.blocks.find((y) => y.line === ln);
                    return <Text key={x.sheet} style={{ width: cellW, textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 8.5, paddingVertical: 3, color: b ? STATUS_C[b.status][1] : C.ink3 }}>{b ? `${fmt(b.score, 1)} / 12` : '-'}</Text>;
                  })}
                </View>
              </View>
            );
          })}
        </Section>

        <View break />
        {(['sacos', 'galones'] as const).map((m) => {
          const rows = zonas.slice().sort((x, y) => (y[m] ?? 0) - (x[m] ?? 0));
          const max = Math.max(1, ...rows.map((z) => Math.max(z[m] ?? 0, metaOf(z.sheet)?.[m].meta ?? 0, prev ? prevZona(z.zona)?.[m] ?? 0 : 0))) * 1.05;
          return (
            <Section key={m} title={m === 'sacos' ? 'Pegutil por zona (sacos)' : 'Pruven por zona (galones)'} sub={`Barra: vendido · línea negra: meta individual${prev ? ` · barra gris: ${prevShort}` : ''} · derecha: % de la meta`} wrap={false}>
              {rows.map((z) => {
                const meta = metaOf(z.sheet)?.[m].meta ?? null;
                return <HBar key={z.zona} label={z.zona} sub={z.vendedor !== '-' ? z.vendedor : undefined} value={z[m] ?? 0} max={max} color={m === 'sacos' ? C.peg : C.pru} meta={meta}
                  prev={prev ? prevZona(z.zona)?.[m] ?? null : undefined} right={meta ? `${fmt(z[m])} · ${fmt(((z[m] ?? 0) / meta) * 100)}%` : fmt(z[m])} />;
              })}
            </Section>
          );
        })}

        <Section title="¿Dónde se pierden los puntos?" sub={`${fmt(a.totalLost, 1)} pts perdidos en el equipo · azul Pegutil, naranja Pruven`} wrap={false}>
          {a.pointLoss.slice(0, 8).map((x) => (
            <HBar key={x.line + x.name} label={x.name} sub={`${x.line} · fallan ${x.fails} de ${x.n}`} value={x.lost} max={Math.max(...a.pointLoss.map((y) => y.lost)) * 1.05} color={x.line === 'Pegutil' ? C.peg : C.pru} right={`${fmt(x.lost, 1)} pts`} />
          ))}
        </Section>
        </View>
        <Footer month={month} />
      </Page>

      {/* 4 · Próximo mes */}
      <Page size="A4" style={st.page}>
        <View style={st.body}>
        {a.plan.length > 0 && d.metas && (
          <Section title={`${titleCase(d.metas.title)}: ¿son alcanzables?`} sub="Meta nueva frente a lo vendido este mes · riesgo alto: crecer más de 40% en alguna línea; medio: entre 15% y 40%" wrap={false}>
            <View style={[st.row, { borderBottomWidth: 0.5, borderBottomColor: C.line }]}>
              {['Vendedor', 'Sacos mes', 'Meta', 'Crec.', 'Pruven mes', 'Meta', 'Crec.', 'Riesgo'].map((h, i) => (
                <Text key={i} style={[st.th, { width: [120, 58, 52, 50, 62, 52, 50, 60][i], textAlign: i && i < 7 ? 'right' : 'left' }]}>{h}</Text>
              ))}
            </View>
            {a.plan.map((p) => (
              <View key={p.vendedor} style={[st.row, { borderBottomWidth: 0.5, borderBottomColor: C.line2, alignItems: 'center' }]}>
                <Text style={[st.td, { width: 120 }]}>{t(p.nombre)}</Text>
                <Text style={[st.td, { width: 58, textAlign: 'right' }]}>{fmt(p.realS)}</Text>
                <Text style={[st.td, { width: 52, textAlign: 'right' }]}>{fmt(p.metaS)}</Text>
                <Text style={[st.td, st.bold, { width: 50, textAlign: 'right', color: (p.gS ?? 0) > 15 ? C.critInk : C.goodInk }]}>{p.gS == null ? '-' : `${p.gS >= 0 ? '+' : '-'}${fmt(Math.abs(p.gS))}%`}</Text>
                <Text style={[st.td, { width: 62, textAlign: 'right' }]}>{fmt(p.realP, 1)}</Text>
                <Text style={[st.td, { width: 52, textAlign: 'right' }]}>{fmt(p.metaP)}</Text>
                <Text style={[st.td, st.bold, { width: 50, textAlign: 'right', color: (p.gP ?? 0) > 15 ? C.critInk : C.goodInk }]}>{p.gP == null ? '-' : `${p.gP >= 0 ? '+' : '-'}${fmt(Math.abs(p.gP))}%`}</Text>
                <View style={[st.td, { width: 60 }]}>{p.risk && <Pill s={RISK[p.risk]} label={p.risk} />}</View>
              </View>
            ))}
                      </Section>
        )}

        {a.nearMiss.length > 0 && (
          <Section title="Puntos al alcance" sub="Indicadores cerca de cumplirse y lo que aportarían al puntaje" wrap={false}>
            {a.nearMiss.slice(0, 6).map((n) => (
              <View key={n.seller + n.line + n.name} style={[st.row, { borderBottomWidth: 0.5, borderBottomColor: C.line2, paddingVertical: 4 }]}>
                <Text style={{ flex: 1 }}><Text style={st.bold}>{t(n.seller)}</Text> · {t(`${n.name} (${n.line}) al ${fmt(n.pct)}%, faltan ${n.needText}`)}</Text>
                <Text style={[st.bold, { color: C.goodInk, width: 110, textAlign: 'right' }]}>{t(`+${fmt(n.gain, 1)} pts${n.to !== n.from ? ` -> ${STATUS_LABEL[n.to].toLowerCase()}` : ''}`)}</Text>
              </View>
            ))}
          </Section>
        )}

        <Section title="Datos a corregir en el archivo" sub="Diferencias encontradas entre hojas del Excel del mes" wrap={false}>
          {d.alerts.length ? d.alerts.slice().sort((x, y) => ({ crit: 0, warn: 1, info: 2 })[x.level] - ({ crit: 0, warn: 1, info: 2 })[y.level]).map((al) => (
            <View key={al.text} style={[st.row, { marginBottom: 3 }]}>
              <Text style={[st.bold, { width: 52, fontSize: 7, color: al.level === 'crit' ? C.critInk : al.level === 'warn' ? C.warnInk : C.ink3, paddingTop: 1 }]}>{al.level === 'crit' ? 'CRÍTICO' : al.level === 'warn' ? 'REVISAR' : 'NOTA'}</Text>
              <Text style={{ flex: 1, fontSize: 8.5 }}>{t(al.text)}</Text>
            </View>
          )) : <Text style={{ color: C.ink2 }}>Las hojas cuadran entre sí.</Text>}
        </Section>

        {d.awards.length > 0 && (
          <Section title="Reconocimientos y variable" sub="Según la hoja RESULTADOS" wrap={false}>
            {d.awards.map((w, i) => (
              <View key={i} style={[st.row, { borderBottomWidth: 0.5, borderBottomColor: C.line2, paddingVertical: 3 }]}>
                <Text style={{ flex: 1 }}>{t(titleCase(w.criterio))}</Text>
                <Text style={{ width: 60, color: w.line === 'Pegutil' ? C.peg : C.pru }}>{w.line}</Text>
                <Text style={{ width: 90 }}>{t(titleCase(w.ejecutivo))}</Text>
                <Text style={{ width: 50, textAlign: 'right' }}>{w.pct != null ? `${fmt(w.pct, 2)}%` : '-'}</Text>
              </View>
            ))}
          </Section>
        )}

        </View>
        <Footer month={month} />
      </Page>
    </Document>
  );
}
