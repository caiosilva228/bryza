import { Pedido } from '@/models/types';

/**
 * Gera a URL do Google Maps com uma rota contendo múltiplos endereços (waypoints).
 */
export function generateGoogleMapsRouteUrl(pedidos: Pedido[]): string {
  if (pedidos.length === 0) return 'https://www.google.com/maps';

  // Usar endereços do cliente ou do pedido
  const addresses = pedidos.map(p => {
    let addr = p.cliente?.endereco || p.endereco_entrega || '';
    if (p.cliente?.numero) addr += `, ${p.cliente.numero}`;
    if (p.cliente?.bairro || p.bairro) addr += ` - ${p.cliente?.bairro || p.bairro}`;
    if (p.cliente?.cidade || p.cidade) addr += `, ${p.cliente?.cidade || p.cidade}`;
    return encodeURIComponent(addr.trim());
  }).filter(a => a.length > 0);

  if (addresses.length === 0) return 'https://www.google.com/maps';

  const origin = addresses[0];
  const destination = addresses[addresses.length - 1];

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

  if (addresses.length > 2) {
    const waypoints = addresses.slice(1, addresses.length - 1).join('|');
    url += `&waypoints=${waypoints}`;
  }

  return url;
}
