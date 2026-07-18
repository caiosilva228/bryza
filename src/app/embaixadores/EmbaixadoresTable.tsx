'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSignedPhotoUrl, alterarStatus } from './actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

interface EmbaixadorItem {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  username: string;
  referral_code: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  state: string;
  plano_nome: string;
  status: 'pendente' | 'ativo' | 'inativo' | 'bloqueado';
  created_at: string;
  photo_path: string | null;
  total_vendas: number;
  comissao_liberada: number;
  total_recebido: number;
}

interface TableProps {
  lista: EmbaixadorItem[];
  onRefresh: () => void;
}

export default function EmbaixadoresTable({ lista, onRefresh }: TableProps) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPhotos = async () => {
      const urls: Record<string, string> = {};
      const promises = lista.map(async (item) => {
        if (item.photo_path) {
          try {
            const url = await getSignedPhotoUrl(item.photo_path);
            if (url) {
              urls[item.id] = url;
            }
          } catch (e) {
            console.error('Erro ao buscar signed URL para foto:', e);
          }
        }
      });
      await Promise.all(promises);
      setPhotoUrls(urls);
    };

    fetchPhotos();
  }, [lista]);

  const handleStatusChange = async (id: string, newStatus: string, name: string) => {
    try {
      await alterarStatus(id, newStatus);
      toast.success(`Status de ${name} alterado para ${newStatus}.`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar status.');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string; label: string }> = {
      pendente: { bg: '#FEF3C7', text: '#D97706', label: 'Pendente' },
      ativo: { bg: '#D1FAE5', text: '#059669', label: 'Ativo' },
      inativo: { bg: '#F3F4F6', text: '#4B5563', label: 'Inativo' },
      bloqueado: { bg: '#FEE2E2', text: '#DC2626', label: 'Bloqueado' }
    };
    const badge = colors[status] || { bg: '#F3F4F6', text: '#4B5563', label: status };
    return (
      <span style={{
        backgroundColor: badge.bg,
        color: badge.text,
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600
      }}>
        {badge.label}
      </span>
    );
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
        fontSize: '14px'
      }}>
        <thead>
          <tr style={{
            borderBottom: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface-container-low)'
          }}>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Foto</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Nome / Exibição</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Usuário/Código</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Telefone</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Instagram</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Cidade</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Plano</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>Vendas</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>C. Liberada</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>Total Pago</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Status</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Cadastro</th>
            <th style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((item) => {
            const photoUrl = photoUrls[item.id] || null;
            return (
              <tr key={item.id} style={{
                borderBottom: '1px solid var(--color-outline-variant)',
                transition: 'background-color 0.15s ease'
              }} className="table-row-hover">
                {/* Foto */}
                <td style={{ padding: '12px 20px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-container-high)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-outline-variant)'
                  }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt={item.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-outline)' }}>person</span>
                    )}
                  </div>
                </td>

                {/* Nome */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>{item.full_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>{item.display_name}</div>
                </td>

                {/* Código/Usuário */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 700 }}>
                  {item.username}
                </td>

                {/* Telefone */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', color: 'var(--color-on-surface-variant)' }}>
                  {item.phone || '-'}
                </td>

                {/* Instagram */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {item.instagram ? (
                    <a 
                      href={`https://instagram.com/${item.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {item.instagram}
                    </a>
                  ) : '-'}
                </td>

                {/* Cidade */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {item.city ? `${item.city} - ${item.state || ''}` : '-'}
                </td>

                {/* Plano */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {item.plano_nome}
                </td>

                {/* Vendas */}
                <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 700 }}>
                  {item.total_vendas}
                </td>

                {/* Comissao Liberada */}
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--color-success, #059669)' }}>
                  {formatCurrency(item.comissao_liberada)}
                </td>

                {/* Total Recebido */}
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {formatCurrency(item.total_recebido)}
                </td>

                {/* Status */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  {getStatusBadge(item.status)}
                </td>

                {/* Cadastro */}
                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', color: 'var(--color-on-surface-variant)' }}>
                  {formatDate(item.created_at)}
                </td>

                {/* Ações */}
                <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <Link 
                      href={`/embaixadores/${item.id}`}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-primary-container)'
                      }}
                      title="Visualizar Detalhes"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                    </Link>

                    <Link 
                      href={`/embaixadores/${item.id}/editar`}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        color: 'var(--color-outline)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-outline-variant)'
                      }}
                      title="Editar Cadastro"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </Link>

                    {item.status !== 'ativo' && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'ativo', item.full_name)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#059669',
                          border: '1px solid rgba(5, 150, 105, 0.2)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Ativar Conta"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                      </button>
                    )}

                    {item.status === 'ativo' && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'inativo', item.full_name)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#D97706',
                          border: '1px solid rgba(217, 119, 6, 0.2)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Inativar Conta"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>block</span>
                      </button>
                    )}

                    {item.status !== 'bloqueado' && (
                      <button
                        onClick={() => handleStatusChange(item.id, 'bloqueado', item.full_name)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          color: '#DC2626',
                          border: '1px solid rgba(220, 38, 38, 0.2)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Bloquear Acesso"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
