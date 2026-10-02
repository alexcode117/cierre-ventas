'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { CheckCircle2, FileSpreadsheet, History, Loader2, ShieldCheck, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { titleCase } from '@/lib/format';
import { buildSession, loadFile, type LoadedFile, type Session } from '@/lib/load';
import { Button } from '../ui';

type Slot = { file: LoadedFile | null; error: string | null; busy: boolean };
const empty: Slot = { file: null, error: null, busy: false };

export default function UploadScreen({ onReady }: { onReady: (s: Session) => void }) {
  const [cur, setCur] = useState<Slot>(empty);
  const [prev, setPrev] = useState<Slot>(empty);
  const [pairError, setPairError] = useState<string | null>(null);

  async function read(name: string, buf: ArrayBuffer, set: (s: Slot) => void) {
    set({ file: null, error: null, busy: true });
    setPairError(null);
    try {
      set({ file: await loadFile(name, buf), error: null, busy: false });
    } catch (e) {
      set({ file: null, error: `No se pudo leer "${name}". ${(e as Error).message} Verifique que tenga hojas por vendedor, RESULTADOS y METAS.`, busy: false });
    }
  }

  function analyzeNow(c = cur.file, p = prev.file) {
    if (!c) return;
    try {
      onReady(buildSession(c, p));
    } catch (e) {
      setPairError((e as Error).message);
    }
  }

  async function loadExamples() {
    const get = async (f: string) => (await fetch(`/ejemplos/${f}`)).arrayBuffer();
    const [a, b] = await Promise.all([get('ejemplo-agosto-2026.xlsx'), get('ejemplo-julio-2026.xlsx')]);
    const [c, p] = await Promise.all([loadFile('ejemplo-agosto-2026.xlsx', a), loadFile('ejemplo-julio-2026.xlsx', b)]);
    analyzeNow(c, p);
  }

  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}
      className="mx-auto grid max-w-3xl gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <header className="grid gap-3">
        <span className="eyebrow">Gerencia de Ventas · Indicadores mensuales</span>
        <h1 className="display text-[clamp(30px,5vw,46px)] leading-[1.02] font-extrabold tracking-tight">Cierre mensual de ventas</h1>
        <p className="max-w-[60ch] text-[15.5px] text-ink-2">
          Cargue el Excel de indicadores del mes para ver el dashboard y descargar el informe en PDF. Si agrega el Excel del mes anterior, todo se compara automáticamente.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <DropZone id="f-cur" title="Excel del mes" hint="Obligatorio" icon={<FileSpreadsheet size={26} />} slot={cur} accent
          onFile={(n, b) => read(n, b, setCur)} onClear={() => setCur(empty)} />
        <DropZone id="f-prev" title="Excel del mes anterior" hint="Opcional · para comparar" icon={<History size={26} />} slot={prev}
          onFile={(n, b) => read(n, b, setPrev)} onClear={() => setPrev(empty)} />
      </div>

      {pairError && <p role="alert" className="rounded-lg bg-crit-bg px-4 py-3 text-sm text-crit-ink">{pairError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" className="px-5 py-2.5 text-[15px]" disabled={!cur.file || cur.busy || prev.busy} onClick={() => analyzeNow()}>
          {cur.file && prev.file ? 'Analizar y comparar' : 'Analizar'}
        </Button>
        <button onClick={loadExamples} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">Probar con archivos de ejemplo</button>
      </div>

      <p className="flex items-start gap-2 text-[13px] text-ink-3">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
        Los archivos se procesan en este navegador: no se suben a ningún servidor ni se guardan. El informe PDF queda como constancia.
      </p>
    </motion.main>
  );
}

function DropZone({ id, title, hint, icon, slot, accent, onFile, onClear }: {
  id: string; title: string; hint: string; icon: React.ReactNode; slot: Slot; accent?: boolean;
  onFile: (name: string, buf: ArrayBuffer) => void; onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = async (f?: File | null) => f && onFile(f.name, await f.arrayBuffer());
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); };
  const r = slot.file?.report;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
        className={clsx('relative grid min-h-[168px] cursor-pointer place-items-center gap-2 rounded-xl border-[1.5px] border-dashed bg-panel p-5 text-center transition-colors focus-within:outline-2 focus-within:outline-accent',
          over ? 'border-accent bg-accent-soft' : slot.file ? 'border-good border-solid' : accent ? 'border-accent/60 hover:border-accent' : 'border-ink-3/60 hover:border-ink-3')}>
        <input ref={input} id={id} type="file" accept=".xlsx,.xls,.xlsm" className="sr-only" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
        {slot.busy ? (
          <Loader2 className="animate-spin text-accent" size={26} aria-label="Leyendo archivo" />
        ) : slot.file && r ? (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid justify-items-center gap-1">
            <CheckCircle2 className="text-good" size={26} aria-hidden />
            <b className="text-[15px]">{r.month ? titleCase(r.month) : 'Mes no identificado'}</b>
            <span className="max-w-full truncate text-[12.5px] text-ink-2">{slot.file.name}</span>
            <span className="text-[12px] text-ink-3">{r.sellers.length} vendedores · {r.alerts.filter((a) => a.level !== 'info').length} datos a revisar</span>
          </motion.div>
        ) : (
          <div className="grid justify-items-center gap-1">
            <span className={accent ? 'text-accent' : 'text-ink-3'}>{icon}</span>
            <b className="text-[15px]">{title}</b>
            <span className="text-[12.5px] text-ink-2">{hint}</span>
            <span className="text-[12px] text-ink-3">Arrastre el archivo o haga clic</span>
          </div>
        )}
      </label>
      {slot.file && (
        <button onClick={onClear} className="inline-flex items-center gap-1 justify-self-start text-[12.5px] text-ink-2 hover:text-ink"><X size={14} aria-hidden />Quitar archivo</button>
      )}
      {slot.error && <p role="alert" className="text-[13px] text-crit-ink">{slot.error}</p>}
    </div>
  );
}
