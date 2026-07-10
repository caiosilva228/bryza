import { getAgendamentosAction } from './actions';
import AgendamentoClientPage from './AgendamentoClientPage';
import { MainLayout } from '@/components/layout/MainLayout';

export const revalidate = 0;

export default async function AgendamentosPage() {
  const agendamentos = await getAgendamentosAction();

  return (
    <MainLayout>
      <div className="page-wrapper">
        <AgendamentoClientPage initialAgendamentos={agendamentos} />
      </div>
    </MainLayout>
  );
}
