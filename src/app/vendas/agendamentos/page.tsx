import { getAgendamentosAction } from './actions';
import AgendamentoClientPage from './AgendamentoClientPage';

export const revalidate = 0;

export default async function AgendamentosPage() {
  const agendamentos = await getAgendamentosAction();

  return <AgendamentoClientPage initialAgendamentos={agendamentos} />;
}
