import { formatDate } from './format';
import { TipoDesconto } from '@/models/types';

interface PrintData {
  numero_pedido?: string;
  id?: string;
  data_agendamento?: string;
  data_criacao?: string;
  created_at?: string;
  nome_cliente?: string;
  telefone_cliente?: string;
  endereco_entrega?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  nome_vendedor?: string;
  codigo_vendedor?: number;
  forma_pagamento: string;
  valor_total: number;
  desconto_aplicado?: number;
  observacoes?: string | null;
  itens?: {
    produto?: { nome_produto: string; codigo_produto?: string | number };
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
    desconto_aplicado?: number;
  }[];
}

export function printSummary(data: PrintData, type: 'pedido' | 'agendamento') {
  const isAgendamento = type === 'agendamento';
  const docTitle = isAgendamento ? 'Resumo de Agendamento' : 'Resumo de Pedido';
  const docNumber = data.numero_pedido ? `#${data.numero_pedido}` : `#${data.id?.substring(0, 8).toUpperCase()}`;

  let dateStr = '';
  if (isAgendamento && data.data_agendamento) {
    const dateObj = new Date(data.data_agendamento);
    dateStr = `${dateObj.toLocaleDateString('pt-BR')} ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    dateStr = formatDate(data.data_criacao || data.created_at || '');
  }

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir o resumo.');
    return;
  }

  const itemsHtml = data.itens?.map(item => {
    const desc = item.produto?.nome_produto || '—';
    const descAplicado = item.desconto_aplicado && item.desconto_aplicado > 0 
      ? `- R$ ${item.desconto_aplicado.toFixed(2)}` 
      : 'R$ 0,00';
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${desc}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantidade}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${item.preco_unitario.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: #555;">${descAplicado}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${item.subtotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" style="text-align:center; padding: 8px;">Nenhum item encontrado</td></tr>';

  const totalBruto = data.valor_total + (data.desconto_aplicado || 0);
  const totalDescontos = data.desconto_aplicado || 0;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docTitle} ${docNumber}</title>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          color: #333;
          font-size: 14px;
          line-height: 1.5;
        }
        .header {
          border-bottom: 2px solid #0066FF;
          padding-bottom: 20px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #0066FF;
          margin: 0 0 5px 0;
        }
        .company-sub {
          font-size: 12px;
          color: #666;
          margin: 0;
        }
        .doc-details {
          text-align: right;
        }
        .doc-title {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 5px 0;
          color: #333;
        }
        .doc-number {
          font-size: 16px;
          font-weight: bold;
          color: #666;
        }
        .section {
          margin-bottom: 20px;
        }
        .section-title {
          font-size: 12px;
          font-weight: bold;
          color: #666;
          text-transform: uppercase;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .info-block label {
          font-size: 11px;
          color: #888;
          display: block;
          text-transform: uppercase;
        }
        .info-block span {
          font-weight: bold;
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 13px;
        }
        th {
          background-color: #f8f9fa;
          padding: 8px;
          font-weight: bold;
          text-transform: uppercase;
          font-size: 11px;
          color: #666;
          border-bottom: 2px solid #ddd;
        }
        .totals-container {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .totals-table {
          width: 300px;
        }
        .totals-table td {
          padding: 6px 8px;
        }
        .observations {
          background-color: #f8f9fa;
          border: 1px dashed #ddd;
          padding: 15px;
          border-radius: 6px;
          font-style: italic;
          margin-top: 20px;
        }
        @media print {
          body {
            margin: 20px;
          }
          button {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="company-name">BRYZA</h1>
          <p class="company-sub">SISTEMA DE GESTÃO VERSÃO 1.0</p>
        </div>
        <div class="doc-details">
          <h2 class="doc-title">${docTitle}</h2>
          <span class="doc-number">${docNumber}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Informações Gerais</div>
        <div class="grid">
          <div>
            <div class="info-block" style="margin-bottom: 8px;">
              <label>Cliente</label>
              <span>${data.nome_cliente || '—'}</span>
            </div>
            <div class="info-block">
              <label>Telefone</label>
              <span>${data.telefone_cliente || '—'}</span>
            </div>
          </div>
          <div>
            <div class="info-block" style="margin-bottom: 8px;">
              <label>Data / Hora</label>
              <span>${dateStr}</span>
            </div>
            <div class="info-block" style="margin-bottom: 8px;">
              <label>Vendedor</label>
              <span>${data.nome_vendedor || '—'}</span>
            </div>
            <div class="info-block">
              <label>Forma de Pagamento</label>
              <span>${data.forma_pagamento.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      ${data.endereco_entrega ? `
      <div class="section">
        <div class="section-title">Endereço de Entrega</div>
        <div class="info-block">
          <span>
            ${data.endereco_entrega}
            ${data.bairro ? `, ${data.bairro}` : ''}
            ${data.cidade ? ` - ${data.cidade}` : ''}
            ${data.estado ? `/${data.estado}` : ''}
            ${data.cep ? ` (CEP: ${data.cep})` : ''}
          </span>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Itens do Documento</div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Descrição do Produto</th>
              <th style="text-align: center; width: 60px;">Qtd</th>
              <th style="text-align: right; width: 100px;">Unitário</th>
              <th style="text-align: right; width: 100px;">Desconto</th>
              <th style="text-align: right; width: 120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div class="totals-container">
        <table class="totals-table">
          <tr>
            <td style="color: #666;">Total Bruto</td>
            <td style="text-align: right; font-weight: bold;">R$ ${totalBruto.toFixed(2)}</td>
          </tr>
          ${totalDescontos > 0 ? `
          <tr>
            <td style="color: #0066FF;">Descontos</td>
            <td style="text-align: right; font-weight: bold; color: #0066FF;">- R$ ${totalDescontos.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 1px solid #ddd; font-size: 16px;">
            <td style="font-weight: bold;">Valor Líquido</td>
            <td style="text-align: right; font-weight: bold; color: #0066FF;">R$ ${data.valor_total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${data.observacoes ? `
      <div class="observations">
        <strong>Observações:</strong>
        <p style="margin: 5px 0 0 0; white-space: pre-wrap;">${data.observacoes}</p>
      </div>
      ` : ''}

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
