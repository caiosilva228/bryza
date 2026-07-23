import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/embaixador/dashboard',
    name: 'Espaço do Embaixador Bryza',
    short_name: 'Bryza',
    description: 'Acesse vendas, comissões e indicações do Programa de Embaixadores Bryza.',
    start_url: '/embaixador/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f9fb',
    theme_color: '#005675',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
