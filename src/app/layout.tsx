import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin'], axes: ['wdth'] });
const plexMono = IBM_Plex_Mono({ variable: '--font-plex-mono', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'Cierre de Ventas',
  description: 'Convierte el Excel de indicadores mensuales en un dashboard y un informe PDF. Los archivos se procesan en el navegador.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${archivo.variable} ${plexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
