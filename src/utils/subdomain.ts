export type SubdomainType = 'ev' | 'admin' | 'public' | 'none';

/**
 * Detects the subdomain type based on the Request Host header.
 */
export function getSubdomainType(host: string | null): SubdomainType {
  if (!host) return 'none';
  const hostname = host.split(':')[0].toLowerCase();

  if (hostname === 'ev.bryza.com.br' || hostname.startsWith('ev.')) {
    return 'ev';
  }
  if (hostname === 'admin.bryza.com.br' || hostname.startsWith('admin.')) {
    return 'admin';
  }
  if (hostname === 'bryza.com.br' || hostname === 'www.bryza.com.br' || hostname === 'bryza.local') {
    return 'public';
  }
  return 'none';
}

/**
 * Generates the full URL for a targeted subdomain and path.
 */
export function getSubdomainUrl(type: 'ev' | 'admin' | 'public', path: string = '', requestHost?: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  let host = requestHost || '';
  if (typeof window !== 'undefined' && !host) {
    host = window.location.host;
  }

  const port = host.includes(':') ? `:${host.split(':')[1]}` : '';
  const isProd = process.env.NODE_ENV === 'production' || host.includes('bryza.com.br');

  if (isProd) {
    if (type === 'ev') return `https://ev.bryza.com.br${cleanPath}`;
    if (type === 'admin') return `https://admin.bryza.com.br${cleanPath}`;
    return `https://bryza.com.br${cleanPath}`;
  }

  // Local development with custom domain aliases (bryza.local, ev.bryza.local, admin.bryza.local)
  if (host.includes('.local')) {
    const baseDomain = 'bryza.local';
    if (type === 'ev') return `http://ev.${baseDomain}${port}${cleanPath}`;
    if (type === 'admin') return `http://admin.${baseDomain}${port}${cleanPath}`;
    return `http://${baseDomain}${port}${cleanPath}`;
  }

  if (host.startsWith('ev.') || host.startsWith('admin.')) {
    if (type === 'ev') return `http://ev.localhost${port}${cleanPath}`;
    if (type === 'admin') return `http://admin.localhost${port}${cleanPath}`;
    return `http://localhost${port}${cleanPath}`;
  }

  // Standard localhost fallback without subdomains
  return cleanPath;
}
