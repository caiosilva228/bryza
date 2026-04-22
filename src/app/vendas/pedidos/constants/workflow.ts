import { StatusPedido } from '@/models/types';

export const statusConfig: Record<StatusPedido, { label: string; color: string; bg: string; icon: string }> = {
  aguardando_preparacao: { label: 'Em Preparação', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: 'schedule' },
  pronto_para_entrega: { label: 'Pronto p/ Entrega', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', icon: 'package' },
  em_rota: { label: 'Em Rota', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: 'local_shipping' },
  entregue: { label: 'Entregue', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: 'check_circle' },
  finalizado: { label: 'Finalizado', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', icon: 'done_all' },
  cancelado: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: 'cancel' },
};

export const statusWorkflow: Record<StatusPedido, { 
  label: string; 
  next: StatusPedido | null; 
  actionLabel: string; 
  color: string; 
}> = {
  aguardando_preparacao: { 
    label: 'AGUARDANDO PREPARAÇÃO', 
    next: 'pronto_para_entrega', 
    actionLabel: 'MARCAR COMO PRONTO', 
    color: '#3b82f6'
  },
  pronto_para_entrega: { 
    label: 'PRONTO PARA ENTREGA', 
    next: 'em_rota', 
    actionLabel: 'SAIR PARA ENTREGA', 
    color: '#6366f1'
  },
  em_rota: { 
    label: 'EM ROTA DE ENTREGA', 
    next: 'entregue', 
    actionLabel: 'CONFIRMAR ENTREGA', 
    color: '#f59e0b'
  },
  entregue: { 
    label: 'ENTREGUE', 
    next: 'finalizado', 
    actionLabel: 'FINALIZAR VENDA', 
    color: '#10b981'
  },
  finalizado: { 
    label: 'FINALIZADO', 
    next: null, 
    actionLabel: '', 
    color: '#94a3b8'
  },
  cancelado: { 
    label: 'CANCELADO', 
    next: null, 
    actionLabel: '', 
    color: '#ef4444'
  },
};
