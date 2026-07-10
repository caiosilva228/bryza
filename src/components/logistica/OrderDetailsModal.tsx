'use client';

import React from 'react';
import { Pedido } from '@/models/types';
import { formatCurrency } from '@/utils/format';

const PROBLEM_LABELS: Record<string, string> = {
  cliente_nao_estava: 'Cliente não estava',
  endereco_errado: 'Endereço errado',
  cliente_recusou: 'Cliente recusou',
  sem_dinheiro: 'Sem dinheiro no momento',
  pediu_reagendamento: 'Pediu reagendamento',
  produto_avariado: 'Produto avariado',
  outro: 'Outro',
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartão',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  aguardando_preparacao: { label: 'Aguardando Preparação', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: 'schedule' },
  pronto_para_entrega: { label: 'Pronto para Entrega', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: 'inventory' },
  em_rota: { label: 'Em Rota', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: 'local_shipping' },
  entregue: { label: 'Entregue', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'check_circle' },
  finalizado: { label: 'Finalizado', color: '#047857', bg: 'rgba(4,120,87,0.12)', icon: 'task_alt' },
  cancelado: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: 'cancel' },
};

function formatPhone(phone?: string | null) {
  if (!phone) return '—';
  return phone.replace(/\D/g, '').replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

interface Props {
  pedido: Pedido | null;
  open: boolean;
  onClose: () => void;
}

export default function OrderDetailsModal({ pedido, open, onClose }: Props) {
  if (!open || !pedido) return null;

  const cliente = pedido.cliente;
  const status = STATUS_CONFIG[pedido.status_pedido] ?? { label: pedido.status_pedido, color: '#64748b', bg: '#f1f5f9', icon: 'info' };

  const phone = (cliente?.telefone ?? pedido.telefone_cliente ?? '').replace(/\D/g, '');
  const waLink = phone ? `https://wa.me/55${phone}` : null;

  const endereco = cliente
    ? `${cliente.endereco}${pedido.complemento ? `, ${pedido.complemento}` : ''} — ${cliente.bairro}, ${cliente.cidade}/${cliente.estado}`
    : pedido.endereco_entrega ?? '—';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          width: '100%', maxWidth: '520px',
          height: 'calc(100vh - 32px)',
          borderRadius: '16px',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>Detalhes do Pedido</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)', fontFamily: 'monospace' }}>#{pedido.numero_pedido}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--color-on-surface-variant)' }}>close</span>
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
          {/* Status Badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '20px',
            backgroundColor: status.bg, color: status.color,
            fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
            alignSelf: 'flex-start',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{status.icon}</span>
            {status.label}
          </span>

          {/* Cliente */}
          <Section title="Cliente" icon="person">
            <Row label="Nome" value={cliente?.nome ?? pedido.nome_cliente ?? '—'} />
            <Row label="Telefone" value={formatPhone(cliente?.telefone ?? pedido.telefone_cliente)} />
            <Row label="Endereço" value={endereco} />
            <Row label="Bairro" value={cliente?.bairro ?? pedido.bairro ?? '—'} />
            <Row label="Cidade" value={cliente?.cidade ?? pedido.cidade ?? '—'} />
          </Section>

          {/* Pedido */}
          <Section title="Dados do Pedido" icon="receipt_long">
            <Row label="Nº Pedido" value={`#${pedido.numero_pedido}`} mono />
            <Row label="Valor Total" value={formatCurrency(pedido.valor_total)} bold />
            <Row label="Pagamento" value={PAYMENT_LABELS[pedido.forma_pagamento] ?? pedido.forma_pagamento} />
            <Row label="Vendedor" value={pedido.vendedor?.nome ?? pedido.nome_vendedor ?? '—'} />
            <Row label="Criado em" value={formatDate(pedido.data_criacao ?? pedido.created_at)} />
          </Section>

          {/* Itens */}
          {pedido.itens && pedido.itens.length > 0 && (
            <Section title="Itens do Pedido" icon="inventory_2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {pedido.itens.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px',
                    backgroundColor: 'var(--color-surface-container-low)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline-variant)',
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{item.produto?.nome_produto ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                        {item.quantidade}x · {formatCurrency(item.preco_unitario)} un.
                      </p>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Logística */}
          <Section title="Logística" icon="local_shipping">
            <Row label="Motorista" value={pedido.motorista ?? '—'} />
            <Row label="Rota" value={pedido.rota ?? '—'} />
            <Row label="Saiu para entrega" value={formatDate(pedido.delivery_started_at)} />
            <Row label="Entregue em" value={formatDate(pedido.delivered_at)} />
            <Row label="Finalizado em" value={formatDate(pedido.finalized_at)} />
          </Section>

          {/* Pagamento */}
          <Section title="Conferência de Pagamento" icon="payments">
            <Row label="Valor Esperado" value={formatCurrency(pedido.valor_total)} bold />
            <Row label="Valor Recebido" value={pedido.amount_received != null ? formatCurrency(pedido.amount_received) : '—'} />
            <Row
              label="Status Conferência"
              value={
                pedido.payment_check_status === 'confirmado' ? '✅ Confirmado'
                  : pedido.payment_check_status === 'divergente' ? '⚠️ Divergente'
                    : '⏳ Pendente'
              }
            />
          </Section>

          {/* Observações */}
          {(pedido.observacoes || pedido.delivery_notes || pedido.delivery_problem_type) && (
            <Section title="Observações" icon="notes">
              {pedido.observacoes && <Row label="Obs. do Pedido" value={pedido.observacoes} />}
              {pedido.delivery_notes && <Row label="Obs. da Entrega" value={pedido.delivery_notes} />}
              {pedido.delivery_problem_type && (
                <Row label="Problema Registrado" value={PROBLEM_LABELS[pedido.delivery_problem_type] ?? pedido.delivery_problem_type} />
              )}
            </Section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', gap: '12px' }}>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', borderRadius: '10px',
                backgroundColor: '#25d366', color: '#fff',
                fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-headline)',
                textDecoration: 'none',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chat</span>
              WhatsApp
            </a>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              backgroundColor: 'var(--color-surface-container)',
              border: '1px solid var(--color-outline-variant)',
              fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-headline)',
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-on-surface-variant)' }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '4px 0' }}>
      <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: '13px', fontWeight: bold ? 800 : 500,
        fontFamily: mono ? 'monospace' : undefined,
        textAlign: 'right',
        color: 'var(--color-on-surface)',
      }}>{value}</span>
    </div>
  );
}
