'use client';

import React, { useState } from 'react';
import { Produto } from '@/models/types';
import { EstoqueStats } from './EstoqueStats';
import { EstoqueTable } from './EstoqueTable';
import { MovimentacaoFormModal } from './MovimentacaoFormModal';
import { ProdutoDetailsModal } from './ProdutoDetailsModal';
import PedidoReservaModal from './PedidoReservaModal';
import { useRouter } from 'next/navigation';

interface EstoqueClientPageProps {
  produtos: Produto[];
  stats: {
    totalProdutos: number;
    totalUnidades: number;
    estoqueBaixo: number;
    valorTotal: number;
  };
}

export const EstoqueClientPage = ({ produtos, stats }: EstoqueClientPageProps) => {
  const router = useRouter();
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [reservaProduto, setReservaProduto] = useState<Produto | null>(null);
  const [showMovModal, setShowMovModal] = useState(false);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-header-text">
          <h1 style={{ color: 'var(--color-primary)' }}>Gestão de Estoque</h1>
          <p>Controle de entradas, saídas e monitoramento de saldo em tempo real.</p>
        </div>
        <div className="page-header-actions">
          <button
            onClick={() => setShowMovModal(true)}
            className="btn-primary"
          >
            <span className="material-symbols-outlined">sync_alt</span>
            Registrar Movimentação
          </button>
        </div>
      </div>


      <EstoqueStats stats={stats} />
      
      <EstoqueTable 
        produtos={produtos} 
        onProdutoClick={(p) => setSelectedProduto(p)} 
        onReservaClick={(p) => setReservaProduto(p)}
      />

      {showMovModal && (
        <MovimentacaoFormModal 
          produtos={produtos} 
          onClose={() => setShowMovModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {selectedProduto && (
        <ProdutoDetailsModal 
          produto={selectedProduto}
          onClose={() => setSelectedProduto(null)}
        />
      )}

      {reservaProduto && (
        <PedidoReservaModal 
          produtoId={reservaProduto.id}
          nomeProduto={reservaProduto.nome_produto}
          onClose={() => setReservaProduto(null)}
        />
      )}
    </div>
  );
};
