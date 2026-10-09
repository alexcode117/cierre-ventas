import type { Metadata } from 'next';
import { Archivo, Big_Shoulders, Big_Shoulders_Stencil } from 'next/font/google';
import './globals.css';

// Archivo para el texto; Big Shoulders (letra industrial, como la impresión de un saco) para títulos y cifras;
// la versión stencil solo en el mes del encabezado.
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin'], axes: ['wdth'] });
const shoulders = Big_Shoulders({ variable: '--font-shoulders', subsets: ['latin'] });
const stencil = Big_Shoulders_Stencil({ variable: '--font-shoulders-stencil', subsets: ['latin'], weight: ['800'] });

export const metadata: Metadata = {
  title: 'Cierre de Ventas',
  description: 'Convierte el Excel de indicadores mensuales en un dashboard y un informe PDF. Los archivos se procesan en el navegador.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${archivo.variable} ${shoulders.variable} ${stencil.variable} antialiased`}>{children}</body>
    </html>
  );
}
