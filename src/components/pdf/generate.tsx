import { pdf } from '@react-pdf/renderer';
import type { Session } from '@/lib/load';
import ReportDoc from './Report';

/** Genera el informe en el navegador y lo descarga. */
export async function downloadReport(session: Session) {
  const blob = await pdf(<ReportDoc s={session} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Informe-cierre-${session.cur.report.key ?? 'ventas'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
