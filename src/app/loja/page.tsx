'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Produto, StoreKit } from '@/models/types';
import { getStoreProductsAction, getStoreUserInfoAction, createStoreOrderAction, StoreCartItem } from './actions';
import { toast } from 'sonner';

import LojaCheckoutModal from './LojaCheckoutModal';
import VisitorWelcomeModal from './VisitorWelcomeModal';
import StoreRegistrationModal from './cadastro/StoreRegistrationModal';
import styles from './loja.module.css';

export default function LojaVirtualPage() {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kits, setKits] = useState<StoreKit[]>([]);
  const [search, setSearch] = useState('');
  const [categoriaSel, setCategoriaSel] = useState<string>('Todos');
  const [precoFilter, setPrecoFilter] = useState<'todos' | 'ate30' | '30a60' | 'acima60'>('todos');
  const [apenasEstoque, setApenasEstoque] = useState(false);
  const [sortOrder, setSortOrder] = useState<'destaque' | 'menor_preco' | 'maior_preco' | 'nome'>('destaque');
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  // Dados do Usuário / Embaixador
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loginModalRequest, setLoginModalRequest] = useState(0);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const openRegistration = useCallback(() => setIsRegistrationOpen(true), []);

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
  const [paymentTiming] = useState<'agora' | 'na_entrega'>('na_entrega');
  const [notes, setNotes] = useState('');

  // Modais & Steps
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
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
        setKits(resProd.kits || []);
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
          setCart(new Map(entries.map(([id, quantity]) => [
            id.includes(':') ? id : `produto:${id}`,
            quantity,
          ])));
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

      const matchesEstoque = !apenasEstoque || (p.estoque_disponivel ?? p.estoque_atual) > 0;

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
  const productCartKey = (produtoId: string) => `produto:${produtoId}`;
  const kitCartKey = (kitId: string) => `kit:${kitId}`;

  const updateQuantity = (cartKey: string, delta: number) => {
    setCart(prev => {
      const next = new Map(prev);
      const current = next.get(cartKey) || 0;
      const updated = current + delta;
      if (updated <= 0) {
        next.delete(cartKey);
      } else {
        next.set(cartKey, updated);
      }
      return next;
    });
  };

  const removeFromCart = (cartKey: string) => {
    setCart(prev => {
      const next = new Map(prev);
      next.delete(cartKey);
      return next;
    });
  };

  const setDirectQuantity = (cartKey: string, quantity: number) => {
    setCart(prev => {
      const next = new Map(prev);
      if (quantity <= 0) {
        next.delete(cartKey);
      } else {
        next.set(cartKey, quantity);
      }
      return next;
    });
  };

  const cartItemsDetailed: StoreCartItem[] = useMemo(() => {
    const items: StoreCartItem[] = [];
    cart.forEach((qty, key) => {
      const [kind, id] = key.includes(':') ? key.split(':', 2) : ['produto', key];
      if (kind === 'kit') {
        const kit = kits.find(item => item.id === id);
        if (kit && qty > 0) items.push({ kind: 'kit', kit, quantidade: qty });
        return;
      }
      const prod = produtos.find(p => p.id === id);
      if (prod && qty > 0) {
        items.push({ kind: 'produto', produto: prod, quantidade: qty });
      }
    });
    return items;
  }, [cart, produtos, kits]);

  const totalCartCount = useMemo(() => {
    let sum = 0;
    cart.forEach(qty => { sum += qty; });
    return sum;
  }, [cart]);

  const totalCartValue = useMemo(() => {
    return cartItemsDetailed.reduce((acc, item) => acc + (
      item.kind === 'produto' ? item.produto.preco_venda : item.kit.preco_venda
    ) * item.quantidade, 0);
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
        paymentTiming,
        notes,
        items: cartItemsDetailed.map(item => ({
          ...(item.kind === 'produto' ? { produto_id: item.produto.id } : { kit_id: item.kit.id }),
          quantidade: item.quantidade,
        })),
        idempotencyKey: globalThis.crypto.randomUUID(),
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
    <div className={styles.storePage} style={{
      minHeight: '100vh', 
      backgroundColor: '#f8fafc', 
      fontFamily: 'Inter, Arial, sans-serif',
      color: '#273244',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* 1. Header do Site (Design Limpo: Logo + Perfil + Ícone de Carrinho) */}
      <VisitorWelcomeModal
        isLoggedIn={isLoggedIn}
        sessionResolved={!loading}
        loginRequest={loginModalRequest}
        loginReturnTo="/loja/minha-conta"
        onCreateAccount={openRegistration}
      />

      <header className={styles.siteHeader} style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
      }}>
        <div className={styles.headerInner} style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px'
        }}>
          {/* Logo Oficial da Bryza */}
          <a className={styles.logoLink} href="/loja" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img 
              src="/Logo Bryza.svg" 
              alt="Bryza - O perfume que envolve a Paranoá" 
              className={styles.logoImage}
              style={{ height: '44px', objectFit: 'contain' }} 
            />
          </a>

          {/* Lado Direito: Botão Espaço do Embaixador & Ícone do Carrinho */}
          <div className={styles.headerActions} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            
            {userData?.is_ambassador && (
              <a
                href="/embaixador/dashboard"
                style={{
                  backgroundColor: 'var(--color-primary, #005675)',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(0,86,117,0.2)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dashboard</span>
                <span>Painel Embaixador</span>
              </a>
            )}

            {isLoggedIn ? (
              <a
                href="/loja/minha-conta"
                className={styles.ambassadorLink}
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
                <span>{userData?.full_name?.split(' ')[0] || 'Minha conta'}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalRequest((current) => current + 1)}
                className={styles.ambassadorLink}
                style={{
                  border: '1.5px solid #051329',
                  color: '#051329',
                  backgroundColor: 'transparent',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_circle</span>
                <span>Entrar</span>
              </button>
            )}

            {/* Botão de Carrinho: Apenas Ícone com Badge Superior quando > 0 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setIsCartOpen(true); setStep('carrinho'); }}
                title="Ver Carrinho"
                className={styles.headerCartButton}
                aria-label="Abrir carrinho"
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
      <div className={styles.announcement} style={{
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
      <div className={styles.hero} style={{
        backgroundColor: '#ffffff',
        color: '#051329',
        padding: '24px',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div className={styles.heroInner} style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div className={styles.heroCopy}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#051329' }}>
              Produtos Direto da Fábrica
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13.5px' }}>
              Fórmulas concentradas, rendimento superior e perfume prolongado para suas roupas e casa.
            </p>
          </div>

          {/* Campo de Busca Rápida (Fundo Claro) */}
          <div className={styles.searchBox} style={{ flex: 1, maxWidth: '420px', minWidth: '240px', position: 'relative' }}>
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
      <main id="catalogo" className={styles.catalogMain} style={{ maxWidth: '1280px', margin: '32px auto', padding: '0 24px', flex: 1, width: '100%' }}>
        
        <div className={styles.catalogLayout} style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* SIDEBAR DE FILTROS E-COMMERCE */}
          <aside className={styles.filters} style={{
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
          <div className={styles.catalogContent}>
            
            {/* Toolbar Superior do Catálogo */}
            <div className={styles.catalogToolbar} style={{
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
              <div className={styles.sortControls} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            {kits.length > 0 && (
              <section aria-labelledby="kits-promocionais" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ color: '#4d7c0f', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Oferta do mês
                    </span>
                    <h2 id="kits-promocionais" style={{ margin: '4px 0 0', color: '#051329', fontSize: '24px' }}>
                      Kits promocionais
                    </h2>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Composição fixa e preço fechado</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
                  {kits.map(kit => {
                    const kitKey = kitCartKey(kit.id);
                    const hasStock = kit.disponivel && kit.estoque_disponivel > 0;
                    const hasDiscount = Boolean(kit.preco_referencia && kit.preco_referencia > kit.preco_venda);
                    const discountPercent = hasDiscount
                      ? Math.round(((kit.preco_referencia! - kit.preco_venda) / kit.preco_referencia!) * 100)
                      : 0;
                    const componentCount = (kit.itens || []).reduce((total, item) => total + item.quantidade, 0);
                    const qtyInCart = cart.get(kitKey) || 0;

                    return (
                      <article
                        className={styles.productCard}
                        key={kit.id}
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
                        onMouseEnter={(event) => {
                          event.currentTarget.style.transform = 'translateY(-3px)';
                          event.currentTarget.style.boxShadow = '0 12px 28px rgba(5,19,41,0.08)';
                          event.currentTarget.style.borderColor = 'rgba(0,43,92,0.2)';
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.transform = 'translateY(0)';
                          event.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.02)';
                          event.currentTarget.style.borderColor = '#e2e7ef';
                        }}
                      >
                        <div
                          className={styles.productImage}
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
                            border: '1px solid #f1f5f9'
                          }}
                        >
                          {kit.imagem_url ? (
                            <img src={kit.imagem_url} alt={kit.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '56px', color: '#cbd5e1' }}>redeem</span>
                          )}
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
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
                              Kit promocional
                            </span>

                            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#051329', lineHeight: 1.25 }}>
                              {kit.nome}
                            </h3>
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                              Composição: {componentCount} {componentCount === 1 ? 'item' : 'itens'}
                            </span>

                            {kit.descricao && (
                              <p style={{ margin: '10px 0 0', color: '#64748b', fontSize: '12px', lineHeight: 1.45 }}>
                                {kit.descricao}
                              </p>
                            )}

                            <div style={{ marginTop: '12px', color: '#475569' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Inclui</span>
                              <ul style={{ margin: '4px 0 0', paddingLeft: '17px', fontSize: '12px', lineHeight: 1.55 }}>
                                {(kit.itens || []).map(item => <li key={item.id}>{item.quantidade}x {item.produto?.nome_produto || 'Produto'}</li>)}
                              </ul>
                            </div>
                          </div>

                          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
                              <div>
                                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 600 }}>PREÇO</span>
                                {hasDiscount ? (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '13px', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                                        {formatCurrency(kit.preco_referencia!)}
                                      </span>
                                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1px 5px', borderRadius: '4px' }}>
                                        -{discountPercent}%
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#051329', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                      {formatCurrency(kit.preco_venda)}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '22px', fontWeight: 800, color: '#051329', letterSpacing: '-0.02em' }}>
                                    {formatCurrency(kit.preco_venda)}
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

                            <button
                              disabled={!hasStock}
                              onClick={() => { updateQuantity(kitKey, 1); toast.success(`${kit.nome} adicionado ao carrinho!`, { duration: 1500 }); }}
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
                              onMouseEnter={(event) => {
                                if (hasStock) event.currentTarget.style.backgroundColor = '#9cb82d';
                              }}
                              onMouseLeave={(event) => {
                                if (hasStock) event.currentTarget.style.backgroundColor = '#AEDB45';
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
              </section>
            )}

            {/* Grid de Produtos */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#051329', animation: 'spin 1s infinite linear' }}>
                  sync
                </span>
                <p style={{ marginTop: '12px', fontWeight: 600, color: '#64748b' }}>Carregando catálogo Bryza...</p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className={styles.productsGrid} style={{
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
                  const qtyInCart = cart.get(productCartKey(p.id)) || 0;
                  const hasStock = (p.estoque_disponivel ?? p.estoque_atual) > 0;

                  return (
                    <article
                      className={styles.productCard}
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
                        className={styles.productImage}
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
                              updateQuantity(productCartKey(p.id), 1);
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
      <div className={styles.whatsappFloat} style={{
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
          className={styles.whatsappButton}
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
        <div className={styles.floatingCart} style={{
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
            className={styles.floatingCartButton}
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
        <div className={styles.productModalOverlay} style={{
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
          
          <div className={styles.productModal} style={{
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
              className={styles.iconButton}
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
            <div className={styles.productModalContent} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Imagem do Produto */}
              <div className={styles.productModalImage} style={{
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
                  color: (detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? '#047857' : '#dc2626',
                  backgroundColor: (detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? '#dcfce7' : '#fef2f2',
                  border: (detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  padding: '4px 10px',
                  borderRadius: '999px'
                }}>
                  {(detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? 'Disponível em estoque' : 'Esgotado'}
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
                  disabled={(detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) <= 0}
                  onClick={() => {
                    updateQuantity(productCartKey(detailProduct.id), 1);
                    toast.success(`${detailProduct.nome_produto} adicionado ao carrinho!`);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: (detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? 'linear-gradient(135deg, #009845 0%, #047857 100%)' : '#e2e8f0',
                    color: (detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: (detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: (detailProduct.estoque_disponivel ?? detailProduct.estoque_atual ?? 1) > 0 ? '0 8px 24px rgba(0,152,69,0.3)' : 'none'
                  }}
                >
                  <span className="material-symbols-outlined">add_shopping_cart</span>
                  <span>Adicionar ao Carrinho</span>
                  {cart.get(productCartKey(detailProduct.id)) ? (
                    <span style={{
                      backgroundColor: '#ffffff',
                      color: '#047857',
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      marginLeft: '4px'
                    }}>
                      {cart.get(productCartKey(detailProduct.id))} no carrinho
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
        <div className={styles.cartOverlay} style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'flex-end'
        }} onClick={() => setIsCartOpen(false)}>
          
          <div className={styles.cartDrawer} style={{
            backgroundColor: '#ffffff',
            width: '100%',
            maxWidth: '540px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.25)'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header do Drawer - Verde Logo Bryza */}
            <div className={styles.cartHeader} style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #009845 0%, #047857 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(0,152,69,0.25)'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>shopping_cart</span>
                  Seu Carrinho Bryza
                </h2>
                <span style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  {totalCartCount === 0 ? 'Carrinho vazio' : `${totalCartCount} ${totalCartCount === 1 ? 'item adicionado' : 'itens adicionados'}`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {cartItemsDetailed.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Deseja realmente remover todos os itens do carrinho?')) {
                        setCart(new Map());
                        localStorage.removeItem('bryza_store_cart');
                        toast.success('Carrinho limpo.');
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    Limpar
                  </button>
                )}

                <button
                  className={styles.iconButton}
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
            </div>

            {/* Banner Informativo de Frete Grátis & Região */}
            <div className={styles.deliveryBanner} style={{
              backgroundColor: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                border: '1px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#16a34a'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>local_shipping</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                    Frete Grátis Ativado 🎉
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '999px' }}>
                    GRÁTIS
                  </span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#15803d', lineHeight: 1.3 }}>
                  Entrega direta da fábrica para Cidade Ocidental, Valparaíso, Novo Gama e Luziânia.
                </p>
              </div>
            </div>

            {/* Conteúdo do Drawer (Lista de Produtos & Resumo) */}
            <div className={styles.cartBody} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {cartItemsDetailed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    backgroundColor: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid #bbf7d0',
                    boxShadow: '0 8px 20px rgba(0,152,69,0.1)'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '46px', color: '#009845' }}>
                      shopping_basket
                    </span>
                  </div>
                  <p style={{ marginTop: '12px', color: '#0f172a', fontWeight: 800, fontSize: '17px' }}>Seu carrinho está vazio</p>
                  <p style={{ color: '#64748b', fontSize: '13.5px', margin: '6px 0 20px' }}>Adicione produtos concentrados de alta qualidade Bryza.</p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#009845',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,152,69,0.3)'
                    }}
                  >
                    Ver Produtos na Loja
                  </button>
                </div>
              ) : (
                <>
                  {/* Lista de Produtos Adicionados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Itens Escolhidos ({cartItemsDetailed.length})
                    </span>

                    {cartItemsDetailed.map(item => {
                      const itemKey = item.kind === 'produto' ? productCartKey(item.produto.id) : kitCartKey(item.kit.id);
                      const itemName = item.kind === 'produto' ? item.produto.nome_produto : item.kit.nome;
                      const itemImage = item.kind === 'produto' ? item.produto.imagem_url : item.kit.imagem_url;
                      const itemPrice = item.kind === 'produto' ? item.produto.preco_venda : item.kit.preco_venda;
                      const itemSubtotal = itemPrice * item.quantidade;
                      return (
                        <div key={itemKey} className={styles.cartItem} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '14px 16px',
                          borderRadius: '16px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                        }}>
                          {/* Imagem do Produto */}
                          <div
                            onClick={() => { if (item.kind === 'produto') setDetailProduct(item.produto); }}
                            style={{
                              width: '64px',
                              height: '64px',
                              borderRadius: '12px',
                              backgroundColor: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              flexShrink: 0,
                              border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            {itemImage ? (
                              <img src={itemImage} alt={itemName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            ) : (
                              <span className="material-symbols-outlined" style={{ color: '#cbd5e1' }}>{item.kind === 'kit' ? 'redeem' : 'inventory_2'}</span>
                            )}
                          </div>

                          {/* Detalhes do Produto */}
                          <div className={styles.cartItemDetails} style={{ flex: 1 }}>
                            <h4
                              onClick={() => { if (item.kind === 'produto') setDetailProduct(item.produto); }}
                              style={{ margin: '0 0 4px', fontSize: '14.5px', fontWeight: 700, color: '#0f172a', lineHeight: 1.25, cursor: 'pointer' }}
                            >
                              {itemName}
                            </h4>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                {formatCurrency(itemPrice)} / un
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>•</span>
                              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#009845' }}>
                                Subtotal: {formatCurrency(itemSubtotal)}
                              </span>
                            </div>

                            {/* Controles de Quantidade */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
                                <button
                                  className={styles.quantityButton}
                                  onClick={() => updateQuantity(itemKey, -1)}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#ffffff',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    color: '#0f172a',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                  }}
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
                                      setDirectQuantity(itemKey, val);
                                    } else {
                                      setDirectQuantity(itemKey, 0);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (isNaN(val) || val <= 0) {
                                      removeFromCart(itemKey);
                                    }
                                  }}
                                  style={{
                                    width: '38px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'center',
                                    fontWeight: 800,
                                    fontSize: '13.5px',
                                    color: '#0f172a',
                                    outline: 'none'
                                  }}
                                />
                                <button
                                  className={styles.quantityButton}
                                  onClick={() => updateQuantity(itemKey, 1)}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#009845',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,152,69,0.3)'
                                  }}
                                >
                                  +
                                </button>
                              </div>

                              <button
                                className={styles.removeItemButton}
                                onClick={() => removeFromCart(itemKey)}
                                title="Remover item"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card de Resumo do Valor & Benefícios */}
                  <div style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Resumo da Compra
                    </span>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#475569' }}>
                      <span>Subtotal dos Produtos</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(totalCartValue)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#475569' }}>
                      <span>Taxa de Entrega</span>
                      <strong style={{ color: '#16a34a', backgroundColor: '#dcfce7', padding: '1px 8px', borderRadius: '6px', fontSize: '12px' }}>
                        GRÁTIS
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#475569' }}>
                      <span>Pagamento</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>Na Entrega (Pix, Cartão ou Cash)</span>
                    </div>

                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>Valor Total</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Sem taxa extra ou cobrança oculta</span>
                      </div>
                      <strong style={{ fontSize: '24px', color: '#009845', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {formatCurrency(totalCartValue)}
                      </strong>
                    </div>
                  </div>

                  {/* Selos de Confiança Bryza (Trust Badges) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    paddingTop: '4px'
                  }}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#009845' }}>verified_user</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#334155', lineHeight: 1.2 }}>Pague agora ou na entrega</span>
                    </div>

                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#009845' }}>event_available</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#334155', lineHeight: 1.2 }}>Data Agendada</span>
                    </div>

                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#009845' }}>factory</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#334155', lineHeight: 1.2 }}>Direto de Fábrica</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rodapé Fixo de Ação */}
            {cartItemsDetailed.length > 0 && (
              <div className={styles.cartFooter} style={{
                padding: '20px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>
                      TOTAL DO PEDIDO
                    </span>
                    <strong style={{ fontSize: '24px', color: '#009845', fontWeight: 800 }}>
                      {formatCurrency(totalCartValue)}
                    </strong>
                  </div>

                  <span style={{ fontSize: '12px', color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '999px', fontWeight: 700 }}>
                    100% Seguro
                  </span>
                </div>

                <button
                  disabled={cartItemsDetailed.length === 0}
                  onClick={() => setIsCheckoutModalOpen(true)}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #009845 0%, #047857 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '16px',
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 8px 24px rgba(0,152,69,0.35)',
                    transition: 'transform 0.2s ease, boxShadow 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span>AVANÇAR PARA ENTREGA</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>arrow_forward</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7.5 Modal de Checkout e Agendamento Estilo Bryza02 */}
      {isCheckoutModalOpen && (
        <LojaCheckoutModal
          cartItems={cartItemsDetailed}
          totalValue={totalCartValue}
          isLoggedIn={isLoggedIn}
          userData={userData}
          onClose={() => setIsCheckoutModalOpen(false)}
          onSuccess={(orderRes) => {
            setCart(new Map());
            localStorage.removeItem('bryza_store_cart');
            setIsCartOpen(false);
            toast.success(`Pedido #${orderRes.orderNumber} registrado! Redirecionando para o WhatsApp...`);
          }}
        />
      )}

      <StoreRegistrationModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
        onOpenLogin={() => {
          setIsRegistrationOpen(false);
          setLoginModalRequest(Date.now());
        }}
      />

      {/* 8. Rodapé E-Commerce Completo Bryza (Fundo Escuro #051329) */}
      <footer className={styles.footer} style={{
        backgroundColor: '#051329',
        color: '#ffffff',
        padding: '60px 24px 24px',
        marginTop: '60px',
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div className={styles.footerGrid} style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '40px', marginBottom: '40px' }}>
          
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
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Pagamento flexível</h4>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: '12px' }}>
              Pague agora com Mercado Pago ou escolha pagar ao receber:
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
        <div className={styles.footerBottom} style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
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
