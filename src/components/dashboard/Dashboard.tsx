'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { titleCase } from '@/lib/format';
import type { Session } from '@/lib/load';
import { rulesText } from '@/lib/rules';
import type { Basis } from '@/lib/types';
import { Button, Segmented } from '../ui';
import MetasTab from './MetasTab';
import ProcedimientoTab from './ProcedimientoTab';
import ResumenTab from './ResumenTab';
import SimuladorTab from './SimuladorTab';
import VendedoresTab from './VendedoresTab';
import ZonasTab from './ZonasTab';

const TABS = [
  ['resumen', 'Resumen'],
  ['vendedores', 'Vendedores'],
  ['zonas', 'Zonas y productos'],
  ['metas', 'Metas'],
  ['simulador', 'Simulador'],
  ['procedimiento', 'Procedimiento'],
] as const;
export type TabKey = (typeof TABS)[number][0];

export default function Dashboard({ session, onReset, onBasis }: { session: Session; onReset: () => void; onBasis: (b: Basis) => void }) {
  const [tab, setTab] = useState<TabKey>('resumen');
  const [simSeller, setSimSeller] = useState(0);
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle');
  const { cur, prev, comparison } = session;

  useEffect(() => {
    const h = location.hash.slice(1);
    if (TABS.some(([k]) => k === h)) setTab(h as TabKey);
  }, []);
  const go = (k: TabKey) => {
    setTab(k);
    history.replaceState(null, '', `#${k}`);
  };

  async function downloadPdf() {
    setPdfState('busy');
    try {
      const { downloadReport } = await import('../pdf/generate');
      await downloadReport(session);
      setPdfState('idle');
    } catch (e) {
      console.error(e);
      setPdfState('error');
    }
  }

  const month = cur.report.month ? titleCase(cur.report.month) : 'Cierre del mes';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto grid max-w-[1200px] gap-6 px-4 pt-5 pb-16 sm:px-6">
      <header className="grid gap-4">
        <button onClick={onReset} className="inline-flex items-center gap-1 justify-self-start text-[13px] font-medium text-ink-2 hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Cargar otros archivos
        </button>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="grid min-w-0 gap-1">
            <h1 className="stencil text-[clamp(44px,8vw,84px)] leading-[0.86] text-ink uppercase">{month}</h1>
            <p className="text-[14px] text-ink-2">
              Cierre de ventas de <b className="font-semibold text-ink">{cur.name}</b>
              {prev && <>, comparado con <b className="font-semibold text-ink">{titleCase(comparison?.prevMonth ?? prev.name)}</b></>}.{' '}
              {cur.report.sellers.length} vendedores con hoja.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2" title="Base para calcular puntos y estados">
              <span className="text-[13px] font-medium text-ink-2">Puntos según</span>
              <Segmented label="Base de cálculo" value={session.basis} onChange={onBasis} options={[['procedimiento', 'Procedimiento'], ['excel', 'Excel']]} />
            </div>
            <Button variant="primary" onClick={downloadPdf} disabled={pdfState === 'busy'}>
              {pdfState === 'busy' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <FileDown size={16} aria-hidden />}
              {pdfState === 'busy' ? 'Generando informe…' : 'Descargar informe PDF'}
            </Button>
          </div>
        </div>
        {pdfState === 'error' && <p role="alert" className="text-[13px] text-crit-ink">No se pudo generar el PDF. Intente de nuevo.</p>}
      </header>

      <nav role="tablist" aria-label="Secciones" className="sticky top-0 z-10 -mx-4 flex overflow-x-auto border-y border-line bg-bg/90 px-3 backdrop-blur-md [scrollbar-width:none] sm:-mx-6 sm:px-5">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}
            className={clsx('relative px-3.5 pt-3 pb-3 text-[14.5px] font-semibold whitespace-nowrap transition-colors', tab === k ? 'text-ink' : 'text-ink-3 hover:text-ink')}>
            {l}
            {tab === k && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-[3px] bg-ink" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.section key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === 'resumen' && <ResumenTab session={session} onGo={go} />}
          {tab === 'vendedores' && <VendedoresTab session={session} onSimulate={(i) => { setSimSeller(i); go('simulador'); }} />}
          {tab === 'zonas' && <ZonasTab session={session} />}
          {tab === 'metas' && <MetasTab session={session} />}
          {tab === 'simulador' && <SimuladorTab key={session.basis} session={session} seller={simSeller} onSeller={setSimSeller} />}
          {tab === 'procedimiento' && <ProcedimientoTab session={session} onBasis={onBasis} />}
        </motion.section>
      </AnimatePresence>

      <p className="max-w-[90ch] border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-3">
        {rulesText(session.basis)}{' '}
        {session.basis === 'procedimiento' ? 'Colores de los indicadores: verde 3 pts, ámbar 1 pt, rojo 0 pts.' : 'Colores de cumplimiento: verde 100% o más, ámbar 80 a 99%, rojo menos de 80%.'}
      </p>
    </motion.div>
  );
}
