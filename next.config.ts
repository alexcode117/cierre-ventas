import type { NextConfig } from 'next';

// Sitio 100% estático: los Excel se procesan en el navegador y nunca llegan a un servidor.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
