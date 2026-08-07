import { NextResponse } from 'next/server';

const NOMINATIM_URL = (
  process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'
).replace(/\/$/, '');
const MAX_VALUE_LENGTH = 160;

export const dynamic = 'force-dynamic';

function clean(value: string | null) {
  return value?.trim().slice(0, MAX_VALUE_LENGTH) || '';
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

function addIfPresent(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}

interface ViaCepAddress {
  cep: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const query = clean(incoming.get('q'));
  const street = clean(incoming.get('street'));
  const city = clean(incoming.get('city'));
  const state = clean(incoming.get('state'));
  const postalCode = digits(clean(incoming.get('postalcode'))).slice(0, 8);

  if (!query && !street && !city && !state && !postalCode) {
    return NextResponse.json(
      { error: 'Informe o CEP ou o endereço para pesquisar.' },
      { status: 400 },
    );
  }

  const search = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
  });

  let resolvedAddress: ViaCepAddress | null = null;

  if (query) {
    const queryDigits = digits(query);
    const isCepQuery = /^\d{5}-?\d{3}$/.test(query.replace(/\s/g, ''));
    if (isCepQuery) {
      try {
        const viaCepResponse = await fetch(`https://viacep.com.br/ws/${queryDigits}/json/`, {
          next: { revalidate: 86400 },
        });
        const viaCep = await viaCepResponse.json();
        if (viaCepResponse.ok && !viaCep.erro) {
          resolvedAddress = {
            cep: queryDigits,
            address: String(viaCep.logradouro || '').toUpperCase(),
            neighborhood: String(viaCep.bairro || '').toUpperCase(),
            city: String(viaCep.localidade || '').toUpperCase(),
            state: String(viaCep.uf || '').toUpperCase(),
          };
          const street = resolvedAddress.address;
          addIfPresent(search, 'street', street);
          addIfPresent(search, 'city', resolvedAddress.city);
          addIfPresent(search, 'state', resolvedAddress.state);
          addIfPresent(search, 'postalcode', resolvedAddress.cep);
          search.set('country', 'Brasil');
        } else {
          search.set('q', query);
        }
      } catch {
        search.set('q', query);
      }
    } else {
      search.set('q', query);
    }
  } else {
    addIfPresent(search, 'street', street);
    addIfPresent(search, 'city', city);
    addIfPresent(search, 'state', state);
    addIfPresent(search, 'postalcode', postalCode);
    search.set('country', 'Brasil');
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bryza.com.br';
  const userAgent = process.env.NOMINATIM_USER_AGENT
    || `Bryza/1.0 (+${configuredSiteUrl})`;

  try {
    const response = await fetch(`${NOMINATIM_URL}/search?${search.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'O serviço de localização não respondeu.' },
        { status: 502 },
      );
    }

    const results = await response.json();
    return NextResponse.json(
      {
        results: Array.isArray(results) ? results : [],
        address: resolvedAddress,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=3600',
        },
      },
    );
  } catch (error) {
    console.error('Erro ao consultar o serviço de geocodificação:', error);
    return NextResponse.json(
      { error: 'Não foi possível consultar o serviço de localização.' },
      { status: 502 },
    );
  }
}
