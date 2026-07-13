import { getAgendamentosAction } from './actions';
import AgendamentoClientPage from './AgendamentoClientPage';
import { MainLayout } from '@/components/layout/MainLayout';
import { getClientes } from '@/services/clientes';
import { getProdutos } from '@/services/produtos';
import { getVendedores } from '@/services/profiles';

export const revalidate = 0;

export default async function AgendamentosPage() {
  const [agendamentos, clientes, produtos, vendedores] = await Promise.all([
    getAgendamentosAction(),
    getClientes(),
    getProdutos(),
    getVendedores(),
  ]);

  return (
    <MainLayout>
      <div className="page-wrapper">
        <AgendamentoClientPage 
          initialAgendamentos={agendamentos} 
          clientes={clientes}
          produtos={produtos}
          vendedores={vendedores}
        />
      </div>
    </MainLayout>
  );
}
