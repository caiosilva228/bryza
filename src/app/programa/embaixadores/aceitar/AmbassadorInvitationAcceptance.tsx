'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

const TERMS_VERSION = 'programa-embaixadores-v1';

export default function AmbassadorInvitationAcceptance({ token }: { token: string }) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const acceptInvitation = async () => {
    if (!acceptedTerms || !token) return;
    setLoading(true);
    setMessage('');
    try {
      const prepareResponse = await fetch('/api/programa/embaixadores/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok || prepared.result?.status !== 'linked') {
        throw new Error(
          prepared.result?.status === 'manual_review_required'
            ? 'Este vínculo precisa de revisão administrativa.'
            : prepared.error || 'Não foi possível validar sua identidade.'
        );
      }

      const supabase = createClient();
      const { data, error } = await supabase.rpc('fn_accept_ambassador_invitation', {
        p_invitation_token: token,
        p_terms_version: TERMS_VERSION,
      });
      if (error) throw error;

      const result = data as { status?: string; referral_code?: string };
      if (result.status !== 'accepted') {
        throw new Error(
          result.status === 'manual_review_required'
            ? 'Este aceite precisa de revisão administrativa.'
            : 'O convite expirou ou não está mais disponível.'
        );
      }

      setSuccess(true);
      setMessage(`Participação ativada. Seu código é ${result.referral_code || 'gerado pela Bryza'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível aceitar o convite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f5f7fb', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <section style={{ width: '100%', maxWidth: '560px', background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 20px 60px rgba(0,43,92,.12)' }}>
        <p style={{ color: '#65a30d', fontWeight: 800, margin: 0 }}>PROGRAMA DE EMBAIXADORES BRYZA</p>
        <h1 style={{ color: '#002b5c', margin: '10px 0' }}>{success ? 'Bem-vindo ao programa' : 'Aceite do convite'}</h1>
        {!success && (
          <>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              Sua participação será ativada somente após confirmar este convite e concordar com os termos vigentes.
            </p>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '24px 0', color: '#334155' }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Li e concordo com os <Link href="/termos">termos do Programa de Embaixadores</Link>.
              </span>
            </label>
            <button
              type="button"
              disabled={!acceptedTerms || loading || !token}
              onClick={acceptInvitation}
              style={{ width: '100%', border: 0, borderRadius: '12px', padding: '14px', background: '#002b5c', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: !acceptedTerms || loading ? .6 : 1 }}
            >
              {loading ? 'Validando…' : 'Aceitar e ativar participação'}
            </button>
          </>
        )}
        {message && (
          <p role="status" style={{ marginTop: '20px', padding: '14px', borderRadius: '10px', background: success ? '#ecfdf5' : '#fff1f2', color: success ? '#047857' : '#be123c' }}>
            {message}
          </p>
        )}
        {success && <Link href="/embaixador/dashboard">Ir para o painel do embaixador</Link>}
      </section>
    </main>
  );
}
