'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import styles from './zelo-lancamento.module.css';

type ZeloLeadFormProps = {
  whatsappGroupUrl?: string;
};

type TouchPoint = {
  captured_at: string;
  origem: string;
  canal: string;
  campanha: string | null;
  conjunto_anuncio: string | null;
  criativo: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  click_id: string | null;
  click_id_tipo: string | null;
  referrer: string | null;
  landing_page: string;
  params: Record<string, string>;
};

type StoredAttribution = {
  first_touch?: TouchPoint;
  last_touch?: TouchPoint;
};

const attributionStorageKey = 'zelo-lancamento-attribution-v1';
const trackingKeys = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'origem',
  'source',
  'medium',
  'campaign',
  'campanha',
  'adset',
  'conjunto',
  'conjunto_anuncio',
  'creative',
  'criativo',
  'ad',
  'ad_name',
  'creative_name',
  'fbclid',
  'gclid',
  'ttclid',
  'wbraid',
  'gbraid',
]);

function limit(value: string | null | undefined, length = 180) {
  return value?.trim().slice(0, length) || null;
}

function getParam(params: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = limit(params.get(key));
    if (value) return value;
  }
  return null;
}

function normalizeOrigin(
  value: string | null,
  source: string | null,
  medium: string | null,
  referrer: string | null,
  hasAdClickId = false,
) {
  const input = `${value || ''} ${source || ''} ${medium || ''}`.toLowerCase();
  const referrerValue = (referrer || '').toLowerCase();

  if (input.includes('instagram') && (input.includes('dm') || input.includes('direct'))) {
    return 'instagram_dm';
  }
  if (value?.toLowerCase().includes('instagram_dm')) return 'instagram_dm';
  if (
    hasAdClickId
    || ['paid', 'cpc', 'ppc', 'trafego', 'traffic', 'ads', 'meta', 'facebook', 'google', 'tiktok']
      .some((term) => input.includes(term))
  ) {
    return 'trafego';
  }
  if (input.includes('organ') || input.includes('seo')) return 'organico';
  if (input.includes('whatsapp')) return 'whatsapp';
  if (referrerValue.includes('instagram.com') || referrerValue.includes('l.instagram.com')) return 'instagram';
  if (referrerValue) return 'referencia';
  if (value) return value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 50) || 'outro';
  return 'direto';
}

function inferChannel(source: string | null, medium: string | null, origin: string) {
  const value = `${source || ''} ${medium || ''}`.toLowerCase();
  if (value.includes('facebook') || value.includes('meta')) return 'meta_ads';
  if (value.includes('google')) return 'google_ads';
  if (value.includes('instagram') || origin.startsWith('instagram')) return 'instagram';
  if (value.includes('whatsapp') || origin === 'whatsapp') return 'whatsapp';
  if (value.includes('tiktok')) return 'tiktok';
  if ((medium || '').toLowerCase() === 'email') return 'email';
  if (origin === 'trafego') return 'trafego';
  return origin;
}

function captureTouchPoint(): TouchPoint {
  const params = new URLSearchParams(window.location.search);
  const safeParams: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    if (trackingKeys.has(key.toLowerCase())) {
      safeParams[key.toLowerCase()] = value.slice(0, 180);
    }
  }

  const referrer = limit(document.referrer, 500);
  const source = getParam(params, 'utm_source', 'source');
  const medium = getParam(params, 'utm_medium', 'medium');
  const campaign = getParam(params, 'utm_campaign', 'campaign', 'campanha');
  const creative = getParam(params, 'utm_content', 'creative', 'criativo', 'ad', 'ad_name', 'creative_name');
  const clickIdType = ['fbclid', 'gclid', 'ttclid', 'wbraid', 'gbraid'].find((key) => safeParams[key]);
  const origin = normalizeOrigin(getParam(params, 'origem'), source, medium, referrer, Boolean(clickIdType));

  return {
    captured_at: new Date().toISOString(),
    origem: origin,
    canal: inferChannel(source, medium, origin),
    campanha: campaign,
    conjunto_anuncio: getParam(params, 'adset', 'conjunto', 'conjunto_anuncio'),
    criativo: creative,
    utm_source: getParam(params, 'utm_source'),
    utm_medium: getParam(params, 'utm_medium'),
    utm_campaign: getParam(params, 'utm_campaign'),
    utm_content: getParam(params, 'utm_content'),
    utm_term: getParam(params, 'utm_term'),
    click_id: clickIdType ? safeParams[clickIdType] : null,
    click_id_tipo: clickIdType || null,
    referrer,
    landing_page: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    params: safeParams,
  };
}

