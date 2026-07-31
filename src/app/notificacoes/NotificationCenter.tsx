'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import styles from './notifications.module.css';

type Recipient = {
  id: string;
  name: string;
  email: string | null;
  username: string;
  deviceCount: number;
};

type Campaign = {
  id: string;
  audience: 'all' | 'specific';
  target_ambassador_id: string | null;
  title: string;
  body: string;
  target_url: string;
  sound_type: 'none' | 'money';
  recipient_count: number;
  status: 'queued' | 'sent' | 'failed';
  sent_at: string | null;
  created_at: string;
  deliveries: {
    queued: number;
    sent: number;
    failed: number;
    read: number;
  };
};

type CenterData = {
  recipients: Recipient[];
  campaigns: Campaign[];
};

const DEFAULT_DATA: CenterData = {
  recipients: [],
  campaigns: [],
};

export function NotificationCenter() {
  const [data, setData] = useState<CenterData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<'all' | 'specific'>('all');
  const [ambassadorId, setAmbassadorId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('/embaixador/dashboard');
  const [soundType, setSoundType] = useState<'none' | 'money'>('none');

  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/notifications', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao carregar.');
      setData(result as CenterData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar notificações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedRecipient = useMemo(
    () => data.recipients.find((recipient) => recipient.id === ambassadorId),
    [ambassadorId, data.recipients],
  );
  const recipientCount = audience === 'all'
    ? data.recipients.length
    : selectedRecipient ? 1 : 0;
  const activeDeviceCount = audience === 'all'
    ? data.recipients.reduce((sum, recipient) => sum + recipient.deviceCount, 0)
    : selectedRecipient?.deviceCount || 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (audience === 'specific' && !ambassadorId) {
      toast.error('Selecione um embaixador.');
      return;
    }

    const targetLabel = audience === 'all'
      ? `${recipientCount} embaixadores ativos`
      : selectedRecipient?.name || 'o destinatário selecionado';
    if (!window.confirm(`Enviar esta notificação para ${targetLabel}?`)) return;

    setSending(true);
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          ambassadorId: audience === 'specific' ? ambassadorId : null,
          title,
          body: message,
          targetUrl,
          soundType,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao enviar.');

      toast.success(
        `Notificação enviada ao sininho de ${result.recipients} embaixador${result.recipients > 1 ? 'es' : ''}.`,
        {
          description: activeDeviceCount
            ? `O PUSH foi colocado na fila para ${activeDeviceCount} dispositivo${activeDeviceCount > 1 ? 's' : ''} ativo${activeDeviceCount > 1 ? 's' : ''}.`
            : 'Nenhum dispositivo possui PUSH ativo; a mensagem ficará disponível no sininho.',
        },
      );
      setTitle('');
      setMessage('');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Comunicação · Administração</span>
          <h1>Central de notificações</h1>
          <p>Envie mensagens personalizadas ao sininho e por PUSH para toda a rede ou para uma pessoa.</p>
        </div>
        <div className={styles.summary}>
          <span className="material-symbols-outlined">notifications_active</span>
          <div>
            <strong>{data.recipients.length} embaixadores ativos</strong>
            <small>{data.recipients.reduce((sum, item) => sum + item.deviceCount, 0)} dispositivos com PUSH</small>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        <form className={styles.composer} onSubmit={submit}>
          <div className={styles.sectionHeading}>
            <span className="material-symbols-outlined">edit_notifications</span>
            <div><strong>Nova notificação</strong><small>Campos visíveis para o destinatário</small></div>
          </div>

          <fieldset className={styles.audience}>
            <legend>Público</legend>
            <label className={audience === 'all' ? styles.selectedOption : ''}>
              <input
                type="radio"
                name="audience"
                checked={audience === 'all'}
                onChange={() => setAudience('all')}
              />
              <span className="material-symbols-outlined">groups</span>
              <span><strong>Todos</strong><small>Embaixadores ativos</small></span>
            </label>
            <label className={audience === 'specific' ? styles.selectedOption : ''}>
              <input
                type="radio"
                name="audience"
                checked={audience === 'specific'}
                onChange={() => setAudience('specific')}
              />
              <span className="material-symbols-outlined">person</span>
              <span><strong>Individual</strong><small>Uma pessoa específica</small></span>
            </label>
          </fieldset>

          {audience === 'specific' && (
            <label className={styles.field}>
              <span>Destinatário</span>
              <select
                value={ambassadorId}
                onChange={(event) => setAmbassadorId(event.target.value)}
                required
              >
                <option value="">Selecione um embaixador</option>
                {data.recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name} · {recipient.deviceCount
                      ? `${recipient.deviceCount} PUSH ativo${recipient.deviceCount > 1 ? 's' : ''}`
                      : 'somente sininho'}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={styles.field}>
            <span>Título <small>{title.length}/80</small></span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="Ex.: Novidade importante para você"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Mensagem <small>{message.length}/300</small></span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={300}
              rows={5}
              placeholder="Escreva uma mensagem curta e clara."
              required
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Abrir ao tocar</span>
              <select value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)}>
                <option value="/embaixador/dashboard">Visão geral</option>
                <option value="/embaixador/comissoes">Comissões</option>
                <option value="/embaixador/meus-pedidos">Meus pedidos</option>
                <option value="/embaixador/materiais">Materiais</option>
                <option value="/embaixador/meu-link">Meu link</option>
                <option value="/embaixador/perfil">Meu perfil</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Som no app aberto</span>
              <select
                value={soundType}
                onChange={(event) => setSoundType(event.target.value as 'none' | 'money')}
              >
                <option value="none">Sem som personalizado</option>
                <option value="money">Caixa registradora</option>
              </select>
            </label>
          </div>

          <div className={styles.deliveryNote}>
            <span className="material-symbols-outlined">info</span>
            <span>
              A mensagem chegará ao sininho de <strong>{recipientCount}</strong> destinatário{recipientCount === 1 ? '' : 's'}.
              {' '}Há <strong>{activeDeviceCount}</strong> dispositivo{activeDeviceCount === 1 ? '' : 's'} com PUSH ativo.
            </span>
          </div>

          <button
            className={styles.sendButton}
            type="submit"
            disabled={sending || loading || recipientCount === 0}
          >
            <span className="material-symbols-outlined">send</span>
            {sending ? 'Enviando...' : 'Enviar notificação'}
          </button>
        </form>

        <aside className={styles.preview}>
          <div className={styles.sectionHeading}>
            <span className="material-symbols-outlined">visibility</span>
            <div><strong>Prévia</strong><small>Como aparecerá no app</small></div>
          </div>
          <div className={styles.phone}>
            <div className={styles.phoneTop}><span>9:41</span><span>● ● ●</span></div>
            <div className={styles.pushPreview}>
              <img src="/app-icon-192.png" alt="" />
              <div>
                <span>BRYZA · AGORA</span>
                <strong>{title || 'Título da notificação'}</strong>
                <p>{message || 'Sua mensagem personalizada aparecerá aqui.'}</p>
              </div>
            </div>
          </div>
          <div className={styles.previewDetails}>
            <span><strong>Público</strong>{audience === 'all' ? 'Todos os embaixadores' : selectedRecipient?.name || 'Selecione alguém'}</span>
            <span><strong>Destino</strong>{targetUrl}</span>
            <span><strong>Som</strong>{soundType === 'money' ? 'Caixa registradora' : 'Sem som personalizado'}</span>
          </div>
        </aside>
      </div>

      <section className={styles.history}>
        <div className={styles.sectionHeading}>
          <span className="material-symbols-outlined">history</span>
          <div><strong>Histórico de envios</strong><small>Últimas 30 notificações</small></div>
        </div>

        {loading ? (
          <div className={styles.empty}>Carregando histórico...</div>
        ) : data.campaigns.length === 0 ? (
          <div className={styles.empty}>Nenhuma notificação personalizada foi enviada ainda.</div>
        ) : (
          <div className={styles.historyList}>
            {data.campaigns.map((campaign) => {
              const recipient = data.recipients.find(
                (item) => item.id === campaign.target_ambassador_id,
              );
              return (
                <article key={campaign.id} className={styles.historyItem}>
                  <span className={styles.historyIcon}>
                    <span className="material-symbols-outlined">campaign</span>
                  </span>
                  <div className={styles.historyContent}>
                    <div>
                      <strong>{campaign.title}</strong>
                      <time>{new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(campaign.created_at))}</time>
                    </div>
                    <p>{campaign.body}</p>
                    <div className={styles.tags}>
                      <span>{campaign.audience === 'all' ? 'Todos' : recipient?.name || 'Individual'}</span>
                      <span>{campaign.recipient_count} destinatário{campaign.recipient_count === 1 ? '' : 's'}</span>
                      <span>{campaign.deliveries.sent} PUSH entregue{campaign.deliveries.sent === 1 ? '' : 's'}</span>
                      <span>{campaign.deliveries.read} lida{campaign.deliveries.read === 1 ? '' : 's'}</span>
                      {campaign.deliveries.failed > 0 && (
                        <span className={styles.failed}>{campaign.deliveries.failed} falha{campaign.deliveries.failed === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
