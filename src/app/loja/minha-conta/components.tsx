import Link from 'next/link';
import styles from './account.module.css';
import type {
  CustomerAccountSummary,
  CustomerOrderDetail,
  CustomerOrderSummary,
  OrderStatus,
  PaymentStatus,
} from './types';
import { CustomerTransparentPayment } from './CustomerTransparentPayment';
import { SavedCardsPanel } from './SavedCardsPanel';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateOnly = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
});

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return 'A definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'A definir';
  return includeTime ? dateTime.format(date) : dateOnly.format(date);
}

const orderLabels: Record<OrderStatus, string> = {
  recebido: 'Pedido recebido',
  confirmado: 'Confirmado',
  em_separacao: 'Em separação',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  problema_na_entrega: 'Problema na entrega',
};

const paymentLabels: Record<PaymentStatus, string> = {
  nao_iniciado: 'Pagamento não iniciado',
  pendente: 'Pagamento pendente',
  aprovado: 'Pagamento aprovado',
  rejeitado: 'Pagamento rejeitado',
  expirado: 'Pagamento expirado',
  reembolsado: 'Pagamento reembolsado',
  chargeback: 'Pagamento contestado',
};

function statusClass(status: OrderStatus | PaymentStatus) {
  if (['entregue', 'aprovado'].includes(status)) return styles.statusGreen;
  if (['confirmado', 'em_separacao', 'saiu_para_entrega'].includes(status)) return styles.statusBlue;
  if (['recebido', 'pendente', 'nao_iniciado'].includes(status)) return styles.statusAmber;
  if (['cancelado', 'problema_na_entrega', 'rejeitado', 'chargeback'].includes(status)) return styles.statusRed;
  return styles.statusGray;
}

export function Breadcrumb({
  detail,
}: {
  detail?: string;
}) {
  return (
    <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
      <Link href="/loja">Loja</Link>
      <span aria-hidden="true">/</span>
      <Link href="/loja/minha-conta">Minha conta</Link>
      {detail ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href="/loja/minha-conta/pedidos">Pedidos</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{detail}</span>
        </>
      ) : null}
    </nav>
  );
}

function StatusBadges({ order }: { order: CustomerOrderSummary }) {
  return (
    <div className={styles.statusRow} aria-label="Status do pedido e pagamento">
      <span className={`${styles.statusBadge} ${statusClass(order.orderStatus)}`}>
        <span className="material-symbols-outlined" aria-hidden="true">local_shipping</span>
        {orderLabels[order.orderStatus]}
      </span>
      <span className={`${styles.statusBadge} ${statusClass(order.paymentStatus)}`}>
        <span className="material-symbols-outlined" aria-hidden="true">payments</span>
        {paymentLabels[order.paymentStatus]}
      </span>
    </div>
  );
}

