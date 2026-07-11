'use client';

import React, { useMemo } from 'react';
import { DeliveryRoute, RouteOrder } from '@/models/types';
import { formatCurrency, formatShortDate } from '@/utils/format';

interface Props {
  route: (DeliveryRoute & { delivery_route_orders?: RouteOrder[] }) | null;
  open: boolean;
  onClose: () => void;
}

export default function RouteManifestModal({ route, open, onClose }: Props) {
  const orders = useMemo(() => {
    if (!route || !route.delivery_route_orders) return [];
    return [...route.delivery_route_orders].sort((a, b) => a.sequence - b.sequence);
  }, [route]);

  // Agrupamento de itens para romaneio (carga do veículo)
  const productSummary = useMemo(() => {
    const summary: Record<string, { nome: string, qtd: number }> = {};
    orders.forEach(ro => {
      const itens = ro.pedido?.itens || [];
      itens.forEach(item => {
        const prodId = item.produto_id;
        const nome = item.produto?.nome_produto || 'Produto Desconhecido';
        if (!summary[prodId]) {
          summary[prodId] = { nome, qtd: 0 };
        }
        summary[prodId].qtd += item.quantidade;
      });
    });
    return Object.values(summary).sort((a, b) => b.qtd - a.qtd);
  }, [orders]);

  if (!open || !route) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Classe de print global ocultando tudo menos a área de print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        width: '100%', maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header (no-print) */}
        <div className="no-print" style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface-container-low)', borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-headline)' }}>Romaneio de Carga</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Visualização para conferência e impressão</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handlePrint} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span> Imprimir
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--color-on-surface-variant)' }}>close</span>
            </button>
          </div>
        </div>

        {/* Content Area (Printable) */}
        <div id="print-area" style={{ flex: 1, overflowY: 'auto', padding: '32px', color: '#000', backgroundColor: '#fff' }}>
          
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, textTransform: 'uppercase' }}>Romaneio de Carga</h1>
              <h2 style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700 }}>Rota: #{route.codigo_rota} — {route.name}</h2>
            </div>
            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
              <p style={{ margin: 0 }}>Data: {formatShortDate(route.date + 'T00:00:00')}</p>
              <p style={{ margin: '4px 0 0' }}>Motorista: {route.driver_name || 'Sem motorista definido'}</p>
              <p style={{ margin: '4px 0 0' }}>CÓDIGO: R-{route.codigo_rota}</p>
            </div>
          </div>

          {/* Resumo de Produtos */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>1. Resumo de Produtos (Para Separação)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', width: '80%' }}>Produto</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '20%' }}>Qtd Total</th>
                </tr>
              </thead>
              <tbody>
                {productSummary.map((ps, i) => (
                  <tr key={i}>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 600 }}>{ps.nome}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 800 }}>{ps.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista de Entregas */}
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 800, textTransform: 'uppercase' }}>2. Ordem de Entrega ({orders.length} pedidos)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map((ro, i) => {
                const p = ro.pedido;
                if (!p) return null;
                return (
                  <div key={ro.id} style={{ border: '1px solid #000', padding: '12px', display: 'flex', gap: '16px', pageBreakInside: 'avoid' }}>
                    <div style={{ flex: '0 0 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: '#fff', fontSize: '20px', fontWeight: 900 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>{p.cliente?.nome || p.nome_cliente}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px' }}>
                            {p.cliente?.endereco || p.endereco_entrega}
                            {p.cliente?.numero ? `, ${p.cliente.numero}` : ''} - {p.cliente?.bairro || p.bairro}
                          </p>
                          {p.cliente?.telefone && <p style={{ margin: '2px 0 0', fontSize: '12px' }}>Tel: {p.cliente.telefone}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>{formatCurrency(p.valor_total)}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Pgto: {p.forma_pagamento}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#666' }}>Ped: #{p.numero_pedido}</p>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '12px' }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Itens:</p>
                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                          {p.itens?.map((item, idx) => (
                            <li key={idx}><strong>{item.quantidade}x</strong> - {item.produto?.nome_produto || 'Produto'}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Espaço para assinatura */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #ccc' }}>
                        <div style={{ width: '45%' }}>
                          <div style={{ borderBottom: '1px solid #000', height: '24px' }}></div>
                          <p style={{ margin: '4px 0 0', fontSize: '10px', textAlign: 'center' }}>Assinatura do Recebedor</p>
                        </div>
                        <div style={{ width: '45%' }}>
                          <div style={{ borderBottom: '1px solid #000', height: '24px' }}></div>
                          <p style={{ margin: '4px 0 0', fontSize: '10px', textAlign: 'center' }}>Data e Hora</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
