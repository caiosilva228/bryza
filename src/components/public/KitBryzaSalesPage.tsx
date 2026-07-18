'use client';

import React, { useState } from 'react';
import { createPublicOrderAction } from '@/app/actions/create-public-order';

interface AmbassadorPublicInfo {
  display_name: string;
  referral_code: string;
  photo_path?: string | null;
  city?: string | null;
  instagram?: string | null;
}

interface KitBryzaSalesPageProps {
  ambassador: AmbassadorPublicInfo;
  products: Array<{ id: string; nome: string; preco_venda: number }>;
}

export function KitBryzaSalesPage({ ambassador, products }: KitBryzaSalesPageProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState(ambassador.city || 'São Paulo');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState<{ numero_pedido: string; valor_total: number } | null>(null);
  const [erro, setErro] = useState('');

  const kitProduto = products[0] || { id: 'dummy-id', nome: 'Kit Bryza Premium', preco_venda: 99.90 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    const res = await createPublicOrderAction({
      nome,
      telefone,
      endereco,
      bairro,
      cidade,
      forma_pagamento: formaPagamento,
      itens: [{ produto_id: kitProduto.id, quantidade: 1 }],
    });

    setLoading(false);

    if (res.success && res.data) {
      setSucesso({
        numero_pedido: res.data.numero_pedido,
        valor_total: res.data.valor_total,
      });
    } else {
      setErro(res.error || 'Não foi possível finalizar o pedido. Tente novamente.');
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Olá! Vim pela indicação do(a) ${ambassador.display_name} (código ${ambassador.referral_code}) e gostaria de tirar dúvidas sobre o Kit Bryza!`
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Header com anúncio do Embaixador */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {ambassador.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Indicação Oficial</div>
            <div style={{ fontWeight: '600', color: '#38bdf8' }}>{ambassador.display_name}</div>
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', backgroundColor: '#0284c7', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          {ambassador.referral_code.toUpperCase()}
        </span>
      </header>

      {/* Conteúdo da Venda */}
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Banner do Produto */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', marginBottom: '12px' }}>
            {kitProduto.nome}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '20px', lineHeight: '1.5' }}>
            Transforme sua rotina com a tecnologia exclusiva Bryza. Peça agora e pague diretamente na entrega!
          </p>

          <div style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>
            R$ {Number(kitProduto.preco_venda).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Pagamento na entrega ou via PIX</div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ backgroundColor: '#0f172a', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>✓ Entrega Rápida</span>
            <span style={{ backgroundColor: '#0f172a', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>✓ Garantia Bryza</span>
            <span style={{ backgroundColor: '#0f172a', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>✓ Pague ao Receber</span>
          </div>
        </div>

        {/* Botão de WhatsApp em Destaque */}
        <div style={{ marginBottom: '24px' }}>
          <a
            href={`https://wa.me/?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              backgroundColor: '#22c55e',
              color: '#fff',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: 'bold',
              textDecoration: 'none',
              fontSize: '1rem',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
            }}
          >
            💬 Falar no WhatsApp com Embaixador
          </a>
        </div>

        {/* Formulário de Checkout Rápido */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
            Preencha para receber em casa
          </h2>

          {sucesso ? (
            <div style={{ backgroundColor: '#064e3b', border: '1px solid #10b981', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#34d399', fontWeight: 'bold', marginBottom: '8px' }}>
                🎉 Pedido Realizado com Sucesso!
              </h3>
              <p style={{ color: '#e2e8f0', marginBottom: '12px' }}>
                Número do Pedido: <strong>{sucesso.numero_pedido}</strong>
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Valor Total: R$ {Number(sucesso.valor_total).toFixed(2)}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '16px' }}>
                Nossa equipe ou o embaixador entrará em contato para confirmar o horário de entrega!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {erro && (
                <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  {erro}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Seu Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Telefone / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.95rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Endereço Completo *</label>
                <input
                  type="text"
                  required
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, Número e Apto"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.95rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Bairro *</label>
                  <input
                    type="text"
                    required
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Bairro"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Cidade *</label>
                  <input
                    type="text"
                    required
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="Cidade"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.95rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Forma de Pagamento Preferida</label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', fontSize: '0.95rem' }}
                >
                  <option value="pix">PIX na entrega</option>
                  <option value="dinheiro">Dinheiro na entrega</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  border: 'none',
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                }}
              >
                {loading ? 'Processando Pedido...' : '🚀 CONFIRMAR PEDIDO AGORA'}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #1e293b' }}>
        © 2026 Bryza Sistem — Oferta Exclusiva com Indicação Atribuída
      </footer>
    </div>
  );
}
