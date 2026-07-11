import { Pedido } from '@/models/types';

/**
 * Gera a URL do Google Maps com uma rota contendo múltiplos endereços (waypoints).
 */
export function generateGoogleMapsRouteUrl(pedidos: Pedido[]): string {
  if (pedidos.length === 0) return 'https://www.google.com/maps';

  // Usar coordenadas geográficas (latitude, longitude) se disponíveis, com fallback para o endereço textual
  const addresses = pedidos.map(p => {
    const lat = p.cliente?.latitude;
    const lng = p.cliente?.longitude;
    
    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined && Number(lat) !== 0 && Number(lng) !== 0) {
      return `${lat},${lng}`;
    }

    let addr = p.cliente?.endereco || p.endereco_entrega || '';
    if (p.cliente?.numero) addr += `, ${p.cliente.numero}`;
    if (p.cliente?.bairro || p.bairro) addr += ` - ${p.cliente?.bairro || p.bairro}`;
    if (p.cliente?.cidade || p.cidade) addr += `, ${p.cliente?.cidade || p.cidade}`;
    return addr.trim();
  }).filter(a => a.length > 0).map(a => encodeURIComponent(a));

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
