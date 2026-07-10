import React, { useState, useMemo, useEffect } from 'react';
import { Cliente, Produto, Profile, PedidoItem, Pedido, TipoDesconto } from '@/models/types';
import { savePedido, updatePedidoAction } from '../actions';
import { criarAgendamentoAction } from '../../agendamentos/actions';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';
import styles from './PedidoFormModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientes: Cliente[];
  produtos: Produto[];
  vendedores: Profile[];
  pedidoToEdit?: Pedido | null;
}

interface SearchItem {
  id: string;
  display: string;
  search: string;
  code?: string;
  name: string;
}

interface DiscountState {
  tipo: TipoDesconto;
  valor: number;
}

interface CartItemState extends DiscountState {
  produtoId: string;
  quantidade: number;
  preco_unitario: number;
}

const DISCOUNT_OPTIONS: { value: TipoDesconto; label: string }[] = [
  { value: 'none', label: 'Sem desconto' },
  { value: 'percent', label: 'Percentual (%)' },
  { value: 'fixed', label: 'Valor fixo (R$)' },
];

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const calculateDiscountAmount = (baseAmount: number, tipo: TipoDesconto, valor: number, quantity: number = 1) => {
  const safeBase = roundCurrency(Math.max(0, Number(baseAmount) || 0));
  const safeValue = Math.max(0, Number(valor) || 0);

  if (safeBase === 0 || tipo === 'none' || safeValue === 0) {
    return 0;
  }

  if (tipo === 'percent') {
    return roundCurrency(Math.min(safeBase, safeBase * (Math.min(safeValue, 100) / 100)));
  }

  return roundCurrency(Math.min(safeBase, safeValue * quantity));
};

function DiscountControls({
  label,
  discount,
  appliedAmount,
  onTypeChange,
  onValueChange,
}: {
  label: string;
  discount: DiscountState;
  appliedAmount: number;
  onTypeChange: (tipo: TipoDesconto) => void;
  onValueChange: (valor: number) => void;
}) {
  const isDisabled = discount.tipo === 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(96px, 1fr)', gap: '8px' }}>
        <select
          value={discount.tipo}
          onChange={(e) => onTypeChange(e.target.value as TipoDesconto)}
          style={{
            width: '100%',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            color: 'var(--color-on-surface)',
            outline: 'none',
          }}
        >
          {DISCOUNT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          max={discount.tipo === 'percent' ? 100 : undefined}
          step={discount.tipo === 'percent' ? '0.01' : '0.01'}
          disabled={isDisabled}
          value={isDisabled ? '' : discount.valor}
          onChange={(e) => onValueChange(Number(e.target.value) || 0)}
          placeholder={discount.tipo === 'percent' ? '0,00%' : '0,00'}
          style={{
            width: '100%',
            backgroundColor: isDisabled ? 'var(--color-surface-container-lowest)' : 'var(--color-surface)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            color: 'var(--color-on-surface)',
            outline: 'none',
            opacity: isDisabled ? 0.7 : 1,
          }}
        />
      </div>
      {appliedAmount > 0 && (
        <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
          Desconto aplicado: {formatCurrency(appliedAmount)}
        </span>
      )}
    </div>
  );
}