function readStoredAttribution(): StoredAttribution {
  try {
    const stored = window.localStorage.getItem(attributionStorageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as StoredAttribution;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function captureAndPersistAttribution() {
  const current = captureTouchPoint();
  const stored = readStoredAttribution();
  const next: StoredAttribution = {
    first_touch: stored.first_touch || current,
    last_touch: current,
  };

  try {
    window.localStorage.setItem(attributionStorageKey, JSON.stringify(next));
  } catch {
    // Storage may be disabled; the current touch point is still sent with the form.
  }

  return { current, ...next };
}

function formatWhatsApp(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) {
    const number = digits.slice(2);
    return `(${digits.slice(0, 2)}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }
  const country = digits.startsWith('55') ? `+${digits.slice(0, 2)} ` : '';
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  return `${country}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
}

export default function ZeloLeadForm({ whatsappGroupUrl }: ZeloLeadFormProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    captureAndPersistAttribution();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    const trimmedName = nome.trim();
    const normalizedWhatsApp = whatsapp.replace(/\D/g, '');

    if (trimmedName.length < 2) {
      setErrorMessage('Digite seu nome para continuar.');
      return;
    }
    if (normalizedWhatsApp.length < 10 || normalizedWhatsApp.length > 15) {
      setErrorMessage('Digite um WhatsApp válido com DDD.');
      return;
    }

    setStatus('submitting');

    try {
      const attribution = captureAndPersistAttribution();
      const response = await fetch('/api/zelo-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: trimmedName,
          whatsapp,
          honeypot,
          attribution,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível concluir seu cadastro.');
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Tente novamente em instantes.');
    }
  }

  if (status === 'success') {
    return (
      <div className={styles.successCard} id="grupo" role="status" aria-live="polite">
        <div className={styles.successIcon} aria-hidden="true">✓</div>
        <p className={styles.successKicker}>Cadastro confirmado</p>
        <h3>Você está na lista.</h3>
        <p className={styles.successText}>
          Agora entre no grupo fechado do WhatsApp para acompanhar a data de lançamento. O link de compra será divulgado lá.
        </p>
        {whatsappGroupUrl ? (
          <a className={styles.groupLink} href={whatsappGroupUrl} target="_blank" rel="noreferrer">
            Entrar no grupo fechado <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className={styles.groupPlaceholder}>Convite do grupo fechado em breve</span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formCardHeader}>
        <span className={styles.formStatus} aria-hidden="true" />
        <span>Cadastro rápido</span>
        <span className={styles.formStep}>01 / 01</span>
      </div>

      <form className={styles.leadForm} onSubmit={handleSubmit} noValidate>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="zelo-nome">Seu nome</label>
          <input
            className={styles.fieldInput}
            id="zelo-nome"
            name="nome"
            type="text"
            placeholder="Como podemos te chamar?"
            autoComplete="name"
            maxLength={120}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            disabled={status === 'submitting'}
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="zelo-whatsapp">Seu WhatsApp</label>
          <input
            className={styles.fieldInput}
            id="zelo-whatsapp"
            name="whatsapp"
            type="tel"
            placeholder="(11) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            value={whatsapp}
            onChange={(event) => setWhatsapp(formatWhatsApp(event.target.value))}
            disabled={status === 'submitting'}
            required
          />
        </div>

        <input
          className={styles.honeypot}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />

        {errorMessage ? <p className={styles.formError} role="alert">{errorMessage}</p> : null}

        <button className={styles.submitButton} type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Enviando…' : 'Quero garantir minha oferta'}
          <span aria-hidden="true">↗</span>
        </button>

        <p className={styles.formNote}>
          Oferta especial exclusiva para os 100 primeiros cadastros.
        </p>
      </form>
    </div>
  );
}
