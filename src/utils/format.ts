/**
 * Formata um valor numérico para o padrão de moeda brasileiro (R$).
 */
export function formatCurrency(value: number | string): string {
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(amount)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

/**
 * Formata uma string de data (ISO ou timestamp) para o padrão brasileiro (DD/MM/AAAA HH:mm).
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '---';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Data inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

/**
 * Formata uma data curta (apenas DD/MM).
 */
export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}
