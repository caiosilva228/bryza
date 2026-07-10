'use client';

import React from 'react';
import { Pedido } from '@/models/types';
import { formatCurrency } from '@/utils/format';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pronto_para_entrega: { label: 'Pronto para Entrega', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: 'inventory' },
  em_rota: { label: 'Em Rota', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: 'local_shipping' },
  entregue: { label: 'Entregue', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'check_circle' },
  finalizado: { label: 'Finalizado', color: '#047857', bg: 'rgba(4,120,87,0.12)', icon: 'task_alt' },
  cancelado: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: 'cancel' },
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartão',
};

function formatPhone(phone?: string | null) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') || phone;
}

function buildWhatsAppLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withDDI}`;
}

interface Props {
  pedidos: Pedido[];
  onViewDetails: (pedido: Pedido) => void;
  onMarcarEmRota: (pedido: Pedido) => void;
  onMarcarEntregue: (pedido: Pedido) => void;
  onConferirPagamento: (pedido: Pedido) => void;
  onRegistrarProblema: (pedido: Pedido) => void;
  loadingId: string | null;
}

export default function LogisticaTable({
  pedidos,
  onViewDetails,
  onMarcarEmRota,
  onMarcarEntregue,
  onConferirPagamento,
  onRegistrarProblema,
  loadingId,
}: Props) {
  if (pedidos.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: '16px',
        padding: '64px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          backgroundColor: 'var(--color-surface-container)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-outline)', opacity: 0.5 }}>local_shipping</span>
        </div>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-headline)' }}>Nenhum pedido encontrado</h3>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--color-on-surface-variant)', maxWidth: '360px', lineHeight: 1.6 }}>
          Nenhum pedido encontrado para os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-outline-variant)',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* Desktop Table */}
      <div className="logistica-table-wrapper" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface-container-highest)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              {['Pedido', 'Cliente', 'Telefone', 'Destino', 'Valor', 'Pagamento', 'Motorista', 'Status', 'Ações'].map(col => (
                <th key={col} style={{
                  padding: '12px 16px', fontSize: '11px', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: 'var(--color-on-surface-variant)', textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pedidos.map(pedido => {
              const statusCfg = STATUS_CONFIG[pedido.status_pedido] ?? {
                label: pedido.status_pedido, color: '#64748b', bg: '#f1f5f9', icon: 'info',
              };
              const clienteNome = pedido.cliente?.nome ?? pedido.nome_cliente ?? '—';
              const clienteTelefone = pedido.cliente?.telefone ?? pedido.telefone_cliente;
              const bairro = pedido.cliente?.bairro ?? pedido.bairro ?? '—';
              const cidade = pedido.cliente?.cidade ?? pedido.cidade ?? '';
              const waLink = buildWhatsAppLink(clienteTelefone);
              const isLoading = loadingId === pedido.id;

              const canEmRota = pedido.status_pedido === 'pronto_para_entrega';
              const canEntregue = pedido.status_pedido === 'em_rota';
              const canConferir = pedido.status_pedido === 'entregue';
              const canProblema = ['pronto_para_entrega', 'em_rota', 'entregue'].includes(pedido.status_pedido);

              return (
                <tr
                  key={pedido.id}
                  style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Pedido */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      #{pedido.numero_pedido}
                    </span>
                  </td>

                  {/* Cliente */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{clienteNome}</span>
                  </td>

                  {/* Telefone */}
                  <td style={{ padding: '12px 16px' }}>
                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', color: '#25d366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chat</span>
                        {formatPhone(clienteTelefone)}
                      </a>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>—</span>
                    )}
                  </td>

                  {/* Destino */}
                  <td style={{ padding: '12px 16px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{bairro}</p>
                      {cidade && <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>{cidade}</p>}
                    </div>
                  </td>

                  {/* Valor */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{formatCurrency(pedido.valor_total)}</span>
                  </td>

                  {/* Pagamento */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                      {PAYMENT_LABELS[pedido.forma_pagamento] ?? pedido.forma_pagamento}
                    </span>
                  </td>

                  {/* Motorista */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '12px', color: pedido.motorista ? 'var(--color-on-surface)' : 'var(--color-outline)' }}>
                      {pedido.motorista ?? '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px', borderRadius: '20px',
                      backgroundColor: statusCfg.bg, color: statusCfg.color,
                      fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{statusCfg.icon}</span>
                      {statusCfg.label}
                    </span>
                    {pedido.delivery_problem_type && (
                      <span style={{ display: 'block', fontSize: '10px', color: '#ef4444', marginTop: '3px', fontWeight: 600 }}>
                        ⚠️ Problema registrado
                      </span>
                    )}
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {/* Ver detalhes */}
                      <ActionBtn
                        icon="visibility"
                        title="Ver detalhes"
                        onClick={() => onViewDetails(pedido)}
                        disabled={isLoading}
                      />

                      {/* Marcar em rota */}
                      {canEmRota && (
                        <ActionBtn
                          icon="local_shipping"
                          title="Marcar como Em Rota"
                          color="#8b5cf6"
                          onClick={() => onMarcarEmRota(pedido)}
                          disabled={isLoading}
                          loading={isLoading}
                        />
                      )}

                      {/* Marcar entregue */}
                      {canEntregue && (
                        <ActionBtn
                          icon="check_circle"
                          title="Marcar como Entregue"
                          color="#10b981"
                          onClick={() => onMarcarEntregue(pedido)}
                          disabled={isLoading}
                          loading={isLoading}
                        />
                      )}

                      {/* Conferir pagamento */}
                      {canConferir && (
                        <ActionBtn
                          icon="payments"
                          title="Conferir Pagamento e Finalizar"
                          color="#047857"
                          onClick={() => onConferirPagamento(pedido)}
                          disabled={isLoading}
                        />
                      )}

                      {/* Registrar problema */}
                      {canProblema && (
                        <ActionBtn
                          icon="report_problem"
                          title="Registrar Problema"
                          color="#ef4444"
                          onClick={() => onRegistrarProblema(pedido)}
                          disabled={isLoading}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBtn({
  icon, title, color, onClick, disabled, loading,
}: {
  icon: string;
  title: string;
  color?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32,
        borderRadius: '8px',
        border: '1px solid var(--color-outline-variant)',
        backgroundColor: 'var(--color-surface-container-low)',
        color: color ?? 'var(--color-on-surface-variant)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = color ? `${color}18` : 'var(--color-surface-container)';
          e.currentTarget.style.borderColor = color ?? 'var(--color-outline)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)';
        e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
        {loading ? 'progress_activity' : icon}
      </span>
    </button>
  );
}