function SearchSelector({ 
  label, 
  placeholder, 
  items, 
  onSelect, 
  selectedId 
}: { 
  label: string, 
  placeholder: string, 
  items: SearchItem[],
  onSelect: (id: string) => void,
  selectedId: string
}) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return items.slice(0, 10);
    const q = query.toLowerCase();
    return items.filter(item => item.search.toLowerCase().includes(q)).slice(0, 15);
  }, [items, query]);

  const selectedItem = items.find(i => i.id === selectedId);

  return (
    <div className={styles.searchSelector} style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', position: 'relative' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <div 
        className={styles.searchSelectorField}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
          backgroundColor: isFocused ? 'var(--color-surface)' : 'var(--color-surface-container-lowest)',
          border: `1px solid ${isFocused ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
          borderRadius: '8px', cursor: 'text', transition: 'all 0.2s',
          boxShadow: isFocused ? '0 0 0 2px rgba(var(--color-primary-rgb, 0,102,255), 0.1)' : 'none'
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedItem && !query && (
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            color: '#ffffff', 
            backgroundColor: 'var(--color-primary)', 
            padding: '2px 8px', 
            borderRadius: '4px',
            lineHeight: '1.2'
          }}>
            {selectedItem.code}
          </span>
        )}
        <input 
          ref={inputRef}
          type="text"
          className={styles.searchSelectorInput}
          style={{ flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', fontSize: '14px', color: 'var(--color-on-surface)' }}
          placeholder={selectedItem ? selectedItem.name : placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-outline)' }}>search</span>
      </div>

      {isFocused && (
        <div className={styles.searchSelectorDropdown} style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
          borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50,
          maxHeight: '200px', overflowY: 'auto'
        }}>
          {filtered.map(item => (
            <div 
              key={item.id}
              className={styles.searchSelectorOption}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
                cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid var(--color-surface-container-lowest)',
                backgroundColor: selectedId === item.id ? 'var(--color-primary-container, #eef2ff)' : 'transparent',
                color: selectedId === item.id ? 'var(--color-primary)' : 'var(--color-on-surface)',
              }}
              onClick={() => {
                onSelect(item.id);
                setQuery('');
                setIsFocused(false);
              }}
              onMouseEnter={(e) => {
                if (selectedId !== item.id) e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
              }}
              onMouseLeave={(e) => {
                if (selectedId !== item.id) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-outline)', width: '48px' }}>{item.code}</span>
              <span style={{ fontWeight: 500 }}>{item.name}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--color-outline)', textAlign: 'center' }}>Nenhum resultado encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PedidoFormModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  clientes, 
  produtos, 
  vendedores,
  pedidoToEdit
}: Props) {
  const isEditMode = !!pedidoToEdit;
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [selectedVendedorId, setSelectedVendedorId] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'dinheiro' | 'pix' | 'cartao'>('pix');
  const [observacoes, setObservacoes] = useState('');
  
  const [cart, setCart] = useState<CartItemState[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<DiscountState>({ tipo: 'none', valor: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Agendamento
  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(false);
  const [agendamentoDate, setAgendamentoDate] = useState('');
  const [agendamentoTime, setAgendamentoTime] = useState('');

  // Pré-preenche o formulário quando um pedido for passado para edição
  useEffect(() => {
    if (isOpen && pedidoToEdit) {
      setSelectedClienteId(pedidoToEdit.cliente_id || '');
      setSelectedVendedorId(pedidoToEdit.vendedor_id || '');
      setFormaPagamento((pedidoToEdit.forma_pagamento as any) || 'pix');
      setObservacoes(pedidoToEdit.observacoes || '');
      const itensCart: CartItemState[] = (pedidoToEdit.itens || []).map(item => ({
        produtoId: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        tipo: (item.desconto_tipo || 'none') as TipoDesconto,
        valor: Number(item.desconto_valor) || 0,
      }));
      setCart(itensCart);
      setOrderDiscount({
        tipo: (pedidoToEdit.desconto_tipo || 'none') as TipoDesconto,
        valor: Number(pedidoToEdit.desconto_valor) || 0,
      });
    } else if (isOpen && !pedidoToEdit) {
      // Resetar ao abrir em modo criação
      setSelectedClienteId('');
      setSelectedVendedorId('');
      setFormaPagamento('pix');
      setObservacoes('');
      setCart([]);
      setOrderDiscount({ tipo: 'none', valor: 0 });
      setProductSearch('');
    }
  }, [isOpen, pedidoToEdit]);

  const cartSummary = useMemo(() => {
    return cart.reduce((acc, item) => {
      const subtotalBrutoItem = roundCurrency(item.quantidade * item.preco_unitario);
      const descontoAplicadoItem = calculateDiscountAmount(subtotalBrutoItem, item.tipo, item.valor, item.quantidade);
      const subtotalLiquidoItem = roundCurrency(subtotalBrutoItem - descontoAplicadoItem);

      acc.subtotalBruto += subtotalBrutoItem;
      acc.descontoItens += descontoAplicadoItem;
      acc.subtotalLiquido += subtotalLiquidoItem;
      return acc;
    }, { subtotalBruto: 0, descontoItens: 0, subtotalLiquido: 0 });
  }, [cart]);

  const descontoPedidoAplicado = useMemo(
    () => calculateDiscountAmount(cartSummary.subtotalLiquido, orderDiscount.tipo, orderDiscount.valor),
    [cartSummary.subtotalLiquido, orderDiscount.tipo, orderDiscount.valor]
  );

  const total = roundCurrency(cartSummary.subtotalLiquido - descontoPedidoAplicado);

  const clientesSearchItems = useMemo(() => clientes.map(c => ({
    id: c.id,
    display: `[${c.codigo_cliente?.toString().padStart(5, '0')}] ${c.nome}`,
    search: `${c.id} ${c.codigo_cliente} ${c.nome}`,
    code: c.codigo_cliente?.toString().padStart(5, '0') || '00000',
    name: c.nome
  })), [clientes]);

  const vendedoresSearchItems = useMemo(() => vendedores.map(v => ({
    id: v.id,
    display: `[${v.codigo_vendedor?.toString().padStart(3, '0')}] ${v.nome}`,
    search: `${v.id} ${v.codigo_vendedor} ${v.nome}`,
    code: v.codigo_vendedor?.toString().padStart(3, '0') || '000',
    name: v.nome
  })), [vendedores]);

  const addToCart = (produto: Produto) => {
    const existing = cart.find(c => c.produtoId === produto.id);
    if (existing) {
      updateQuantity(produto.id, existing.quantidade + 1);
    } else {
      const disponivel = (produto.estoque_atual || 0) - (produto.estoque_reservado || 0);
      if (disponivel <= 0) {
        toast.error('Produto sem estoque disponível!');
        return;
      }
      setCart([...cart, { produtoId: produto.id, quantidade: 1, preco_unitario: produto.preco_venda, tipo: 'none', valor: 0 }]);
    }
  };

  const removeFromCart = (produtoId: string) => {
    setCart(cart.filter(c => c.produtoId !== produtoId));
  };

  const updateQuantity = (produtoId: string, qta: number) => {
    if (qta <= 0) return removeFromCart(produtoId);
    
    const produto = produtos.find(p => p.id === produtoId);
    const disponivel = (produto?.estoque_atual || 0) - (produto?.estoque_reservado || 0);
    
    if (qta > disponivel) {
      toast.error(`Estoque insuficiente! Disponível: ${disponivel}`);
      return;
    }

    setCart(cart.map(c => c.produtoId === produtoId ? { ...c, quantidade: qta } : c));
  };

  const updateItemDiscountType = (produtoId: string, tipo: TipoDesconto) => {
    setCart(cart.map(item => item.produtoId === produtoId ? { ...item, tipo, valor: tipo === 'none' ? 0 : item.valor } : item));
  };

  const updateItemDiscountValue = (produtoId: string, valor: number) => {
    setCart(cart.map(item => item.produtoId === produtoId ? { ...item, valor: Math.max(0, valor) } : item));
  };

  const updateOrderDiscountType = (tipo: TipoDesconto) => {
    setOrderDiscount(current => ({ tipo, valor: tipo === 'none' ? 0 : current.valor }));
  };

  const updateOrderDiscountValue = (valor: number) => {
    setOrderDiscount(current => ({ ...current, valor: Math.max(0, valor) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !selectedVendedorId || cart.length === 0) {
      toast.error('Preencha cliente, vendedor e adicione itens.');
      return;
    }

    const clienteSelecionado = clientes.find(c => c.id === selectedClienteId);
    const vendedorSelecionado = vendedores.find(v => v.id === selectedVendedorId);

    setIsSubmitting(true);
    try {
      const pedidoMeta = {
        cliente_id: selectedClienteId,
        vendedor_id: selectedVendedorId,
        valor_total: total,
        desconto_tipo: orderDiscount.tipo,
        desconto_valor: orderDiscount.valor,
        desconto_aplicado: descontoPedidoAplicado,
        forma_pagamento: formaPagamento,
        observacoes,
        nome_cliente: clienteSelecionado?.nome,
        telefone_cliente: clienteSelecionado?.telefone,
        endereco_entrega: clienteSelecionado?.endereco,
        bairro: clienteSelecionado?.bairro,
        cidade: clienteSelecionado?.cidade,
        estado: clienteSelecionado?.estado,
        cep: clienteSelecionado?.cep,
        complemento: clienteSelecionado?.numero,
        nome_vendedor: vendedorSelecionado?.nome,
        codigo_vendedor: vendedorSelecionado?.codigo_vendedor || 0
      };

      const itensData = cart.map(item => {
        const subtotalBrutoItem = roundCurrency(item.quantidade * item.preco_unitario);
        const descontoAplicadoItem = calculateDiscountAmount(subtotalBrutoItem, item.tipo, item.valor, item.quantidade);

        return {
          produto_id: item.produtoId,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          desconto_tipo: item.tipo,
          desconto_valor: item.valor,
          desconto_aplicado: descontoAplicadoItem,
          subtotal: roundCurrency(subtotalBrutoItem - descontoAplicadoItem)
        };
      });

      if (isEditMode && pedidoToEdit) {
        await updatePedidoAction(pedidoToEdit.id, pedidoMeta, itensData as any);
        toast.success('Pedido atualizado com sucesso!');
      } else {
        await savePedido({ ...pedidoMeta, status_pedido: 'aguardando_preparacao' } as any, itensData as any);
        toast.success('Pedido registrado com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar o pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgendar = async () => {
    if (!selectedClienteId || !selectedVendedorId || cart.length === 0) {
      toast.error('Preencha cliente, vendedor e adicione itens.');
      return;
    }
    if (!agendamentoDate || !agendamentoTime) {
      toast.error('Informe a data e o horário do agendamento.');
      return;
    }

    const clienteSelecionado = clientes.find(c => c.id === selectedClienteId);
    const vendedorSelecionado = vendedores.find(v => v.id === selectedVendedorId);

    setIsSubmitting(true);
    try {
      const dataIso = new Date(`${agendamentoDate}T${agendamentoTime}:00`).toISOString();
      const agendamentoMeta = {
        data_agendamento: dataIso,
        cliente_id: selectedClienteId,
        vendedor_id: selectedVendedorId,
        valor_total: total,
        desconto_tipo: orderDiscount.tipo,
        desconto_valor: orderDiscount.valor,
        desconto_aplicado: descontoPedidoAplicado,
        forma_pagamento: formaPagamento,
        observacoes,
        nome_cliente: clienteSelecionado?.nome,
        telefone_cliente: clienteSelecionado?.telefone,
        endereco_entrega: clienteSelecionado?.endereco,
        bairro: clienteSelecionado?.bairro,
        cidade: clienteSelecionado?.cidade,
        estado: clienteSelecionado?.estado,
        cep: clienteSelecionado?.cep,
        nome_vendedor: vendedorSelecionado?.nome,
        codigo_vendedor: vendedorSelecionado?.codigo_vendedor || 0
      };

      const itensData = cart.map(item => {
        const subtotalBrutoItem = roundCurrency(item.quantidade * item.preco_unitario);
        const descontoAplicadoItem = calculateDiscountAmount(subtotalBrutoItem, item.tipo, item.valor, item.quantidade);

        return {
          produto_id: item.produtoId,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          desconto_tipo: item.tipo,
          desconto_valor: item.valor,
          desconto_aplicado: descontoAplicadoItem,
          subtotal: roundCurrency(subtotalBrutoItem - descontoAplicadoItem)
        };
      });

      await criarAgendamentoAction(agendamentoMeta, itensData);

      toast.success('Agendamento criado com sucesso!');
      setIsAgendamentoOpen(false);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar agendamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ fontFamily: 'var(--font-sans)' }}>
      <div 
        className={`modal-content ${styles.modalContent}`}
        style={{ maxWidth: '1200px', border: '1px solid var(--color-outline-variant)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader} style={{
          padding: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--color-outline-variant, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-surface, #fff)'
        }}>
          <div className={styles.modalHeaderIntro} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: isEditMode ? '#f59e0b' : 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff'
            }}>
              <span className="material-symbols-outlined">{isEditMode ? 'edit' : 'add_shopping_cart'}</span>
            </div>
            <div className={styles.modalHeaderText}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-on-surface)', margin: 0 }}>
                {isEditMode ? `Editar Pedido #${pedidoToEdit?.numero_pedido}` : 'Novo Pedido de Venda'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-outline)', margin: '4px 0 0 0' }}>
                {isEditMode ? 'Altere os itens ou dados do pedido. O estoque será ajustado automaticamente.' : 'Preencha os dados abaixo e adicione itens ao pedido'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={styles.modalClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px', color: 'var(--color-outline)'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-highest, #f1f5f9)'; e.currentTarget.style.color = 'var(--color-on-surface)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-outline)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Top Section - Filters */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr)', gap: '24px',
            padding: '24px', borderBottom: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface-container-lowest, #fafafa)'
          }} className={`pedido-form-header ${styles.topSection}`}>
            <div>
              <SearchSelector 
                label="Cliente / Comprador"
                placeholder="Buscar Cliente..."
                items={clientesSearchItems}
                selectedId={selectedClienteId}
                onSelect={setSelectedClienteId}
              />
            </div>
            <div>
              <SearchSelector 
                label="Vendedor Responsável"
                placeholder="Buscar Vendedor..."
                items={vendedoresSearchItems}
                selectedId={selectedVendedorId}
                onSelect={setSelectedVendedorId}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Forma de Pagamento
              </label>
              <div className={styles.paymentGrid} style={{ display: 'flex', gap: '8px' }}>
                {['PIX', 'DINHEIRO', 'CARTAO'].map(type => {
                  const isSelected = formaPagamento === type.toLowerCase();
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormaPagamento(type.toLowerCase() as any)}
                      className={styles.paymentButton}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: isSelected ? '#ffffff' : 'var(--color-on-surface)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {type === 'PIX' && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>qr_code</span>}
                      {type === 'DINHEIRO' && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>payments</span>}
                      {type === 'CARTAO' && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>credit_card</span>}
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.body} style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'row' }}>
            {/* Left Box: Catalog */}
            <div className={styles.catalogPane} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-outline-variant)', minWidth: 0 }}>
              <div className={styles.catalogToolbar} style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-surface)' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>Catálogo de Produtos</span>
                <div className={styles.catalogSearch} style={{ position: 'relative', width: '250px' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--color-outline)' }}>search</span>
                  <input 
                    type="text" 
                    placeholder="Filtrar Produtos..." 
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className={styles.catalogSearchInput}
                    style={{
                      width: '100%', padding: '8px 12px 8px 36px',
                      backgroundColor: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
                      borderRadius: '8px', fontSize: '13px', color: 'var(--color-on-surface)', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div className={styles.catalogList} style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: 'var(--color-surface-container-lowest)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Header da Lista */}
                  <div className={styles.productTableHead} style={{ display: 'flex', padding: '8px 16px', borderBottom: '2px solid var(--color-surface-container)', fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', gap: '16px' }}>
                    <div style={{ width: '80px', flexShrink: 0 }}>Código</div>
                    <div style={{ flex: 1, minWidth: 0 }}>Descrição do Produto</div>
                    <div style={{ width: '80px', textAlign: 'right', flexShrink: 0 }}>Preço</div>
                    <div style={{ width: '60px', textAlign: 'right', flexShrink: 0 }}>Físico</div>
                    <div style={{ width: '60px', textAlign: 'right', flexShrink: 0 }}>Pedidos</div>
                    <div style={{ width: '70px', textAlign: 'right', flexShrink: 0, color: 'var(--color-primary)' }}>Disp.</div>
                    <div style={{ width: '40px', flexShrink: 0 }}></div>
                  </div>

                  {produtos
                    .filter(p => !productSearch || 
                      p.nome_produto.toLowerCase().includes(productSearch.toLowerCase()) || 
                      p.categoria.toLowerCase().includes(productSearch.toLowerCase()) ||
                      p.codigo_produto?.toString().includes(productSearch)
                    )
                    .map(p => {
                      const disponivel = (p.estoque_atual || 0) - (p.estoque_reservado || 0);
                      const isOutOfStock = disponivel <= 0;
                      return (
                        <div 
                          key={p.id}
                          onClick={() => !isOutOfStock && addToCart(p)}
                          className={styles.productRow}
                          style={{
                            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
                            borderRadius: '10px', padding: '10px 16px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px',
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer', opacity: isOutOfStock ? 0.6 : 1,
                            transition: 'all 0.2s',
                            minWidth: 0
                          }}
                          onMouseEnter={e => {
                            if (!isOutOfStock) {
                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                              e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                          }}
                        >
                          <div className={styles.productCode} style={{ width: '80px', fontSize: '13px', fontWeight: 500, color: 'var(--color-outline)', flexShrink: 0 }}>
                            {p.codigo_produto || '-'}
                          </div>
                          <div className={styles.productInfo} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <h3 className={styles.productName} title={p.nome_produto} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.nome_produto}
                            </h3>
                            <span className={styles.productCategory} style={{ fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              • {p.categoria}
                            </span>
                          </div>
                          <div className={styles.productPrice} style={{ width: '80px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)', flexShrink: 0 }}>
                            {formatCurrency(p.preco_venda)}
                          </div>
                          <div className={styles.productStock} style={{ width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: 'var(--color-outline)', flexShrink: 0 }}>
                            {p.estoque_atual}
                          </div>
                          <div className={styles.productReserved} style={{ width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: 'var(--color-outline)', flexShrink: 0 }}>
                            {p.estoque_reservado || 0}
                          </div>
                          <div className={styles.productAvailable} style={{ width: '70px', textAlign: 'right', fontSize: '14px', fontWeight: 800, color: isOutOfStock ? 'var(--color-error)' : 'var(--color-primary)', flexShrink: 0 }}>
                            {disponivel <= 0 ? '0' : disponivel}
                          </div>
                          <div className={styles.productAction} style={{ width: '40px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <button 
                              type="button" 
                              style={{
                                padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: isOutOfStock ? 'var(--color-surface-container)' : 'var(--color-primary)',
                                color: isOutOfStock ? 'var(--color-outline)' : '#ffffff', border: 'none'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Right Box: Cart */}
            <div className={styles.cartPane} style={{ width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-surface)', minWidth: 0 }}>
              <div className={styles.cartToolbar} style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-surface)' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>shopping_bag</span>
                  Itens do Pedido
                </span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface)', backgroundColor: 'var(--color-surface-container)', padding: '4px 10px', borderRadius: '16px' }}>
                  {cart.length} itens
                </span>
              </div>
              
              <div className={styles.cartBody} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {cart.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--color-surface-container)', color: 'var(--color-outline)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>shopping_cart</span>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface)', margin: '0 0 4px 0' }}>Seu carrinho está vazio</p>
                    <p style={{ fontSize: '12px', color: 'var(--color-outline)', margin: 0 }}>Adicione produtos pelo catálogo ao lado</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cart.map(item => {
                      const p = produtos.find(prod => prod.id === item.produtoId);
                      const subtotalBrutoItem = roundCurrency(item.quantidade * item.preco_unitario);
                      const descontoAplicadoItem = calculateDiscountAmount(subtotalBrutoItem, item.tipo, item.valor, item.quantidade);
                      const subtotalLiquidoItem = roundCurrency(subtotalBrutoItem - descontoAplicadoItem);
                      return (
                        <div key={item.produtoId} className={styles.cartItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '12px', minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                            <span title={p?.nome_produto} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)', lineHeight: 1.3, flex: 1, minWidth: 0 }}>{p?.nome_produto}</span>
                            <button 
                              type="button" 
                              onClick={() => removeFromCart(item.produtoId)}
                              style={{ color: 'var(--color-outline)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px', flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-error-container)'; e.currentTarget.style.color = 'var(--color-error)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-outline)'; }}
                              title="Remover Item"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                            </button>
                          </div>

                          <DiscountControls
                            label="Desconto do item"
                            discount={{ tipo: item.tipo, valor: item.valor }}
                            appliedAmount={descontoAplicadoItem}
                            onTypeChange={(tipo) => updateItemDiscountType(item.produtoId, tipo)}
                            onValueChange={(valor) => updateItemDiscountValue(item.produtoId, valor)}
                          />
                          
                          <div className={styles.cartItemFooter} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--color-surface-container)' }}>
                            <div className={styles.qtyControl} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: '8px', padding: '4px', flexShrink: 0 }}>
                              <button 
                                type="button" 
                                onClick={() => updateQuantity(item.produtoId, item.quantidade - 1)}
                                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '4px', fontSize: '18px', fontWeight: 500, cursor: 'pointer' }}
                              >
                                -
                              </button>
                              <input 
                                type="number" 
                                value={item.quantidade} 
                                onChange={(e) => updateQuantity(item.produtoId, parseInt(e.target.value) || 0)}
                                className={styles.qtyInput}
                                style={{ width: '35px', textAlign: 'center', fontSize: '14px', fontWeight: 600, backgroundColor: 'transparent', border: 'none', outline: 'none', color: 'var(--color-on-surface)' }}
                              />
                              <button 
                                type="button" 
                                onClick={() => updateQuantity(item.produtoId, item.quantidade + 1)}
                                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '4px', fontSize: '18px', fontWeight: 500, cursor: 'pointer' }}
                              >
                                +
                              </button>
                            </div>
                            
                            <div className={styles.cartItemTotals} style={{ textAlign: 'right', minWidth: 0 }}>
                              <span style={{ fontSize: '11px', color: 'var(--color-outline)', display: 'block', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(item.preco_unitario)} cada</span>
                              {descontoAplicadoItem > 0 && (
                                <span style={{ fontSize: '11px', color: 'var(--color-outline)', display: 'block', textDecoration: 'line-through' }}>
                                  {formatCurrency(subtotalBrutoItem)}
                                </span>
                              )}
                              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)', whiteSpace: 'nowrap' }}>{formatCurrency(subtotalLiquidoItem)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order total & submission */}
              <div className={styles.summaryPane} style={{ padding: '24px', borderTop: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-lowest)' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Observações (Opcional)</label>
                  <textarea 
                    className={styles.observationsField}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Instruções para entrega, detalhes..."
                    style={{
                      width: '100%', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
                      borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--color-on-surface)',
                      outline: 'none', resize: 'none', height: '64px',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--color-outline-variant)'}
                  />
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <DiscountControls
                    label="Desconto no pedido inteiro"
                    discount={orderDiscount}
                    appliedAmount={descontoPedidoAplicado}
                    onTypeChange={updateOrderDiscountType}
                    onValueChange={updateOrderDiscountValue}
                  />
                </div>

                <div className={styles.totalCard} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-outline)' }}>
                    <span>Subtotal bruto</span>
                    <span>{formatCurrency(cartSummary.subtotalBruto)}</span>
                  </div>
                  {cartSummary.descontoItens > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-primary)' }}>
                      <span>Desconto nos itens</span>
                      <span>- {formatCurrency(cartSummary.descontoItens)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-outline)' }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartSummary.subtotalLiquido)}</span>
                  </div>
                  {descontoPedidoAplicado > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-primary)' }}>
                      <span>Desconto no pedido</span>
                      <span>- {formatCurrency(descontoPedidoAplicado)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', marginTop: '4px', borderTop: '1px solid var(--color-surface-container)' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>Total do Pedido</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting || cart.length === 0}
                  className={styles.submitButton}
                  style={{
                    width: '100%', padding: '14px 16px',
                    backgroundColor: (isSubmitting || cart.length === 0) ? 'var(--color-outline-variant)' : isEditMode ? '#f59e0b' : 'var(--color-primary)',
                    color: '#ffffff', fontSize: '14px', fontWeight: 700, borderRadius: '8px', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    cursor: (isSubmitting || cart.length === 0) ? 'not-allowed' : 'pointer', border: 'none'
                  }}
                  onMouseEnter={e => { if (!isSubmitting && cart.length > 0) e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {isSubmitting ? (
                    'Processando...'
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{isEditMode ? 'save' : 'check_circle'}</span>
                      {isEditMode ? 'Salvar Alterações' : 'Confirmar Pedido'}
                    </>
                  )}
                </button>
                
                {!isEditMode && (
                  <button 
                    type="button" 
                    onClick={() => setIsAgendamentoOpen(true)}
                    disabled={isSubmitting || cart.length === 0}
                    style={{
                      width: '100%', padding: '14px 16px', marginTop: '12px',
                      backgroundColor: 'transparent',
                      color: (isSubmitting || cart.length === 0) ? 'var(--color-outline-variant)' : 'var(--color-primary)', 
                      fontSize: '14px', fontWeight: 700, borderRadius: '8px', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      cursor: (isSubmitting || cart.length === 0) ? 'not-allowed' : 'pointer', 
                      border: `1px solid ${(isSubmitting || cart.length === 0) ? 'var(--color-outline-variant)' : 'var(--color-primary)'}`
                    }}
                    onMouseEnter={e => { if (!isSubmitting && cart.length > 0) e.currentTarget.style.backgroundColor = 'var(--color-primary-container)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>event</span>
                    Agendar Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {isAgendamentoOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800 }}>Confirmar Agendamento</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '8px' }}>Data da Entrega</label>
              <input 
                type="date" 
                value={agendamentoDate}
                onChange={e => setAgendamentoDate(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-outline)', marginBottom: '8px' }}>Horário (Aproximado)</label>
              <input 
                type="time" 
                value={agendamentoTime}
                onChange={e => setAgendamentoTime(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setIsAgendamentoOpen(false)}
                style={{ flex: 1, padding: '10px', border: '1px solid var(--color-outline-variant)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleAgendar}
                disabled={isSubmitting || !agendamentoDate || !agendamentoTime}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: 'var(--color-primary)', color: 'white', cursor: (isSubmitting || !agendamentoDate || !agendamentoTime) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (isSubmitting || !agendamentoDate || !agendamentoTime) ? 0.7 : 1 }}
              >
                {isSubmitting ? 'Salvando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
