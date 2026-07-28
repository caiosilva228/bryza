'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Produto } from '@/models/types';
import { getStoreProductsAction, getStoreUserInfoAction, createStoreOrderAction, StoreCartItem } from './actions';
import { toast } from 'sonner';

export default function LojaVirtualPage() {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [categoriaSel, setCategoriaSel] = useState<string>('Todos');
  const [precoFilter, setPrecoFilter] = useState<'todos' | 'ate30' | '30a60' | 'acima60'>('todos');
  const [apenasEstoque, setApenasEstoque] = useState(false);
  const [sortOrder, setSortOrder] = useState<'destaque' | 'menor_preco' | 'maior_preco' | 'nome'>('destaque');
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  // Dados do Usuário / Embaixador
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Campos do Checkout
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Brasília');
  const [state, setState] = useState('DF');
  const [cep, setCep] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [period, setPeriod] = useState('manhademanha');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [notes, setNotes] = useState('');

  // Modais & Steps
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [step, setStep] = useState<'carrinho' | 'checkout' | 'sucesso'>('carrinho');
  const [submitting, setSubmitting] = useState(false);
  const [showHelpTooltip, setShowHelpTooltip] = useState(true);
  const [detailProduct, setDetailProduct] = useState<Produto | null>(null);

  // Resultado do Pedido
  const [lastOrder, setLastOrder] = useState<{ number: string; whatsappUrl: string } | null>(null);

  // Próximos 5 dias corridos
  const getNext5Days = () => {
    const days: { value: string; label: string }[] = [];
    const now = new Date();
    const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    for (let i = 1; i <= 5; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const displayFormatted = `${dd}/${mm}/${yyyy}`;
      const dayName = weekDays[d.getDay()];

      let relStr = dayName;
      if (i === 1) relStr = `Amanhã (${dayName})`;

      days.push({
        value: dateStr,
        label: `${displayFormatted} — ${relStr}`,
      });
    }
    return days;
  };

  const nextDaysOptions = useMemo(() => getNext5Days(), []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [resProd, resUser] = await Promise.all([
        getStoreProductsAction(),
        getStoreUserInfoAction()
      ]);

      if (resProd.success && resProd.produtos) {
        setProdutos(resProd.produtos);
      } else {
        toast.error(resProd.error || 'Erro ao carregar produtos.');
      }

      if (resUser.isLoggedIn && resUser.userData) {
        setIsLoggedIn(true);
        setUserData(resUser.userData);
        setClientName(resUser.userData.full_name || '');
        setClientPhone(resUser.userData.phone || '');
        setAddress(resUser.userData.address || '');
        setNumber(resUser.userData.number || '');
        setNeighborhood(resUser.userData.neighborhood || '');
        setCity(resUser.userData.city || 'Brasília');
        setState(resUser.userData.state || 'DF');
        setCep(resUser.userData.cep || '');
      }

      if (nextDaysOptions.length > 0) {
        setScheduledDate(nextDaysOptions[0].value);
      }

      setLoading(false);
    }

    loadData();
  }, [nextDaysOptions]);

  // 1. Carregar carrinho salvo no localStorage ao montar a página
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bryza_store_cart');
      if (saved) {
        const entries: [string, number][] = JSON.parse(saved);
        if (Array.isArray(entries) && entries.length > 0) {
          setCart(new Map(entries));
        }
      }
    } catch (e) {
      console.error('Erro ao carregar carrinho do localStorage:', e);
    }
  }, []);

  // 2. Salvar atualizações do carrinho no localStorage
  useEffect(() => {
    try {
      if (cart.size > 0) {
        localStorage.setItem('bryza_store_cart', JSON.stringify(Array.from(cart.entries())));
      } else {
        localStorage.removeItem('bryza_store_cart');
      }
    } catch (e) {
      console.error('Erro ao salvar carrinho no localStorage:', e);
    }
  }, [cart]);

  // Lista de Categorias com contagem de produtos
  const categoriaStats = useMemo(() => {
    const map = new Map<string, number>();
    produtos.forEach(p => {
      const set = new Set<string>();
      if (p.categoria) set.add(p.categoria);
      if (p.categorias_adicionais && Array.isArray(p.categorias_adicionais)) {
        p.categorias_adicionais.forEach(c => { if (c) set.add(c); });
      }
      set.forEach(cat => {
        map.set(cat, (map.get(cat) || 0) + 1);
      });
    });
    return map;
  }, [produtos]);

  const categorias = useMemo(() => {
    return ['Todos', ...Array.from(categoriaStats.keys())];
  }, [categoriaStats]);

  // Produtos Filtrados e Ordenados (Sem duplicação em 'Todos')
  const produtosFiltrados = useMemo(() => {
    let list = produtos.filter(p => {
      const matchesSearch = p.nome_produto.toLowerCase().includes(search.toLowerCase());
      
      const matchesCat = categoriaSel === 'Todos' || 
        p.categoria === categoriaSel || 
        (p.categorias_adicionais && Array.isArray(p.categorias_adicionais) && p.categorias_adicionais.includes(categoriaSel));

      const matchesEstoque = !apenasEstoque || p.estoque_atual > 0;

      let matchesPreco = true;
      if (precoFilter === 'ate30') matchesPreco = p.preco_venda <= 30;
      else if (precoFilter === '30a60') matchesPreco = p.preco_venda > 30 && p.preco_venda <= 60;
      else if (precoFilter === 'acima60') matchesPreco = p.preco_venda > 60;

      return matchesSearch && matchesCat && matchesEstoque && matchesPreco;
    });

    if (sortOrder === 'menor_preco') {
      list.sort((a, b) => a.preco_venda - b.preco_venda);
    } else if (sortOrder === 'maior_preco') {
      list.sort((a, b) => b.preco_venda - a.preco_venda);
    } else if (sortOrder === 'nome') {
      list.sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
    }

    return list;
  }, [produtos, search, categoriaSel, apenasEstoque, precoFilter, sortOrder]);

  const clearFilters = () => {
    setSearch('');
    setCategoriaSel('Todos');
    setPrecoFilter('todos');
    setApenasEstoque(false);
    setSortOrder('destaque');
  };

  // Controles do Carrinho
  const updateQuantity = (produtoId: string, delta: number) => {
    setCart(prev => {
      const next = new Map(prev);
      const current = next.get(produtoId) || 0;
      const updated = current + delta;
      if (updated <= 0) {
        next.delete(produtoId);
      } else {
        next.set(produtoId, updated);
      }
      return next;
    });
  };

  const removeFromCart = (produtoId: string) => {
    setCart(prev => {
      const next = new Map(prev);
      next.delete(produtoId);
      return next;
    });
  };

  const setDirectQuantity = (produtoId: string, quantity: number) => {
    setCart(prev => {
      const next = new Map(prev);
      if (quantity <= 0) {
        next.delete(produtoId);
      } else {
        next.set(produtoId, quantity);
      }
      return next;
    });
  };

  const cartItemsDetailed: StoreCartItem[] = useMemo(() => {
    const items: StoreCartItem[] = [];
    cart.forEach((qty, id) => {
      const prod = produtos.find(p => p.id === id);
      if (prod && qty > 0) {
        items.push({ produto: prod, quantidade: qty });
      }
    });
    return items;
  }, [cart, produtos]);

  const totalCartCount = useMemo(() => {
    let sum = 0;
    cart.forEach(qty => { sum += qty; });
    return sum;
  }, [cart]);

  const totalCartValue = useMemo(() => {
    return cartItemsDetailed.reduce((acc, item) => acc + (item.produto.preco_venda * item.quantidade), 0);
  }, [cartItemsDetailed]);

  // Finalizar Pedido
  const handleFinalizeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItemsDetailed.length === 0) {
      toast.error('O seu carrinho está vazio.');
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error('Informe seu Nome Completo e Telefone / WhatsApp.');
      return;
    }
    if (!address.trim() || !neighborhood.trim() || !city.trim()) {
      toast.error('Preencha o endereço completo para entrega.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        clientName,
        clientPhone,
        address,
        number,
        neighborhood,
        city,
        state,
        cep,
        scheduledDate,
        period,
        paymentMethod,
        notes,
        items: cartItemsDetailed.map(item => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco_venda,
        }))
      };

      const res = await createStoreOrderAction(payload);

      if (res.success && res.orderNumber && res.whatsappUrl) {
        setLastOrder({
          number: res.orderNumber,
          whatsappUrl: res.whatsappUrl,
        });
        setStep('sucesso');
        setCart(new Map());
        toast.success('Pedido realizado com sucesso!');
      } else {
        toast.error(res.error || 'Não foi possível finalizar o pedido.');
      }
    } catch (err: any) {
      toast.error('Erro ao conectar com o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc', 
      fontFamily: 'Inter, Arial, sans-serif',
      color: '#273244',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* 1. Header do Site (Design Limpo: Logo + Perfil + Ícone de Carrinho) */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px'
        }}>
          {/* Logo Oficial da Bryza */}
          <a href="/loja" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img 
              src="/Logo Bryza.svg" 
              alt="Bryza - O perfume que envolve a Paranoá" 
              style={{ height: '44px', objectFit: 'contain' }} 
            />
          </a>

          {/* Lado Direito: Botão Espaço do Embaixador & Ícone do Carrinho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            
            <a 
              href="/embaixador/dashboard" 
              style={{
                border: '1.5px solid #051329',
                color: '#051329',
                backgroundColor: 'transparent',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13.5px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_circle</span>
              <span>{isLoggedIn ? (userData?.full_name?.split(' ')[0] || 'Meu Painel') : 'Espaço do Embaixador'}</span>
            </a>

            {/* Botão de Carrinho: Apenas Ícone com Badge Superior quando > 0 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setIsCartOpen(true); setStep('carrinho'); }}
                title="Ver Carrinho"
                style={{
                  backgroundColor: '#AEDB45',
                  color: '#051329',
                  border: 'none',
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 18px rgba(174,219,69,0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#9cb82d';
                  e.currentTarget.style.transform = 'scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#AEDB45';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>shopping_cart</span>
              </button>

              {/* Badge de quantidade em cima do carrinho quando houver itens */}
              {totalCartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#051329',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  minWidth: '20px',
                  height: '20px',
                  borderRadius: '99px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  pointerEvents: 'none'
                }}>
                  {totalCartCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Red Announcement Bar (Aviso de Área de Atuação - Bryza.com.br) */}
      <div style={{
        backgroundColor: '#dc2626',
        color: '#ffffff',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.01em',
        boxShadow: '0 2px 6px rgba(220,38,38,0.2)'
      }}>
        ⚠️ <strong>Atenção:</strong> por enquanto nossa área de atuação é apenas entorno sul de Brasília: Cidade Ocidental, Valparaíso de Goiás, Novo Gama e Luziânia.
      </div>

      {/* 3. Sub-header Claro de Pesquisa & Boas-Vindas (Substituído fundo escuro por claro) */}
      <div style={{
        backgroundColor: '#ffffff',
        color: '#051329',
        padding: '24px',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#051329' }}>
              Produtos Direto da Fábrica
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13.5px' }}>
              Fórmulas concentradas, rendimento superior e perfume prolongado para suas roupas e casa.
            </p>
          </div>

          {/* Campo de Busca Rápida (Fundo Claro) */}
          <div style={{ flex: 1, maxWidth: '420px', minWidth: '240px', position: 'relative' }}>
            <span className="material-symbols-outlined" style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b',
              fontSize: '18px'
            }}>search</span>
            <input 
              type="text" 
              placeholder="O que você está procurando hoje?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                fontSize: '14px',
                color: '#051329',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Área Principal do E-Commerce (Sidebar + Grid de Produtos) */}
      <main id="catalogo" style={{ maxWidth: '1280px', margin: '32px auto', padding: '0 24px', flex: 1, width: '100%' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* SIDEBAR DE FILTROS E-COMMERCE */}
          <aside style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e7ef',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#051329', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#5a8216' }}>filter_alt</span>
                Filtros
              </h3>
              {(categoriaSel !== 'Todos' || precoFilter !== 'todos' || apenasEstoque || search !== '') && (
                <button 
                  onClick={clearFilters}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filtro: Categorias com Estilo Claro quando Selecionado */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#051329', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Categorias</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {categorias.map(cat => {
                  const isSelected = categoriaSel === cat;
                  const count = cat === 'Todos' ? produtos.length : (categoriaStats.get(cat) || 0);
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoriaSel(cat)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid #0b5ea8' : 'none',
                        backgroundColor: isSelected ? '#f0f6fc' : 'transparent',
                        color: isSelected ? '#0b5ea8' : '#475569',
                        fontSize: '13px',
                        fontWeight: isSelected ? 750 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{cat}</span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '99px',
                        backgroundColor: isSelected ? '#d0e2f4' : '#f1f5f9',
                        color: isSelected ? '#0b5ea8' : '#64748b',
                        fontWeight: 700
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro: Faixa de Preço */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#051329', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Faixa de Preço</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'todos', label: 'Todos os valores' },
                  { id: 'ate30', label: 'Até R$ 30,00' },
                  { id: '30a60', label: 'R$ 30,00 a R$ 60,00' },
                  { id: 'acima60', label: 'Acima de R$ 60,00' },
                ].map(item => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="preco"
                      checked={precoFilter === item.id}
                      onChange={() => setPrecoFilter(item.id as any)}
                      style={{ accentColor: '#0b5ea8', cursor: 'pointer' }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro: Disponibilidade */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: '#051329', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  checked={apenasEstoque}
                  onChange={(e) => setApenasEstoque(e.target.checked)}
                  style={{ accentColor: '#0b5ea8', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Somente em estoque</span>
              </label>
            </div>
          </aside>

          {/* ÁREA DE PRODUTOS & TOOLBAR DE ORDENAÇÃO */}
          <div>
            
            {/* Toolbar Superior do Catálogo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              backgroundColor: '#ffffff',
              padding: '14px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e7ef',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <span style={{ fontSize: '13.5px', color: '#64748b', fontWeight: 500 }}>
                Exibindo <strong style={{ color: '#051329' }}>{produtosFiltrados.length}</strong> produtos
              </span>

              {/* Ordenação */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Ordenar por:</span>
                <select 
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#051329',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    fontWeight: 600
                  }}
                >
                  <option value="destaque">Destaques</option>
                  <option value="menor_preco">Menor Preço</option>
                  <option value="maior_preco">Maior Preço</option>
                  <option value="nome">Nome (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Grid de Produtos */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#051329', animation: 'spin 1s infinite linear' }}>
                  sync
                </span>
                <p style={{ marginTop: '12px', fontWeight: 600, color: '#64748b' }}>Carregando catálogo Bryza...</p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e7ef'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '56px', color: '#94a3b8' }}>
                  search_off
                </span>
                <h3 style={{ margin: '12px 0 6px', color: '#051329', fontSize: '20px', fontWeight: 700 }}>Nenhum produto encontrado</h3>
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '14px' }}>Tente alterar os filtros aplicados na barra lateral.</p>
                <button 
                  onClick={clearFilters}
                  style={{ padding: '8px 16px', backgroundColor: '#051329', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '24px'
              }}>
                {produtosFiltrados.map(p => {
                  const qtyInCart = cart.get(p.id) || 0;
                  const hasStock = p.estoque_atual > 0;

                  return (
                    <article 
                      key={p.id}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e7ef',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                        transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 12px 28px rgba(5,19,41,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(0,43,92,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.02)';
                        e.currentTarget.style.borderColor = '#e2e7ef';
                      }}
                    >
                      {/* Crop da Imagem (Clicável) */}
                      <div 
                        onClick={() => setDetailProduct(p)}
                        style={{
                          height: '200px',
                          padding: '12px',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f8fafc',
                          borderRadius: '12px',
                          marginBottom: '16px',
                          border: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {p.imagem_url ? (
                          <img 
                            src={p.imagem_url} 
                            alt={p.nome_produto}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: '56px', color: '#cbd5e1' }}>
                            inventory_2
                          </span>
                        )}
                      </div>

                      {/* Detalhes (Clicável) */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div onClick={() => setDetailProduct(p)} style={{ cursor: 'pointer' }}>
                          <span style={{
                            display: 'inline-flex',
                            padding: '3px 8px',
                            color: '#0b5ea8',
                            backgroundColor: '#f0f6fc',
                            border: '1px solid #d0e2f4',
                            borderRadius: '999px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            marginBottom: '8px'
                          }}>
                            {p.categoria || 'Produto'}
                          </span>

                          <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#051329', lineHeight: 1.25 }}>
                            {p.nome_produto}
                          </h3>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                            Embalagem: {p.unidade || 'UN'}
                          </span>
                        </div>

                        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 600 }}>PREÇO</span>
                              {p.preco_original && p.preco_original > p.preco_venda ? (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '13px', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                                      {formatCurrency(p.preco_original)}
                                    </span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1px 5px', borderRadius: '4px' }}>
                                      -{Math.round(((p.preco_original - p.preco_venda) / p.preco_original) * 100)}%
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '22px', fontWeight: 800, color: '#051329', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                    {formatCurrency(p.preco_venda)}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '22px', fontWeight: 800, color: '#051329', letterSpacing: '-0.02em' }}>
                                  {formatCurrency(p.preco_venda)}
                                </span>
                              )}
                            </div>

                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              color: hasStock ? '#4d7c0f' : '#dc2626',
                              backgroundColor: hasStock ? '#f4fce8' : '#fef2f2',
                              border: hasStock ? '1px solid rgba(101,156,49,0.35)' : '1px solid #fecaca',
                              padding: '3px 8px',
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: hasStock ? '#5a8216' : '#dc2626' }} />
                              {hasStock ? 'Disponível' : 'Esgotado'}
                            </span>
                          </div>

                          {/* Ações de Carrinho - Sempre Exibe o Botão Adicionar */}
                          <button
                            disabled={!hasStock}
                            onClick={() => {
                              updateQuantity(p.id, 1);
                              toast.success(`${p.nome_produto} adicionado ao carrinho!`, { duration: 1500 });
                            }}
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              padding: '8px 14px',
                              backgroundColor: hasStock ? '#AEDB45' : '#e2e8f0',
                              color: hasStock ? '#051329' : '#94a3b8',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 750,
                              fontSize: '13.5px',
                              cursor: hasStock ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              boxShadow: hasStock ? '0 6px 18px rgba(174,219,69,0.2)' : 'none',
                              transition: 'all 0.2s ease',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                              if (hasStock) e.currentTarget.style.backgroundColor = '#9cb82d';
                            }}
                            onMouseLeave={(e) => {
                              if (hasStock) e.currentTarget.style.backgroundColor = '#AEDB45';
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_shopping_cart</span>
                            <span>{hasStock ? 'Adicionar ao Carrinho' : 'Indisponível'}</span>
                            {qtyInCart > 0 && (
                              <span style={{
                                backgroundColor: '#009845',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '999px',
                                marginLeft: '4px'
                              }}>
                                {qtyInCart}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 5. Botão Flutuante de Suporte no WhatsApp + Balão de Chamada com Botão Fechar X */}
      <div style={{
        position: 'fixed',
        bottom: totalCartCount > 0 && !isCartOpen ? '96px' : '24px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1000,
        transition: 'all 0.25s ease'
      }}>
        {/* Balão Mensagem com Botão Fechar X */}
        {showHelpTooltip && (
          <div
            className="hide-mobile"
            style={{
              backgroundColor: '#ffffff',
              color: '#051329',
              padding: '8px 14px 8px 10px',
              borderRadius: '999px',
              boxShadow: '0 8px 24px rgba(5,19,41,0.14)',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'fadeIn 0.25s ease'
            }}
          >
            {/* Botão Fechar X */}
            <button
              onClick={() => setShowHelpTooltip(false)}
              title="Fechar mensagem"
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 800,
                lineHeight: 1,
                padding: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fecaca';
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.borderColor = '#fca5a5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              ✕
            </button>

            {/* Link para o WhatsApp */}
            <a
              href="https://wa.me/556132462117?text=Ol%C3%A1!%20Estou%20na%20Loja%20Virtual%20Bryza%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20os%20produtos."
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#051329',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#25D366',
                display: 'inline-block',
                boxShadow: '0 0 8px #25D366'
              }} />
              <span>Alguma dúvida? Fale conosco...</span>
            </a>
          </div>
        )}

        {/* Botão Ícone WhatsApp (Vetor Oficial Perfeito) */}
        <a
          href="https://wa.me/556132462117?text=Ol%C3%A1!%20Estou%20na%20Loja%20Virtual%20Bryza%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20os%20produtos."
          target="_blank"
          rel="noopener noreferrer"
          title="Alguma dúvida? Fale conosco pelo WhatsApp"
          style={{
            backgroundColor: '#25D366',
            color: '#ffffff',
            width: '58px',
            height: '58px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37,211,102,0.4)',
            textDecoration: 'none',
            flexShrink: 0,
            transition: 'transform 0.25s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#FFFFFF">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      </div>

      {/* 6. Floating Bottom Cart Bar */}
      {totalCartCount > 0 && !isCartOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'linear-gradient(135deg, #009845 0%, #047857 100%)',
          color: '#ffffff',
          padding: '14px 24px',
          borderRadius: '16px',
          boxShadow: '0 16px 40px rgba(0,152,69,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          zIndex: 1000,
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div>
            <span style={{ fontSize: '11px', opacity: 0.9, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              {totalCartCount} {totalCartCount === 1 ? 'item' : 'itens'}
            </span>
            <strong style={{ fontSize: '18px', color: '#ffffff' }}>{formatCurrency(totalCartValue)}</strong>
          </div>
          <button
            onClick={() => { setIsCartOpen(true); setStep('carrinho'); }}
            style={{
              backgroundColor: '#ffffff',
              color: '#047857',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span>Ver Carrinho</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
          </button>
        </div>
      )}

      {/* 6.5. Modal de Detalhes do Produto ao Clicar no Item */}
      {detailProduct && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15,23,42,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setDetailProduct(null)}>
          
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>

            {/* Botão Fechar Modal X */}
            <button
              onClick={() => setDetailProduct(null)}
              title="Fechar detalhes"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fecaca';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px', fontWeight: 800 }}>close</span>
            </button>

            {/* Conteúdo Principal do Modal */}
            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Imagem do Produto */}
              <div style={{
                height: '240px',
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                position: 'relative'
              }}>
                {detailProduct.imagem_url ? (
                  <img 
                    src={detailProduct.imagem_url} 
                    alt={detailProduct.nome_produto}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: '72px', color: '#cbd5e1' }}>
                    inventory_2
                  </span>
                )}

                {/* Badge Estoque */}
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: (detailProduct.estoque_atual ?? 1) > 0 ? '#047857' : '#dc2626',
                  backgroundColor: (detailProduct.estoque_atual ?? 1) > 0 ? '#dcfce7' : '#fef2f2',
                  border: (detailProduct.estoque_atual ?? 1) > 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  padding: '4px 10px',
                  borderRadius: '999px'
                }}>
                  {(detailProduct.estoque_atual ?? 1) > 0 ? 'Disponível em estoque' : 'Esgotado'}
                </span>
              </div>

              {/* Informações do Produto */}
              <div>
                <span style={{
                  display: 'inline-flex',
                  padding: '4px 10px',
                  color: '#047857',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '8px'
                }}>
                  {detailProduct.categoria || 'Produto'}
                </span>

                <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                  {detailProduct.nome_produto}
                </h2>

                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px', fontWeight: 500 }}>
                  Embalagem: <strong>{detailProduct.unidade || 'UN'}</strong>
                </p>

                {/* Preço */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '18px' }}>
                  {detailProduct.preco_original && detailProduct.preco_original > detailProduct.preco_venda ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                        {formatCurrency(detailProduct.preco_original)}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '4px' }}>
                        -{Math.round(((detailProduct.preco_original - detailProduct.preco_venda) / detailProduct.preco_original) * 100)}%
                      </span>
                    </div>
                  ) : null}
                  <span style={{ fontSize: '26px', fontWeight: 800, color: '#009845', letterSpacing: '-0.02em' }}>
                    {formatCurrency(detailProduct.preco_venda)}
                  </span>
                </div>

                {/* Descrição */}
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Descrição do Produto
                  </h4>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {detailProduct.descricao || 'Fórmula concentrada de alto rendimento e qualidade garantida Bryza. Desenvolvido para proporcionar limpeza eficiente e aroma duradouro.'}
                  </p>
                </div>

                {/* Botão Adicionar ao Carrinho no Modal */}
                <button
                  disabled={(detailProduct.estoque_atual ?? 1) <= 0}
                  onClick={() => {
                    updateQuantity(detailProduct.id, 1);
                    toast.success(`${detailProduct.nome_produto} adicionado ao carrinho!`);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: (detailProduct.estoque_atual ?? 1) > 0 ? 'linear-gradient(135deg, #009845 0%, #047857 100%)' : '#e2e8f0',
                    color: (detailProduct.estoque_atual ?? 1) > 0 ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: (detailProduct.estoque_atual ?? 1) > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: (detailProduct.estoque_atual ?? 1) > 0 ? '0 8px 24px rgba(0,152,69,0.3)' : 'none'
                  }}
                >
                  <span className="material-symbols-outlined">add_shopping_cart</span>
                  <span>Adicionar ao Carrinho</span>
                  {cart.get(detailProduct.id) ? (
                    <span style={{
                      backgroundColor: '#ffffff',
                      color: '#047857',
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      marginLeft: '4px'
                    }}>
                      {cart.get(detailProduct.id)} no carrinho
                    </span>
                  ) : null}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 7. Side Drawer do Carrinho & Checkout */}
      {isCartOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'flex-end'
        }} onClick={() => setIsCartOpen(false)}>
          
          <div style={{
            backgroundColor: '#ffffff',
            width: '100%',
            maxWidth: '540px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.25)'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header do Drawer - Verde Logo Bryza */}
            <div style={{
              padding: '24px',
              background: 'linear-gradient(135deg, #009845 0%, #047857 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(0,152,69,0.2)'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                  {step === 'carrinho' && 'Seu Carrinho Bryza'}
                  {step === 'checkout' && 'Finalizar Agendamento'}
                  {step === 'sucesso' && 'Pedido Confirmado!'}
                </h2>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  {step === 'carrinho' && `${totalCartCount} produtos adicionados`}
                  {step === 'checkout' && (isLoggedIn ? 'Confirme seus dados para agendamento' : 'Preencha seus dados para agendamento')}
                  {step === 'sucesso' && 'Confirme seu pedido via WhatsApp'}
                </span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
              </button>
            </div>

            {/* Conteúdo do Drawer */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

              {/* PASSO 1: CARRINHO */}
              {step === 'carrinho' && (
                <div>
                  {cartItemsDetailed.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: '#f0fdf4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        border: '1px solid #bbf7d0'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '42px', color: '#009845' }}>
                          shopping_basket
                        </span>
                      </div>
                      <p style={{ marginTop: '12px', color: '#0f172a', fontWeight: 700, fontSize: '16px' }}>Seu carrinho está vazio.</p>
                      <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0' }}>Navegue pelo catálogo e adicione os produtos desejados.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {cartItemsDetailed.map(item => (
                        <div key={item.produto.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          borderRadius: '12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '8px',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '1px solid #e2e8f0'
                          }}>
                            {item.produto.imagem_url ? (
                              <img src={item.produto.imagem_url} alt={item.produto.nome_produto} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            ) : (
                              <span className="material-symbols-outlined" style={{ color: '#cbd5e1' }}>inventory_2</span>
                            )}
                          </div>

                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                              {item.produto.nome_produto}
                            </h4>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#009845' }}>
                              {formatCurrency(item.produto.preco_venda)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => updateQuantity(item.produto.id, -1)}
                                style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 800, cursor: 'pointer', color: '#0f172a' }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) {
                                    setDirectQuantity(item.produto.id, val);
                                  } else {
                                    setDirectQuantity(item.produto.id, 0);
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (isNaN(val) || val <= 0) {
                                    removeFromCart(item.produto.id);
                                  }
                                }}
                                style={{
                                  width: '48px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  textAlign: 'center',
                                  fontWeight: 800,
                                  fontSize: '14px',
                                  color: '#0f172a',
                                  outline: 'none',
                                  padding: '0 2px'
                                }}
                              />
                              <button
                                onClick={() => updateQuantity(item.produto.id, 1)}
                                style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#009845', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
                              >
                                +
                              </button>
                            </div>

                            {/* Botão X para Zerar/Remover Produto */}
                            <button
                              onClick={() => removeFromCart(item.produto.id)}
                              title="Remover este produto do carrinho"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                                marginLeft: '4px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#ef4444';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.borderColor = '#dc2626';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fef2f2';
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.borderColor = '#fecaca';
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', fontWeight: 700 }}>close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PASSO 2: CHECKOUT */}
              {step === 'checkout' && (
                <form id="checkout-form" onSubmit={handleFinalizeOrder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Dados do Cliente */}
                  <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: '#009845' }}>person</span>
                      Seus Dados Pessoais
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Nome Completo *</label>
                        <input 
                          type="text" 
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Ex: Maria das Graças Silva"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Telefone / WhatsApp *</label>
                        <input 
                          type="tel" 
                          required
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="Ex: 61999999999"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Endereço de Entrega */}
                  <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: '#009845' }}>location_on</span>
                      Endereço de Entrega
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Logradouro / Rua *</label>
                        <input 
                          type="text" 
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Ex: QNN 18 Conjunto B"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Número</label>
                          <input 
                            type="text" 
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="Ex: Casa 12"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Bairro / Setor *</label>
                          <input 
                            type="text" 
                            required
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            placeholder="Ex: Ceilândia Sul"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cidade *</label>
                          <input 
                            type="text" 
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>UF *</label>
                          <input 
                            type="text" 
                            required
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Agendamento */}
                  <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: '#009845' }}>calendar_month</span>
                      Agendamento da Entrega (Próximos 5 dias)
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Dia de Agendamento</label>
                        <select 
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#ffffff' }}
                        >
                          {nextDaysOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Período Preferencial</label>
                        <select 
                          value={period}
                          onChange={(e) => setPeriod(e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#ffffff' }}
                        >
                          <option value="manhademanha">Manhã (08:00 - 12:00)</option>
                          <option value="tarde">Tarde (13:00 - 18:00)</option>
                          <option value="noite">Noite (18:00 - 21:00)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Forma de Pagamento */}
                  <div style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: '#009845' }}>payments</span>
                      Forma de Pagamento na Entrega
                    </h3>

                    <select 
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#ffffff' }}
                    >
                      <option value="PIX">PIX</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão de Crédito/Débito">Cartão de Crédito/Débito</option>
                    </select>
                  </div>

                  {/* Observações */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Observações (Opcional)</label>
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Instruções de entrega, ponto de referência..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', minHeight: '60px' }}
                    />
                  </div>
                </form>
              )}

              {/* PASSO 3: SUCESSO & WHATSAPP */}
              {step === 'sucesso' && lastOrder && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: '#f0fdf4',
                    color: '#009845',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid #bbf7d0'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>check_circle</span>
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                    Pedido #{lastOrder.number} Agendado!
                  </h3>
                  <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px' }}>
                    Seu pedido foi registrado no sistema com sucesso.
                  </p>

                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    textAlign: 'left',
                    marginBottom: '28px'
                  }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Resumo da Entrega</h4>
                    <p style={{ margin: '6px 0', fontSize: '13.5px', color: '#334155' }}>• <strong>Cliente:</strong> {clientName}</p>
                    <p style={{ margin: '6px 0', fontSize: '13.5px', color: '#334155' }}>• <strong>Telefone:</strong> {clientPhone}</p>
                    <p style={{ margin: '6px 0', fontSize: '13.5px', color: '#334155' }}>• <strong>Endereço:</strong> {address}, {number} - {neighborhood}, {city}</p>
                    <p style={{ margin: '6px 0', fontSize: '13.5px', color: '#334155' }}>• <strong>Data Agendada:</strong> {scheduledDate} ({period})</p>
                    <p style={{ margin: '6px 0', fontSize: '13.5px', color: '#334155' }}>• <strong>Pagamento:</strong> {paymentMethod}</p>
                  </div>

                  {/* Botão de Confirmação no WhatsApp */}
                  <a
                    href={lastOrder.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      backgroundColor: '#25D366',
                      color: '#ffffff',
                      padding: '16px 24px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '15px',
                      textDecoration: 'none',
                      boxShadow: '0 8px 24px rgba(37,211,102,0.3)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <span className="material-symbols-outlined">chat</span>
                    <span>Clique aqui para confirmar no WhatsApp</span>
                  </a>
                </div>
              )}
            </div>

            {/* Rodapé do Drawer */}
            {step !== 'sucesso' && (
              <div style={{
                padding: '20px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>VALOR TOTAL</span>
                  <strong style={{ fontSize: '22px', color: '#009845' }}>{formatCurrency(totalCartValue)}</strong>
                </div>

                {step === 'carrinho' ? (
                  <button
                    disabled={cartItemsDetailed.length === 0}
                    onClick={() => setStep('checkout')}
                    style={{
                      background: cartItemsDetailed.length > 0 ? 'linear-gradient(135deg, #009845 0%, #047857 100%)' : '#e2e8f0',
                      color: cartItemsDetailed.length > 0 ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      padding: '14px 24px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: cartItemsDetailed.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: cartItemsDetailed.length > 0 ? '0 8px 20px rgba(0,152,69,0.3)' : 'none'
                    }}
                  >
                    <span>Avançar para Entrega</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setStep('carrinho')}
                      style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={submitting}
                      style={{
                        background: 'linear-gradient(135deg, #009845 0%, #047857 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.7 : 1,
                        boxShadow: '0 8px 20px rgba(0,152,69,0.3)'
                      }}
                    >
                      {submitting ? 'Confirmando...' : 'Confirmar Agendamento'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Rodapé E-Commerce Completo Bryza (Fundo Escuro #051329) */}
      <footer style={{
        backgroundColor: '#051329',
        color: '#ffffff',
        padding: '60px 24px 24px',
        marginTop: '60px',
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '40px', marginBottom: '40px' }}>
          
          {/* Coluna 1: Sobre a Bryza */}
          <div>
            <div style={{ marginBottom: '16px' }}>
              <img src="/Logo Bryza.svg" alt="Bryza" style={{ height: '38px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            </div>
            <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
              Produtos de limpeza de alta performance com fórmulas concentradas, rendimento superior e perfume prolongado para sua casa.
            </p>
          </div>

          {/* Coluna 2: Atendimento & Contato */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Atendimento</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'rgba(255,255,255,0.75)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#25D366' }}>call</span>
                (61) 3246-2117 (WhatsApp)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#AEDB45' }}>schedule</span>
                Seg à Sex: 08h às 18h | Sáb: 08h às 12h
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#AEDB45' }}>location_on</span>
                Entorno Sul de Brasília: Cidade Ocidental, Valparaíso de Goiás, Novo Gama e Luziânia
              </li>
            </ul>
          </div>

          {/* Coluna 3: Links Úteis */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Nossa Loja</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'rgba(255,255,255,0.75)' }}>
              <li><a href="/loja" style={{ color: 'inherit', textDecoration: 'none' }}>Catálogo Completo</a></li>
              <li><a href="/embaixadores" style={{ color: 'inherit', textDecoration: 'none' }}>Seja um Embaixador</a></li>
              <li><a href="/embaixador/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>Portal do Embaixador</a></li>
              <li><a href="https://wa.me/556132462117" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Suporte ao Cliente</a></li>
            </ul>
          </div>

          {/* Coluna 4: Pagamento & Segurança */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Pagamento na Entrega</h4>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: '12px' }}>
              Pague somente ao receber o pedido em sua casa:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito'].map(p => (
                <span key={p} style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Linha de Copyright */}
        <div style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
          <span>© 2026 Bryza Produtos de Limpeza. Todos os direitos reservados.</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#5a8216' }}>lock</span>
            Ambiente 100% Seguro & Protegido
          </span>
        </div>
      </footer>
    </div>
  );
}
