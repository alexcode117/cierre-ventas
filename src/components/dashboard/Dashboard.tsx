'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { titleCase } from '@/lib/format';
import type { Session } from '@/lib/load';
import { RULES_TEXT } from '@/lib/rules';
import { Button } from '../ui';
import ResumenTab from './ResumenTab';
import SimuladorTab from './SimuladorTab';
import VendedoresTab from './VendedoresTab';
import ZonasTab from './ZonasTab';

const TABS = [
  ['resumen', 'Resumen'],
  ['vendedores', 'Vendedores'],
  ['zonas', 'Zonas y productos'],
  ['simulador', 'Simulador'],
] as const;
export type TabKey = (typeof TABS)[number][0];

export default function Dashboard({ session, onReset }: { session: Session; onReset: () => void }) {
  const [tab, setTab] = useState<TabKey>('resumen');
  const [simSeller, setSimSeller] = useState(0);
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle');
  const { cur, prev, comparison } = session;
  const month = cur.report.month ? titleCase(cur.report.month) : 'del mes';

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto grid max-w-[1200px] gap-5 px-4 pt-5 pb-16 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-1.5">
          <button onClick={onReset} className="inline-flex items-center gap-1 justify-self-start text-[13px] text-ink-2 hover:text-ink">
            <ArrowLeft size={14} aria-hidden /> Cargar otros archivos
          </button>
          <h1 className="display text-[clamp(26px,4vw,38px)] leading-[1.05] font-extrabold">Resultados {month}</h1>
          <p className="text-[13px] text-ink-2">
            <b className="font-semibold text-ink">{cur.name}</b>
            {prev && <> · comparado con <b className="font-semibold text-ink">{titleCase(comparison?.prevMonth ?? prev.name)}</b></>}
            {' '}· {cur.report.sellers.length} vendedores con hoja
          </p>
        </div>
        <div className="grid justify-items-end gap-1">
          <Button variant="primary" onClick={downloadPdf} disabled={pdfState === 'busy'}>
            {pdfState === 'busy' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <FileDown size={16} aria-hidden />}
            {pdfState === 'busy' ? 'Generando informe…' : 'Descargar informe PDF'}
          </Button>
          {pdfState === 'error' && <span role="alert" className="text-[12.5px] text-crit-ink">No se pudo generar el PDF. Intente de nuevo.</span>}
        </div>
      </header>

      <nav role="tablist" aria-label="Secciones" className="sticky top-0 z-10 -mx-1 flex overflow-x-auto border-b border-line bg-bg px-1 [scrollbar-width:none]">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}
            className={clsx('relative px-3.5 pt-3 pb-2.5 text-[14px] font-semibold whitespace-nowrap transition-colors', tab === k ? 'text-ink' : 'text-ink-2 hover:text-ink')}>
            {l}
            {tab === k && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-[2.5px] rounded bg-accent" />}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.section key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === 'resumen' && <ResumenTab session={session} onGo={go} />}
          {tab === 'vendedores' && <VendedoresTab session={session} onSimulate={(i) => { setSimSeller(i); go('simulador'); }} />}
          {tab === 'zonas' && <ZonasTab session={session} />}
          {tab === 'simulador' && <SimuladorTab session={session} seller={simSeller} onSeller={setSimSeller} />}
        </motion.section>
      </AnimatePresence>

      <p className="text-[12.5px] text-ink-3">
        {RULES_TEXT} Colores de cumplimiento: verde 100% o más, ámbar 80 a 99%, rojo menos de 80%.
      </p>
    </motion.div>
  );
}
