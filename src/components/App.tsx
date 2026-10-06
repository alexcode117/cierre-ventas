'use client';

import { AnimatePresence, MotionConfig } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { buildSession, type Session } from '@/lib/load';
import UploadScreen from './upload/UploadScreen';

// Las gráficas solo se descargan cuando hay datos que mostrar.
const Dashboard = dynamic(() => import('./dashboard/Dashboard'), { ssr: false });

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  return (
    <MotionConfig reducedMotion="user">
      {/* initial={false}: la pantalla inicial se ve completa desde el primer render, sin esperar a la animación. */}
      <AnimatePresence mode="wait" initial={false}>
        {session ? (
          <Dashboard key="dash" session={session} onReset={() => setSession(null)}
            onBasis={(b) => setSession(buildSession(session.source.cur, session.source.prev, b))} />
        ) : (
          <UploadScreen key="upload" onReady={(s) => { setSession(s); window.scrollTo(0, 0); }} />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
