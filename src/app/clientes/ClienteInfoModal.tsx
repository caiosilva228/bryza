'use client';

import { Cliente } from '@/models/types';
import { VendaWithItens } from '@/services/vendas';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getVendasPorClienteAction } from './actions';

interface ClienteInfoModalProps {
  cliente: Cliente | null;
  onClose: () => void;
}

export default function ClienteInfoModal({ cliente, onClose }: ClienteInfoModalProps) {
  const [vendas, setVendas] = useState<VendaWithItens[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVendaId, setExpandedVendaId] = useState<string | null>(null);

  useEffect(() => {
    if (cliente) {
      loadVendas();
    }
  }, [cliente]);

  const loadVendas = async () => {
    if (!cliente) return;
    setLoading(true);
    try {
      const data = await getVendasPorClienteAction(cliente.id);
      setVendas(data);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!cliente) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'lead': return 'var(--color-surface-variant)';
      case 'cliente': return '#4caf50'; // Verde
      case 'recorrente': return '#2196f3'; // Azul
      case 'inativo': return '#f44336'; // Vermelho
      default: return 'var(--color-outline)';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content"
        style={{ maxWidth: '960px' }}
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header Elegante */}
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-surface-container-lowest)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              backgroundColor: getStatusColor(cliente.status_cliente),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: `0 8px 16px ${getStatusColor(cliente.status_cliente)}40`
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
                {cliente.status_cliente === 'lead' ? 'person_search' : 'person'}
              </span>
            </div>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0, color: 'var(--color-on-surface)' }}>{cliente.nome}</h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ 
                  fontSize: '11px', 
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface-variant)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 800
                }}>
                  C{String(cliente.codigo_cliente || 0).padStart(5, '0')}
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  color: getStatusColor(cliente.status_cliente),
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {cliente.status_cliente}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-container-high)',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-on-surface-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-highest)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content Area */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--color-surface)' }}>
          <div className="cliente-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '32px' }}>

            
            {/* Left: Info Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <section>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Contatos e Localização</label>
                <div style={{ 
                  backgroundColor: 'var(--color-surface-container-lowest)', 
                  padding: '20px', 
                  borderRadius: '20px', 
                  border: '1px solid var(--color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--color-primary-container-low)', display: 'flex', alignItems: 'center', justifyItems: 'center', color: 'var(--color-primary)', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>call</span>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>{cliente.telefone}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--color-primary-container-low)', display: 'flex', alignItems: 'center', justifyItems: 'center', color: 'var(--color-primary)', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>location_on</span>
                    </div>
                    <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-on-surface)' }}>
                      {cliente.endereco}, {cliente.numero}<br/>
                      {cliente.bairro} - {cliente.cidade}/{cliente.estado}
                    </span>
                  </div>
                </div>
              </section>

              <section>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Origem e Observações</label>
                <div style={{ 
                  backgroundColor: 'var(--color-surface-container-lowest)', 
                  padding: '20px', 
                  borderRadius: '20px', 
                  border: '1px solid var(--color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700 }}>CANAL DE ENTRADA</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>campaign</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, textTransform: 'capitalize' }}>{cliente.origem || 'Tráfego Direto'}</span>
                    </div>
                  </div>
                  <div style={{ paddingTop: '12px', borderTop: '1px solid var(--color-outline-variant)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontWeight: 700 }}>NOTAS INTERNAS</span>
                    <p style={{ 
                      fontSize: '13px', 
                      color: 'var(--color-on-surface-variant)', 
                      marginTop: '6px',
                      lineHeight: '1.5',
                      fontStyle: cliente.observacoes ? 'normal' : 'italic'
                    }}>
                      {cliente.observacoes || 'Nenhuma observação extra registrada.'}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Performance de Vendas</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ backgroundColor: 'var(--color-primary-container-low)', padding: '20px', borderRadius: '20px', border: '1px solid var(--color-primary-container)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 800 }}>TOTAL COMPRAS</div>
                    <div style={{ fontSize: '24px', fontWeight: 950, color: 'var(--color-primary)', marginTop: '4px' }}>{cliente.total_compras}</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--color-success-container-low)', padding: '20px', borderRadius: '20px', border: '1px solid var(--color-success-container)' }}>
                    <div style={{ fontSize: '11px', color: '#1b5e20', fontWeight: 800 }}>VALOR TOTAL</div>
                    <div style={{ fontSize: '22px', fontWeight: 950, color: '#1b5e20', marginTop: '4px' }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor_total_gasto)}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Right: Modern History Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Histórico de Atividade</label>
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                paddingRight: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-outline)' }}>
                     <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px' }}>sync</span>
                     <p style={{ marginTop: '12px', fontSize: '13px' }}>Buscando registros...</p>
                  </div>
                ) : vendas.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '60px', 
                    color: 'var(--color-on-surface-variant)', 
                    border: '2px dashed var(--color-outline-variant)', 
                    borderRadius: '24px',
                    backgroundColor: 'var(--color-surface-container-lowest)'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3, marginBottom: '16px', display: 'block' }}>history</span>
                    <p style={{ fontWeight: 600 }}>Nenhum pedido encontrado</p>
                    <p style={{ fontSize: '12px', opacity: 0.7 }}>Este cliente ainda não iniciou seu histórico de compras.</p>
                  </div>
                ) : vendas.map(venda => (
                  <div key={venda.id} style={{
                    backgroundColor: 'var(--color-surface-container-lowest)',
                    borderRadius: '20px',
                    border: '1px solid var(--color-outline-variant)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}>
                    <div 
                      onClick={() => setExpandedVendaId(expandedVendaId === venda.id ? null : venda.id)}
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        backgroundColor: expandedVendaId === venda.id ? 'var(--color-surface-container-high)' : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ backgroundColor: 'var(--color-surface-container-highest)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>receipt_long</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>{new Date(venda.data_venda).toLocaleDateString('pt-BR')}</span>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 800,
                            color: 'var(--color-primary)',
                            textTransform: 'uppercase'
                          }}>
                            {venda.status_venda}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontWeight: 900, fontSize: '15px', color: 'var(--color-on-surface)' }}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.valor_total)}
                        </span>
                        <span className="material-symbols-outlined" style={{ 
                          fontSize: '20px', 
                          color: 'var(--color-outline)',
                          transform: expandedVendaId === venda.id ? 'rotate(180deg)' : 'none', 
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                        }}>
                          expand_more
                        </span>
                      </div>
                    </div>

                    {expandedVendaId === venda.id && (
                      <div style={{ 
                        padding: '0 20px 20px 20px', 
                        borderTop: '1px solid var(--color-outline-variant)', 
                        backgroundColor: 'var(--color-surface-container-low)',
                        animation: 'slideIn 0.2s ease'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', marginTop: '8px' }}>
                          <thead>
                            <tr style={{ textAlign: 'left' }}>
                              <th style={{ padding: '8px 0', fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase' }}>Item</th>
                              <th style={{ padding: '8px 0', fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'center' }}>Qtd</th>
                              <th style={{ padding: '8px 0', fontSize: '11px', fontWeight: 800, color: 'var(--color-outline)', textTransform: 'uppercase', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {venda.venda_itens.map(item => (
                              <tr key={item.id}>
                                <td style={{ padding: '8px 0', fontSize: '13px', fontWeight: 600 }}>{item.produto.nome_produto}</td>
                                <td style={{ padding: '8px 0', fontSize: '13px', textAlign: 'center', fontWeight: 500 }}>{item.quantidade}</td>
                                <td style={{ padding: '8px 0', fontSize: '13px', textAlign: 'right', fontWeight: 700 }}>
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ 
          padding: '24px 32px', 
          backgroundColor: 'var(--color-surface-container-lowest)', 
          borderTop: '1px solid var(--color-outline-variant)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '14px',
              color: 'var(--color-on-surface-variant)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            Fechar
          </button>
          <Link 
            href={`/clientes/${cliente.id}/editar`}
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 8px 16px rgba(var(--color-primary-rgb), 0.2)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit_square</span>
            Editar Cadastro
          </Link>
        </div>

        <style jsx>{`
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
           @keyframes slideIn {
            from { transform: translateY(-10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
