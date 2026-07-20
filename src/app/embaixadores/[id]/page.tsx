'use client';

import { useState, useEffect, useTransition, use, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
  getEmbaixadorDetails, 
  revelarDadosSensiveis, 
  redefinirAcesso, 
  alterarPlano, 
  alterarStatus,
  getSignedPhotoUrl,
  getEmbaixadorNetwork
} from '../actions';
import { formatCurrency, formatDate } from '@/utils/format';
import { getReferralUrl } from '@/utils/env';
import { toast } from 'sonner';
import ClienteTable from '@/app/clientes/ClienteTable';
import { Cliente } from '@/models/types';

interface Context {
  params: Promise<{ id: string }>;
}

export default function EmbaixadorDetailsPage({ params }: Context) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [amb, setAmb] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  // Mascaramento revelado
  const [revealedCpf, setRevealedCpf] = useState<string | null>(null);
  const [revealedPix, setRevealedPix] = useState<string | null>(null);

  // Abas
  const [activeTab, setActiveTab] = useState<'dados' | 'rede' | 'indicacoes' | 'vendas' | 'comissoes' | 'pagamentos' | 'auditoria'>('dados');

  // Planos de comissão (para alteração)
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  // Estados dos dados das abas
  const [visits, setVisits] = useState<any[]>([]);
  const [attributions, setAttributions] = useState<any[]>([]);
  const [referredClientes, setReferredClientes] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteStatusFilter, setClienteStatusFilter] = useState('');
  const [networkData, setNetworkData] = useState<{
    items: any[];
    counts: { total: number; level1: number; level2: number; level3: number };
  } | null>(null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  // Filtro de Auditoria
  const [auditFilter, setAuditFilter] = useState('');

  const [isPending, startTransition] = useTransition();

  const loadGeneralData = async () => {
    try {
      const data = await getEmbaixadorDetails(id);
      setAmb(data);
      setSelectedPlanId(data.commission_plan_id);

      // Resolver Signed URL da foto se existir
      if (data.photo_path) {
        const url = await getSignedPhotoUrl(data.photo_path);
        setPhotoUrl(url);
      } else {
        setPhotoUrl(null);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dados do embaixador.');
      router.push('/embaixadores');
    }
  };

  useEffect(() => {
    loadGeneralData();

    // Carregar planos disponíveis
    const loadPlans = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('commission_plans').select('id, name').order('name');
      if (data) setPlans(data);
    };
    loadPlans();
  }, [id]);

  const filteredReferredClientes = useMemo(() => {
    return referredClientes.filter(c => {
      const searchLower = clienteSearch.toLowerCase().trim();
      const matchSearch = !searchLower || (
        (c.nome && c.nome.toLowerCase().includes(searchLower)) ||
        `c${String(c.codigo_cliente || 0).padStart(5, '0')}`.includes(searchLower) ||
        (c.telefone && c.telefone.includes(searchLower)) ||
        (c.cidade && c.cidade.toLowerCase().includes(searchLower))
      );

      const matchStatus = !clienteStatusFilter || c.status_cliente === clienteStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [referredClientes, clienteSearch, clienteStatusFilter]);

  // Carregar sub-dados com base na aba ativa
  useEffect(() => {
    if (!amb) return;
    const supabase = createClient();

    const fetchTabData = async () => {
      if (activeTab === 'rede') {
        const net = await getEmbaixadorNetwork(amb.id);
        if (net) setNetworkData(net);
      } else if (activeTab === 'indicacoes') {
        const [v, a, cRes] = await Promise.all([
          supabase.from('referral_visits').select('*').eq('ambassador_id', amb.id).order('created_at', { ascending: false }),
          supabase.from('referral_attributions').select('*, clientes(nome)').eq('ambassador_id', amb.id).order('created_at', { ascending: false }),
          supabase.from('clientes').select('*, vendedor:profiles!vendedor_responsavel_id(nome, codigo_vendedor)').eq('ambassador_id', amb.id).order('data_cadastro', { ascending: false })
        ]);
        if (v.data) setVisits(v.data);
        if (a.data) setAttributions(a.data);
        if (cRes.data) setReferredClientes(cRes.data as any[]);
      } else if (activeTab === 'vendas') {
        const { data } = await supabase
          .from('pedidos')
          .select('id, codigo_pedido, valor_total, status_pedido, created_at, clientes(nome)')
          .eq('ambassador_id', amb.id)
          .order('created_at', { ascending: false });
        if (data) setVendas(data);
      } else if (activeTab === 'comissoes') {
        const { data } = await supabase
          .from('commissions')
          .select('*, clientes(nome), pedidos(codigo_pedido)')
          .eq('ambassador_id', amb.id)
          .order('created_at', { ascending: false });
        if (data) setCommissions(data);
      } else if (activeTab === 'pagamentos') {
        const { data } = await supabase
          .from('commission_payments')
          .select('*')
          .eq('ambassador_id', amb.id)
          .order('created_at', { ascending: false });
        if (data) setPayments(data);
      } else if (activeTab === 'auditoria') {
        // Buscar logs relacionados a este embaixador ou ao profile dele
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .or(`entity_id.eq.${amb.id},entity_id.eq.${amb.user_id}`)
          .order('created_at', { ascending: false });
        if (data) setAuditLogs(data);
      }
    };

    fetchTabData();
  }, [activeTab, amb]);

  if (!amb) {
    return (
      <MainLayout>
        <div style={{ padding: '40px', textAlign: 'center' }}>Carregando dados...</div>
      </MainLayout>
    );
  }

  // Ações
  const handleReveal = async (campo: 'cpf' | 'pix') => {
    try {
      const res = await revelarDadosSensiveis(amb.id, campo);
      if (campo === 'cpf') setRevealedCpf(res.value);
      else setRevealedPix(res.value);
      toast.success(`${campo.toUpperCase()} revelado com sucesso.`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao revelar dados.');
    }
  };

  const handleResetAccess = async () => {
    if (!confirm('Deseja realmente redefinir o acesso deste embaixador? A senha voltará a ser o CPF (apenas números) e ele precisará alterá-la no primeiro acesso.')) return;
    startTransition(async () => {
      try {
        await redefinirAcesso(amb.id);
        toast.success('Acesso redefinido com sucesso! Senha inicial: CPF (números).');
      } catch (e: any) {
        toast.error(e.message || 'Erro ao redefinir acesso.');
      }
    });
  };

  const handlePlanChange = async () => {
    if (selectedPlanId === amb.commission_plan_id) return;
    startTransition(async () => {
      try {
        await alterarPlano(amb.id, selectedPlanId);
        toast.success('Plano alterado com sucesso para vendas futuras.');
        loadGeneralData();
      } catch (e: any) {
        toast.error(e.message || 'Erro ao alterar plano.');
      }
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    startTransition(async () => {
      try {
        await alterarStatus(amb.id, newStatus);
        toast.success(`Status alterado para ${newStatus}.`);
        loadGeneralData();
      } catch (e: any) {
        toast.error(e.message || 'Erro ao alterar status.');
      }
    });
  };

  // Resumo de comissões (Aba Comissões)
  const getCommissionsSummary = () => {
    let aguardando = 0;
    let liberada = 0;
    let paga = 0;
    let cancelada = 0;
    let totalGeral = 0;

    commissions.forEach(c => {
      const amount = parseFloat(c.commission_amount || 0);
      totalGeral += amount;
      if (c.status === 'aguardando_entrega' || c.status === 'aguardando_pagamento') {
        aguardando += amount;
      } else if (c.status === 'liberada') {
        liberada += amount;
      } else if (c.status === 'paga') {
        paga += amount;
      } else if (c.status === 'cancelada' || c.status === 'estornada') {
        cancelada += amount;
      }
    });

    return { aguardando, liberada, paga, cancelada, totalGeral };
  };

  const commSummary = getCommissionsSummary();

  // Filtro na Aba Auditoria
  const filteredAuditLogs = auditLogs.filter(log => {
    if (!auditFilter) return true;
    const action = log.action.toLowerCase();
    if (auditFilter === 'login') return action.includes('login') || action.includes('block');
    if (auditFilter === 'senha') return action.includes('password') || action.includes('access');
    if (auditFilter === 'cadastro') return action.includes('create') || action.includes('edit');
    if (auditFilter === 'status') return action.includes('status');
    if (auditFilter === 'plano') return action.includes('plan');
    if (auditFilter === 'dados') return action.includes('reveal');
    if (auditFilter === 'pix') return action.includes('pix');
    return true;
  });

  return (
    <MainLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto 40px' }}>
        
        {/* Header Detalhes */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          borderBottom: '1px solid var(--color-outline-variant)',
          paddingBottom: '24px'
        }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-container-high)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-primary)'
            }}>
              {photoUrl ? (
                <img src={photoUrl} alt={amb.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-outline)' }}>person</span>
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ color: 'var(--color-on-surface)', fontSize: '28px', fontFamily: 'var(--font-headline)', fontWeight: 700, margin: 0 }}>
                  {amb.full_name}
                </h1>
                <span style={{
                  backgroundColor: amb.status === 'ativo' ? '#D1FAE5' : '#FEE2E2',
                  color: amb.status === 'ativo' ? '#059669' : '#DC2626',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>{amb.status}</span>
              </div>
              <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '15px', marginTop: '4px', margin: 0 }}>
                Código/Username: <strong style={{ fontFamily: 'monospace' }}>{amb.username}</strong> | Desde {formatDate(amb.created_at)}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => router.push(`/embaixadores/${amb.id}/editar`)}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
              Editar Cadastro
            </button>
            <button
              onClick={() => router.push('/embaixadores')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline)',
                background: 'transparent',
                color: 'var(--color-on-surface)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Voltar
            </button>
          </div>
        </header>

        {/* Sistema de Abas */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-outline-variant)',
          marginBottom: '24px',
          gap: '8px'
        }}>
          {(['dados', 'rede', 'indicacoes', 'vendas', 'comissoes', 'pagamentos', 'auditoria'] as const).map(tab => {
            const labels: Record<string, string> = {
              dados: 'Dados',
              rede: 'Rede',
              indicacoes: 'Indicações',
              vendas: 'Vendas',
              comissoes: 'Comissões',
              pagamentos: 'Pagamentos',
              auditoria: 'Auditoria'
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                  fontWeight: activeTab === tab ? 700 : 500,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {labels[tab] || tab}
              </button>
            );
          })}
        </div>

        {/* Conteúdo das Abas */}
        <div style={{ minHeight: '400px' }}>
          
          {/* TAB DADOS */}
          {activeTab === 'dados' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
              {/* Informações Cadastrais */}
              <div style={{
                backgroundColor: 'var(--color-surface-container-low)',
                padding: '32px',
                borderRadius: '16px',
                border: '1px solid var(--color-outline-variant)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '10px', margin: 0 }}>
                  Informações Pessoais
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>NOME COMPLETO</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 500 }}>{amb.full_name}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>NOME DE EXIBIÇÃO</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 500 }}>{amb.display_name}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>CPF</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '15px', color: 'var(--color-on-surface)', fontFamily: 'monospace', fontWeight: 700 }}>
                        {revealedCpf || amb.cpf_masked}
                      </span>
                      {!revealedCpf && (
                        <button onClick={() => handleReveal('cpf')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>E-MAIL</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 500 }}>{amb.email}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>TELEFONE</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 500 }}>{amb.phone || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>INSTAGRAM</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 500 }}>{amb.instagram || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>CIDADE / ESTADO</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 500 }}>
                      {amb.city ? `${amb.city} - ${amb.state || ''}` : '-'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>PLANO DE COMISSÃO ATUAL</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 700 }}>
                      {amb.commission_plans?.name} ({amb.commission_plans?.base_commission_percentage}%)
                    </div>
                  </div>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '10px', margin: 0, marginTop: '20px' }}>
                  Dados Financeiros (Pix)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>TIPO DE CHAVE</span>
                    <div style={{ fontSize: '15px', color: 'var(--color-on-surface)', marginTop: '4px', fontWeight: 500, textTransform: 'uppercase' }}>{amb.pix_type || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>CHAVE PIX</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '15px', color: 'var(--color-on-surface)', fontFamily: 'monospace', fontWeight: 700 }}>
                        {revealedPix || amb.pix_key_masked}
                      </span>
                      {!revealedPix && amb.pix_key_masked && (
                        <button onClick={() => handleReveal('pix')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {amb.notes && (
                  <div style={{ marginTop: '20px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>OBSERVAÇÕES</span>
                    <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--color-on-surface)', lineHeight: 1.5 }}>{amb.notes}</p>
                  </div>
                )}
              </div>

              {/* Bloco de Ações Laterais */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Alterar Status */}
                <div style={{
                  backgroundColor: 'var(--color-surface-container-low)',
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid var(--color-outline-variant)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>Controle de Acesso</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-on-surface-variant)', marginBottom: '6px', fontWeight: 600 }}>STATUS DA CONTA</label>
                      <select 
                        value={amb.status} 
                        onChange={e => handleStatusChange(e.target.value)}
                        disabled={isPending}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-outline-variant)',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-on-surface)',
                          fontSize: '14px'
                        }}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                        <option value="bloqueado">Bloqueado</option>
                      </select>
                    </div>

                    <button
                      onClick={handleResetAccess}
                      disabled={isPending}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-error)',
                        background: 'transparent',
                        color: 'var(--color-error)',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginTop: '8px'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock_reset</span>
                      Redefinir Acesso
                    </button>
                  </div>
                </div>

                {/* Alterar Plano */}
                <div style={{
                  backgroundColor: 'var(--color-surface-container-low)',
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid var(--color-outline-variant)'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>Mudar Plano (Futuro)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <select
                      value={selectedPlanId}
                      onChange={e => setSelectedPlanId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-outline-variant)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-on-surface)',
                        fontSize: '14px'
                      }}
                    >
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={handlePlanChange}
                      disabled={isPending || selectedPlanId === amb.commission_plan_id}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        opacity: selectedPlanId === amb.commission_plan_id ? 0.6 : 1
                      }}
                    >
                      Mudar Plano
                    </button>
                  </div>
                </div>

                {/* QR Code & Link */}
                <div style={{
                  backgroundColor: 'var(--color-surface-container-low)',
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid var(--color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>QR Code de Indicação</h4>
                  
                  {/* QR Code gerado pelo backend seguro (cache imutável público) */}
                  <div style={{
                    backgroundColor: 'white',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-outline-variant)',
                    width: '150px',
                    height: '150px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img 
                      src={`/api/r/${amb.username}/qrcode`} 
                      alt="QR Code" 
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getReferralUrl(amb.username));
                      toast.success('Link copiado!');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-outline)',
                      background: 'transparent',
                      color: 'var(--color-on-surface)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                    Copiar Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB REDE */}
          {activeTab === 'rede' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Quadro da Rede de Embaixadores Indicados (Multinível) */}
              <div style={{
                backgroundColor: 'var(--color-surface-container-low)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid var(--color-outline-variant)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)', margin: 0 }}>
                      Rede de Embaixadores Indicados ({networkData?.counts.total || 0})
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', margin: '4px 0 0 0' }}>
                      Embaixadores cadastrados na rede deste perfil (até 3 níveis de profundidade).
                    </p>
                  </div>

                  {/* Badges dos Níveis */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                      Nível 1: {networkData?.counts.level1 || 0}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: '#DCFCE7', color: '#15803D' }}>
                      Nível 2: {networkData?.counts.level2 || 0}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
                      Nível 3: {networkData?.counts.level3 || 0}
                    </span>
                  </div>
                </div>

                {!networkData || networkData.items.length === 0 ? (
                  <div style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', padding: '20px 0' }}>
                    Nenhum embaixador indicado cadastrado nesta rede ainda.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                          <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Nível</th>
                          <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Embaixador</th>
                          <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Patrocinador</th>
                          <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Contato / Local</th>
                          <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Status</th>
                          <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Cadastro</th>
                          <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {networkData.items.map((item) => {
                          const levelBg = item.level === 1 ? '#E0F2FE' : item.level === 2 ? '#DCFCE7' : '#F3E8FF';
                          const levelColor = item.level === 1 ? '#0369A1' : item.level === 2 ? '#15803D' : '#6B21A8';
                          const isAtivo = item.status === 'ativo';

                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                              <td style={{ padding: '10px' }}>
                                <span style={{
                                  backgroundColor: levelBg,
                                  color: levelColor,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 700
                                }}>
                                  Nível {item.level}
                                </span>
                              </td>
                              <td style={{ padding: '10px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>{item.display_name || item.full_name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>@{item.username}</div>
                              </td>
                              <td style={{ padding: '10px', fontSize: '13px', color: 'var(--color-on-surface)' }}>
                                {item.sponsor_name}
                              </td>
                              <td style={{ padding: '10px', fontSize: '12px' }}>
                                <div>{item.phone || '—'}</div>
                                <div style={{ color: 'var(--color-on-surface-variant)' }}>
                                  {item.city && item.state ? `${item.city} - ${item.state}` : item.city || item.state || '—'}
                                </div>
                              </td>
                              <td style={{ padding: '10px' }}>
                                <span style={{
                                  backgroundColor: isAtivo ? '#E6F4EA' : '#FCE8E6',
                                  color: isAtivo ? '#137333' : '#C5221F',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600
                                }}>
                                  {isAtivo ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td style={{ padding: '10px', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                                {formatDate(item.created_at)}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right' }}>
                                <button
                                  onClick={() => router.push(`/embaixadores/${item.id}`)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--color-outline)',
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-primary)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Ver Cadastro
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB INDICAÇÕES */}
          {activeTab === 'indicacoes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Barra de Filtros e Busca por Cliente */}
              <div style={{
                backgroundColor: 'var(--color-surface-container-low)',
                padding: '20px 24px',
                borderRadius: '16px',
                border: '1px solid var(--color-outline-variant)',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
                  {/* Busca por Nome, Código, Telefone ou Cidade */}
                  <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <span className="material-symbols-outlined" style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-outline)',
                      fontSize: '20px'
                    }}>
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar por nome, C00XXX, telefone ou cidade..."
                      value={clienteSearch}
                      onChange={(e) => setClienteSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-outline-variant)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-on-surface)',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* Filtro por Situação (LEAD / CLIENTE) */}
                  <select
                    value={clienteStatusFilter}
                    onChange={(e) => setClienteStatusFilter(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-outline-variant)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-on-surface)',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Todas as Situações</option>
                    <option value="CLIENTE">CLIENTE</option>
                    <option value="LEAD">LEAD</option>
                  </select>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                  Exibindo {filteredReferredClientes.length} de {referredClientes.length} clientes indicados
                </div>
              </div>

              {/* Tabela Completa de Clientes Indicados com Ações (Ver Detalhes + WhatsApp) */}
              <div style={{
                backgroundColor: 'var(--color-surface-container-low)',
                borderRadius: '16px',
                border: '1px solid var(--color-outline-variant)',
                overflow: 'hidden',
                padding: '24px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '16px', marginTop: 0 }}>
                  Clientes Indicados Vinculados ({referredClientes.length})
                </h3>

                <ClienteTable clientes={filteredReferredClientes} isAdmin={true} />
              </div>

              {/* Quadro de Visitas Recentes ao Link */}
              <div style={{
                backgroundColor: 'var(--color-surface-container-low)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid var(--color-outline-variant)'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '16px', marginTop: 0 }}>
                  Visitas Recentes ao Link de Indicação ({visits.length})
                </h3>
                {visits.length === 0 ? (
                  <div style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', padding: '20px 0' }}>Nenhuma visita registrada.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Data/Hora</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Canal (UTM Source)</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Destino</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Navegador/Disp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.slice(0, 10).map((v) => (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                          <td style={{ padding: '10px' }}>{formatDate(v.created_at)}</td>
                          <td style={{ padding: '10px' }}>{v.utm_source || 'Direto'}</td>
                          <td style={{ padding: '10px' }}>{v.destination_path || '/'}</td>
                          <td style={{ padding: '10px', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>{v.user_agent_summary || 'Desconhecido'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB VENDAS */}
          {activeTab === 'vendas' && (
            <div style={{
              backgroundColor: 'var(--color-surface-container-low)',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--color-outline-variant)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '16px', marginTop: 0 }}>
                Vendas Atribuídas ({vendas.length})
              </h3>
              {vendas.length === 0 ? (
                <div style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', padding: '20px 0' }}>Nenhuma venda realizada por indicação.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Pedido</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Data</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Cliente</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>Valor Total</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '10px', fontWeight: 700 }}>{v.codigo_pedido}</td>
                        <td style={{ padding: '10px' }}>{formatDate(v.created_at)}</td>
                        <td style={{ padding: '10px' }}>{v.clientes?.nome || 'Desconhecido'}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(v.valor_total)}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: v.status_pedido === 'finalizado' ? '#D1FAE5' : '#FEF3C7',
                            color: v.status_pedido === 'finalizado' ? '#059669' : '#D97706',
                          }}>{v.status_pedido}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB COMISSÕES */}
          {activeTab === 'comissoes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Bloco de Resumo Superior de Comissões */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px'
              }}>
                <div style={{ backgroundColor: 'var(--color-surface-container-low)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>AGUARDANDO</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#D97706', marginTop: '4px' }}>{formatCurrency(commSummary.aguardando)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--color-surface-container-low)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>LIBERADA</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>{formatCurrency(commSummary.liberada)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--color-surface-container-low)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>PAGA (SAQUES)</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>{formatCurrency(commSummary.paga)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--color-surface-container-low)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>CANCELADA</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#DC2626', marginTop: '4px' }}>{formatCurrency(commSummary.cancelada)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--color-surface-container-low)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-primary)', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>TOTAL HISTÓRICO</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-on-surface)', marginTop: '4px' }}>{formatCurrency(commSummary.totalGeral)}</div>
                </div>
              </div>

              {/* Tabela de Comissões */}
              <div style={{
                backgroundColor: 'var(--color-surface-container-low)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid var(--color-outline-variant)'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '16px', marginTop: 0 }}>
                  Detalhamento de Comissões ({commissions.length})
                </h3>
                {commissions.length === 0 ? (
                  <div style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', padding: '20px 0' }}>Nenhuma comissão registrada.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Pedido</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Data</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Nível</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>Vl. Comissão</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>%</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>Vl. Calculado</th>
                        <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{c.pedidos?.codigo_pedido || 'Desconhecido'}</td>
                          <td style={{ padding: '10px' }}>{formatDate(c.created_at)}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>L{c.commission_level}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(c.commissionable_amount)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{c.percentage_snapshot}%</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(c.commission_amount)}</td>
                          <td style={{ padding: '10px', textTransform: 'capitalize' }}>{c.status.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB PAGAMENTOS */}
          {activeTab === 'pagamentos' && (
            <div style={{
              backgroundColor: 'var(--color-surface-container-low)',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--color-outline-variant)'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: '16px', marginTop: 0 }}>
                Histórico de Pagamentos de Saques ({payments.length})
              </h3>
              {payments.length === 0 ? (
                <div style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', padding: '20px 0' }}>Nenhum pagamento registrado.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Data</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>Valor do Saque</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Método</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Referência</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '10px' }}>{formatDate(p.created_at)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(p.amount)}</td>
                        <td style={{ padding: '10px', textTransform: 'uppercase' }}>{p.payment_method}</td>
                        <td style={{ padding: '10px' }}>{p.payment_reference || '-'}</td>
                        <td style={{ padding: '10px', textTransform: 'capitalize' }}>{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB AUDITORIA */}
          {activeTab === 'auditoria' && (
            <div style={{
              backgroundColor: 'var(--color-surface-container-low)',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--color-outline-variant)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)', margin: 0 }}>
                  Logs de Auditoria do Embaixador ({filteredAuditLogs.length})
                </h3>
                
                {/* Filtro de Categorias de Auditoria */}
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-outline-variant)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  <option value="">Filtrar todos os logs</option>
                  <option value="login">Logs de Login / Acesso</option>
                  <option value="senha">Logs de Senha / Primeiro Acesso</option>
                  <option value="cadastro">Logs de Cadastro / Edição</option>
                  <option value="status">Logs de Mudança de Status</option>
                  <option value="plano">Logs de Troca de Plano</option>
                  <option value="dados">Logs de Revelação de CPF/Pix</option>
                  <option value="pix">Logs de Alteração de Pix</option>
                </select>
              </div>

              {filteredAuditLogs.length === 0 ? (
                <div style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', padding: '20px 0' }}>Nenhum log encontrado.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Data/Hora</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Ação Executada</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Autor (ID)</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>Papel Autor</th>
                      <th style={{ padding: '10px', color: 'var(--color-on-surface-variant)' }}>IP Hash (Auditor)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{log.action}</td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>{log.actor_id || 'Sistema'}</td>
                        <td style={{ padding: '10px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>{log.actor_role}</td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                          {log.ip_hash ? log.ip_hash.slice(0, 16) + '...' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  );
}
