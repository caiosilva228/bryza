'use client';

import React, { useState, useEffect } from 'react';
import { getReservasProdutoAction } from './actions';
import { formatCurrency, formatDate } from '@/utils/format';

interface Reserva {
  quantidade: number;
  numero_pedido: string;
  nome_vendedor: string;
  status_pedido: string;
  data: string;
}

interface Props {
  produtoId: string;
  nomeProduto: string;
  onClose: () => void;
}

export default function PedidoReservaModal({ produtoId, nomeProduto, onClose }: Props) {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getReservasProdutoAction(produtoId);
      setReservas(data as any);
      setLoading(false);
    }
    load();
  }, [produtoId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-surface border border-white/5 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-in-center">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">list_alt</span>
              Reservas: {nomeProduto}
            </h2>
            <p className="text-sm text-gray-500">Pedidos aguardando separação ou entrega.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : reservas.length === 0 ? (
            <p className="text-center text-gray-500 italic py-8">Nenhuma reserva ativa encontrada.</p>
          ) : (
            <div className="space-y-3">
              {reservas.map((res, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-black text-amber-500">{res.numero_pedido}</span>
                      <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-500 uppercase">{res.status_pedido.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-xs text-gray-300 font-medium">{res.nome_vendedor}</div>
                    <div className="text-[10px] text-gray-600 mt-1">{formatDate(res.data)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-white">{res.quantidade}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider text-right">reservado</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-background border border-white/5 text-gray-400 font-bold hover:text-white transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
