'use client';

import { useEffect, useState } from 'react';
import styles from './account.module.css';

type Card = {
  id: string;
  lastFourDigits: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
  issuerName: string | null;
  paymentMethodId: string | null;
};

export function SavedCardsPanel() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadCards = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments/mercado-pago/cards', { cache: 'no-store' });
      const body = await response.json().catch(() => null) as { cards?: Card[]; error?: string } | null;
      if (!response.ok) throw new Error(body?.error || 'Não foi possível carregar os cartões.');
      setCards(Array.isArray(body?.cards) ? body.cards : []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os cartões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCards(); }, []);

  const removeCard = async (cardId: string) => {
    setDeleting(cardId);
    try {
      const response = await fetch(`/api/payments/mercado-pago/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || 'Não foi possível remover o cartão.');
      setCards(current => current.filter(card => card.id !== cardId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover o cartão.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="saved-cards-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="saved-cards-title">Cartões salvos</h2>
          <p>Gerencie os cartões tokenizados pelo Mercado Pago.</p>
        </div>
      </div>
      {loading ? <p>Carregando cartões…</p> : null}
      {!loading && error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : null}
      {!loading && !error && cards.length === 0 ? <p>Nenhum cartão salvo ainda.</p> : null}
      {!loading && !error && cards.length > 0 ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {cards.map(card => (
            <div key={card.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
              <div>
                <strong>{card.issuerName || card.paymentMethodId || 'Cartão'} •••• {card.lastFourDigits || '****'}</strong>
                {card.expirationMonth && card.expirationYear ? <small style={{ display: 'block', color: '#64748b' }}>Validade {String(card.expirationMonth).padStart(2, '0')}/{card.expirationYear}</small> : null}
              </div>
              <button type="button" onClick={() => removeCard(card.id)} disabled={deleting === card.id}>
                {deleting === card.id ? 'Removendo…' : 'Excluir'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