export function OrderCard({ order }: { order: CustomerOrderSummary }) {
  return (
    <article className={styles.orderCard}>
      <div>
        <div className={styles.orderCardTop}>
          <div>
            <h2 className={styles.orderNumber}>Pedido #{order.orderNumber}</h2>
            <time className={styles.orderDate} dateTime={order.createdAt}>
              Realizado em {formatDate(order.createdAt)}
            </time>
          </div>
        </div>

        <StatusBadges order={order} />

        <div className={styles.orderMeta}>
          <span className={styles.metaItem}>
            <span className="material-symbols-outlined" aria-hidden="true">event</span>
            Entrega: {formatDate(order.scheduledFor)}
          </span>
          {order.itemCount > 0 ? (
            <span className={styles.metaItem}>
              <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
              {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'}
            </span>
          ) : null}
          <span className={styles.metaItem}>
            <span className="material-symbols-outlined" aria-hidden="true">account_balance_wallet</span>
            {order.paymentChoice === 'agora' ? 'Pagamento online' : 'Pagamento na entrega'}
          </span>
        </div>
      </div>

      <div className={styles.orderAside}>
        <div>
          <strong>{currency.format(order.total)}</strong>
          <small>Valor total</small>
        </div>
        <Link
          className={order.canPayNow ? styles.primaryButton : styles.secondaryButton}
          href={`/loja/minha-conta/pedidos/${encodeURIComponent(order.id)}`}
        >
          {order.canPayNow ? 'Ver e pagar' : 'Ver detalhes'}
          <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
    </article>
  );
}

export function EmptyOrders() {
  return (
    <section className={styles.emptyState}>
      <span className={styles.emptyIcon}>
        <span className="material-symbols-outlined" aria-hidden="true">shopping_bag</span>
      </span>
      <h2>Nenhum pedido por aqui ainda</h2>
      <p>
        Quando você fizer uma compra, o acompanhamento da entrega e do pagamento
        aparecerá nesta área.
      </p>
      <Link className={styles.primaryButton} href="/loja">
        Conhecer produtos
        <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
      </Link>
    </section>
  );
}

export function AccountNotLinked() {
  return (
    <>
      <Breadcrumb />
      <section className={styles.emptyState}>
        <span className={styles.emptyIcon}>
          <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
        </span>
        <span className={styles.eyebrow}>Conta criada com segurança</span>
        <h1>Vamos reconhecer suas compras</h1>
        <p>
          Seu acesso já está ativo. Na sua próxima compra, informe o mesmo CPF e
          telefone usados anteriormente para vincular seus pedidos sem criar um
          cliente duplicado.
        </p>
        <Link className={styles.primaryButton} href="/loja">
          Ir para a loja
          <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
        </Link>
      </section>
    </>
  );
}

export function AccountDashboard({ summary }: { summary: CustomerAccountSummary }) {
  return (
    <>
      <Breadcrumb />
      <div className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}>Minha conta</span>
          <h1>Olá, {summary.customerName.split(' ')[0] || 'cliente'}!</h1>
          <p>
            Acompanhe seus pedidos, confira pagamentos e saiba o próximo passo de
            cada entrega.
          </p>
        </div>
        <Link className={styles.primaryButton} href="/loja">
          Fazer novo pedido
          <span className="material-symbols-outlined" aria-hidden="true">add_shopping_cart</span>
        </Link>
      </div>

      <section className={styles.statsGrid} aria-label="Resumo da conta">
        <div className={styles.statCard}>
          <span className={styles.statIcon}>
            <span className="material-symbols-outlined" aria-hidden="true">local_shipping</span>
          </span>
          <strong>{summary.activeOrders}</strong>
          <span>Entregas em andamento</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>
            <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
          </span>
          <strong>{summary.pendingPayments}</strong>
          <span>Pagamentos pendentes</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>
            <span className="material-symbols-outlined" aria-hidden="true">receipt_long</span>
          </span>
          <strong>{summary.deliveredOrders}</strong>
          <span>Pedidos no histórico</span>
        </div>
      </section>

      <div className={styles.dashboardGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Pedidos recentes</h2>
              <p>Entrega e pagamento são acompanhados separadamente.</p>
            </div>
            <Link className={styles.textButton} href="/loja/minha-conta/pedidos">
              Ver todos
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
          {summary.recentOrders.length > 0 ? (
            <div className={styles.ordersList}>
              {summary.recentOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <EmptyOrders />
          )}
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Acesso rápido</h2>
              <p>O que você deseja fazer?</p>
            </div>
          </div>
          <div className={styles.quickLinks}>
            <Link className={styles.quickLink} href="/loja/minha-conta/pedidos">
              <span className={styles.quickLinkIcon}>
                <span className="material-symbols-outlined" aria-hidden="true">package_2</span>
              </span>
              <span>
                <strong>Meus pedidos</strong>
                <small>Acompanhar entregas</small>
              </span>
            </Link>
            <Link className={styles.quickLink} href="/loja">
              <span className={styles.quickLinkIcon}>
                <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
              </span>
              <span>
                <strong>Comprar novamente</strong>
                <small>Voltar ao catálogo</small>
              </span>
            </Link>
          </div>
        </aside>
      </div>
      <SavedCardsPanel />
    </>
  );
}

export function OrdersPageView({
  orders,
  activeFilter,
}: {
  orders: CustomerOrderSummary[];
  activeFilter: string;
}) {
  const filters = [
    ['todos', 'Todos'],
    ['ativos', 'Em andamento'],
    ['pagamento_pendente', 'Pagamento pendente'],
    ['entregues', 'Entregues'],
  ];

  return (
    <>
      <Breadcrumb />
      <div className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}>Histórico</span>
          <h1>Meus pedidos</h1>
          <p>
            Consulte o andamento da entrega e a situação do pagamento de cada
            pedido.
          </p>
        </div>
        <Link className={styles.primaryButton} href="/loja">
          Novo pedido
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
        </Link>
      </div>

      <nav className={styles.filters} aria-label="Filtrar pedidos">
        {filters.map(([value, label]) => (
          <Link
            key={value}
            className={`${styles.filterChip} ${
              activeFilter === value ? styles.filterChipActive : ''
            }`}
            href={value === 'todos'
              ? '/loja/minha-conta/pedidos'
              : `/loja/minha-conta/pedidos?status=${value}`}
            aria-current={activeFilter === value ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {orders.length > 0 ? (
        <div className={styles.ordersList}>
          {orders.map((order) => <OrderCard key={order.id} order={order} />)}
        </div>
      ) : (
        <EmptyOrders />
      )}
    </>
  );
}

export function OrderDetailView({ order }: { order: CustomerOrderDetail }) {
  const [entityType, entityId] = order.id.split(':');
  return (
    <>
      <Breadcrumb detail={`Pedido #${order.orderNumber}`} />
      <div className={styles.detailHeader}>
        <div>
          <span className={styles.eyebrow}>Detalhes do pedido</span>
          <h1>Pedido #{order.orderNumber}</h1>
          <div className={styles.detailMeta}>
            <span>Realizado em {formatDate(order.createdAt, true)}</span>
            <span>•</span>
            <span>Entrega {formatDate(order.scheduledFor)}</span>
          </div>
          <StatusBadges order={order} />
        </div>
        <Link className={styles.secondaryButton} href="/loja/minha-conta/pedidos">
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          Voltar aos pedidos
        </Link>
      </div>

      {order.paymentStatus === 'pendente' ? (
        <div className={styles.notice} role="status">
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <div>
            <strong>
              {order.paymentChoice === 'na_entrega'
                ? 'Pagamento previsto para a entrega'
                : 'Pagamento aguardando confirmação'}
            </strong>
            <span>
              {order.canPayNow
                ? 'Você pode concluir o pagamento online nesta página.'
                : 'Você pode acompanhar a atualização do pagamento nesta página.'}
            </span>
          </div>
        </div>
      ) : null}

      <div className={styles.detailColumns}>
        <div className={styles.detailMain}>
          <section className={styles.detailCard}>
            <h2>Itens do pedido</h2>
            <div className={styles.itemsList}>
              {order.items.map((item) => (
                <div className={styles.itemRow} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.quantity} × {currency.format(item.unitPrice)}
                    </small>
                  </div>
                  <strong>{currency.format(item.total)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.detailCard}>
            <h2>Acompanhamento</h2>
            <div className={styles.timeline}>
              {order.timeline.map((event) => (
                <div className={styles.timelineItem} key={event.id}>
                  <span
                    className={`${styles.timelineDot} ${
                      event.completed ? styles.timelineDotDone : ''
                    }`}
                    aria-hidden="true"
                  />
                  <div className={styles.timelineContent}>
                    <strong>{event.label}{event.current ? ' — etapa atual' : ''}</strong>
                    <span>
                      {event.description}
                      {event.occurredAt ? ` · ${formatDate(event.occurredAt, true)}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.detailAside}>
          <section className={styles.detailCard}>
            <h2>Resumo</h2>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span>Produtos</span>
                <span>{currency.format(order.subtotal)}</span>
              </div>
              {order.discount > 0 ? (
                <div className={styles.summaryRow}>
                  <span>Descontos</span>
                  <span>− {currency.format(order.discount)}</span>
                </div>
              ) : null}
              <div className={styles.summaryRow}>
                <span>Entrega</span>
                <span>{order.deliveryFee > 0 ? currency.format(order.deliveryFee) : 'Grátis'}</span>
              </div>
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span>{currency.format(order.total)}</span>
              </div>
            </div>
          </section>

          {order.address ? (
            <section className={styles.detailCard}>
              <h2>Endereço de entrega</h2>
              <address className={styles.address}>
                {order.address.street}
                {order.address.number ? `, ${order.address.number}` : ''}
                <br />
                {[order.address.neighborhood, order.address.city, order.address.state]
                  .filter(Boolean)
                  .join(' · ')}
                {order.address.zipCode ? <><br />CEP {order.address.zipCode}</> : null}
              </address>
            </section>
          ) : null}

          <section className={styles.detailCard}>
            <h2>Próximos passos</h2>
            <div className={styles.actions}>
              {order.canPayNow ? (
                <CustomerTransparentPayment
                  entityType={entityType === 'pedido' ? 'pedido' : 'agendamento'}
                  entityId={entityId}
                  amount={order.total}
                  orderNumber={order.orderNumber}
                />
              ) : null}
              <Link className={styles.secondaryButton} href="/loja">
                <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                Comprar novamente
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function LoadingView() {
  return (
    <div aria-busy="true" aria-label="Carregando sua conta">
      <div className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonBreadcrumb}`} />
      <div className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonHeading}`} />
      <div className={styles.statsGrid}>
        {[0, 1, 2].map((item) => (
          <div key={item} className={`${styles.skeleton} ${styles.skeletonCard}`} />
        ))}
      </div>
      <div className={styles.ordersList}>
        {[0, 1].map((item) => (
          <div key={item} className={`${styles.skeleton} ${styles.orderCard} ${styles.skeletonOrder}`} />
        ))}
      </div>
    </div>
  );
}
