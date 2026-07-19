'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveAmbassadorProgramSettings } from './actions';
import type { CommissionLevelConfig, ProgramSettingsData, ProgramSettingsInput } from './actions';
import styles from './settings.module.css';

const MAX_LEVELS = 10;

type Props = { initialSettings: ProgramSettingsData };
type FieldError = { field: string; message: string };

function normalizeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function inputNumber(element: HTMLInputElement) {
  return Number.isFinite(element.valueAsNumber) ? element.valueAsNumber : 0;
}

function validate(settings: ProgramSettingsInput): FieldError | null {
  if (settings.referralAttributionDays < 1 || settings.referralAttributionDays > 3650) {
    return { field: 'referralAttributionDays', message: 'A validade da indicação deve ficar entre 1 e 3.650 dias.' };
  }
  if (settings.monthlyActivationAmount < 0 || (settings.monthlyActivationEnabled && settings.monthlyActivationAmount <= 0)) {
    return { field: 'monthlyActivationAmount', message: 'Informe um valor maior que zero para a ativação mensal.' };
  }
  if (settings.activationGraceDays < 0 || settings.activationGraceDays > 90) {
    return { field: 'activationGraceDays', message: 'A tolerância deve ficar entre 0 e 90 dias.' };
  }
  if (settings.firstPurchaseBonusEnabled && settings.firstPurchaseMinimumAmount <= 0) {
    return { field: 'firstPurchaseMinimumAmount', message: 'Informe um valor mínimo maior que zero para a primeira compra.' };
  }
  if (settings.firstPurchaseBonusEnabled && settings.firstPurchaseBonusAmount <= 0) {
    return { field: 'firstPurchaseBonusAmount', message: 'Informe um bônus fixo maior que zero para a primeira compra.' };
  }
  if (settings.firstPurchaseMinimumAmount < 0 || settings.firstPurchaseBonusAmount < 0) {
    return { field: 'firstPurchaseMinimumAmount', message: 'Os valores do bônus da primeira compra não podem ser negativos.' };
  }
  if (settings.minimumPaymentAmount < 0) {
    return { field: 'minimumPaymentAmount', message: 'O pagamento mínimo não pode ser negativo.' };
  }
  if (settings.referralDestinationUrl) {
    try {
      const url = new URL(settings.referralDestinationUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocolo inválido');
    } catch { return { field: 'referralDestinationUrl', message: 'Informe uma URL HTTP ou HTTPS válida.' }; }
  }
  if (settings.defaultPlan.levels.length < 1 || settings.defaultPlan.levels.length > MAX_LEVELS) {
    return { field: 'levels', message: `Configure entre 1 e ${MAX_LEVELS} níveis.` };
  }
  const invalidLevel = settings.defaultPlan.levels.find((level) => level.percentage < 0 || level.percentage > 100);
  if (invalidLevel) return { field: 'levels', message: `A porcentagem do nível ${invalidLevel.level_number} deve ficar entre 0% e 100%.` };
  if (!settings.defaultPlan.levels[0].enabled || settings.defaultPlan.levels[0].percentage <= 0) {
    return { field: 'levels', message: 'O nível 1 deve estar ativo e possuir percentual maior que zero.' };
  }
  if (settings.defaultPlan.levels.some((level, index) => index > 0 && level.enabled && !settings.defaultPlan.levels[index - 1].enabled)) {
    return { field: 'levels', message: 'Os níveis ativos devem ser sequenciais, sem intervalos.' };
  }
  const total = settings.defaultPlan.levels.filter((level) => level.enabled).reduce((sum, level) => sum + level.percentage, 0);
  if (total > 100) return { field: 'levels', message: 'A soma dos níveis ativos não pode ultrapassar 100%.' };
  if (!settings.defaultPlan.name.trim()) return { field: 'planName', message: 'Informe um nome para o plano de comissões.' };
  return null;
}

export function ProgramSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState<ProgramSettingsInput>(() => structuredClone(initialSettings));
  const [isPending, startTransition] = useTransition();

  const enabledCommissionTotal = useMemo(
    () => settings.defaultPlan.levels.filter((level) => level.enabled).reduce((sum, level) => sum + normalizeNumber(level.percentage), 0),
    [settings.defaultPlan.levels],
  );

  const update = <K extends keyof ProgramSettingsInput>(field: K, value: ProgramSettingsInput[K]) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const updatePlan = <K extends keyof ProgramSettingsInput['defaultPlan']>(field: K, value: ProgramSettingsInput['defaultPlan'][K]) => {
    setSettings((current) => ({ ...current, defaultPlan: { ...current.defaultPlan, [field]: value } }));
  };

  const updateLevel = (index: number, values: Partial<CommissionLevelConfig>) => {
    const levels = settings.defaultPlan.levels.map((level, levelIndex) => levelIndex === index ? { ...level, ...values } : level);
    updatePlan('levels', levels);
  };

  const addLevel = () => {
    if (settings.defaultPlan.levels.length >= MAX_LEVELS) {
      toast.error(`O limite é de ${MAX_LEVELS} níveis.`);
      return;
    }
    const levelNumber = settings.defaultPlan.levels.length + 1;
    updatePlan('levels', [...settings.defaultPlan.levels, { level_number: levelNumber, name: `Nível ${levelNumber}`, percentage: 0, enabled: true }]);
  };

  const removeLevel = (index: number) => {
    if (settings.defaultPlan.levels.length === 1) {
      toast.error('O plano precisa ter pelo menos um nível.');
      return;
    }
    const levels = settings.defaultPlan.levels
      .filter((_, levelIndex) => levelIndex !== index)
      .map((level, levelIndex) => ({ ...level, level_number: levelIndex + 1, name: level.name || `Nível ${levelIndex + 1}` }));
    updatePlan('levels', levels);
  };

  const restore = () => {
    setSettings(structuredClone(initialSettings));
    toast.info('Alterações não salvas foram descartadas.');
  };

  const submit = () => {
    const normalized: ProgramSettingsInput = {
      ...settings,
      referralAttributionDays: normalizeNumber(settings.referralAttributionDays),
      monthlyActivationAmount: normalizeNumber(settings.monthlyActivationAmount),
      activationGraceDays: normalizeNumber(settings.activationGraceDays),
      firstPurchaseMinimumAmount: normalizeNumber(settings.firstPurchaseMinimumAmount),
      firstPurchaseBonusAmount: normalizeNumber(settings.firstPurchaseBonusAmount),
      minimumPaymentAmount: normalizeNumber(settings.minimumPaymentAmount),
      referralDestinationUrl: settings.referralDestinationUrl.trim(),
      whatsappNumber: settings.whatsappNumber.trim(),
      whatsappMessageTemplate: settings.whatsappMessageTemplate.trim(),
      defaultPlan: {
        ...settings.defaultPlan,
        name: settings.defaultPlan.name.trim(),
        levels: settings.defaultPlan.levels.map((level, index) => ({
          ...level,
          level_number: index + 1,
          name: level.name.trim() || `Nível ${index + 1}`,
          percentage: normalizeNumber(level.percentage),
        })),
      },
    };
    const error = validate(normalized);
    if (error) {
      toast.error(error.message);
      document.querySelector<HTMLElement>(`[data-field="${error.field}"]`)?.focus();
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveAmbassadorProgramSettings(normalized);
        if (!result.success) {
          toast.error('Não foi possível salvar as configurações.');
          return;
        }
        setSettings(normalized);
        toast.success('Configurações do programa salvas com sucesso.');
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Não foi possível salvar as configurações.');
      }
    });
  };

  return (
    <div className={styles.workspace}>
      <aside className={styles.sectionNav} aria-label="Seções das configurações">
        <a href="#geral"><span className="material-symbols-outlined">tune</span><span>Configurações gerais</span></a>
        <a href="#ativacao"><span className="material-symbols-outlined">verified_user</span><span>Ativação mensal</span></a>
        <a href="#primeira-compra"><span className="material-symbols-outlined">redeem</span><span>Bônus da primeira compra</span></a>
        <a href="#comissoes"><span className="material-symbols-outlined">account_tree</span><span>Níveis e comissões</span></a>
        <a href="#pagamentos"><span className="material-symbols-outlined">payments</span><span>Pagamentos e Pix</span></a>
        <a href="#indicacoes"><span className="material-symbols-outlined">link</span><span>Indicações e contato</span></a>
      </aside>

      <div className={styles.content}>
        <section className={styles.card} id="geral">
          <SectionHeading icon="settings" title="Configurações gerais" description="Controle a disponibilidade e as regras principais do programa." />
          <div className={styles.gridTwo}>
            <Field label="Status do programa" hint="Pausar impede novas operações sem apagar o histórico.">
              <select value={settings.programStatus} onChange={(event) => update('programStatus', event.target.value as ProgramSettingsInput['programStatus'])}>
                <option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="encerrado">Encerrado</option>
              </select>
            </Field>
            <Field label="Validade da atribuição" hint="Período em que o link mantém a indicação vinculada.">
              <div className={styles.suffixedInput}><input data-field="referralAttributionDays" type="number" min={1} max={3650} value={settings.referralAttributionDays} onChange={(event) => update('referralAttributionDays', inputNumber(event.currentTarget))} /><span>dias</span></div>
            </Field>
          </div>
        </section>

        <section className={styles.card} id="ativacao">
          <SectionHeading icon="verified_user" title="Ativação mensal" description="Cadastre o requisito mensal previsto para a operação do programa." action={<Switch checked={settings.monthlyActivationEnabled} onChange={(checked) => update('monthlyActivationEnabled', checked)} label="Configurar ativação mensal" />} />
          <div className={`${styles.gridThree} ${!settings.monthlyActivationEnabled ? styles.disabledArea : ''}`} aria-disabled={!settings.monthlyActivationEnabled}>
            <Field label="Valor mínimo mensal" hint="Movimentação mínima exigida no ciclo."><div className={styles.prefixedInput}><span>R$</span><input data-field="monthlyActivationAmount" type="number" min={0} step="0.01" disabled={!settings.monthlyActivationEnabled} value={settings.monthlyActivationAmount} onChange={(event) => update('monthlyActivationAmount', inputNumber(event.currentTarget))} /></div></Field>
            <Field label="Base da ativação" hint="Origem usada para validar o requisito."><select disabled={!settings.monthlyActivationEnabled} value={settings.activationBasis} onChange={(event) => update('activationBasis', event.target.value as ProgramSettingsInput['activationBasis'])}><option value="vendas_pessoais">Vendas pessoais</option><option value="compras_pessoais">Compras pessoais</option></select></Field>
            <Field label="Período de tolerância" hint="Dias adicionais após o fechamento do ciclo."><div className={styles.suffixedInput}><input data-field="activationGraceDays" type="number" min={0} max={90} disabled={!settings.monthlyActivationEnabled} value={settings.activationGraceDays} onChange={(event) => update('activationGraceDays', inputNumber(event.currentTarget))} /><span>dias</span></div></Field>
          </div>
          <div className={styles.infoStrip}><span className="material-symbols-outlined">info</span><p>A regra fica cadastrada para aplicação operacional. Comissões já registradas não são recalculadas.</p></div>
        </section>

        <section className={styles.card} id="primeira-compra">
          <SectionHeading
            icon="redeem"
            title="Bônus da primeira compra"
            description="Premie o indicador uma única vez quando um novo cliente atingir o valor mínimo na primeira compra."
            action={<Switch checked={settings.firstPurchaseBonusEnabled} onChange={(checked) => update('firstPurchaseBonusEnabled', checked)} label="Ativar bônus" />}
          />
          <div className={`${styles.gridTwo} ${!settings.firstPurchaseBonusEnabled ? styles.disabledArea : ''}`} aria-disabled={!settings.firstPurchaseBonusEnabled}>
            <Field label="Valor mínimo da primeira compra" hint="A primeira compra precisa atingir este valor para liberar o bônus.">
              <div className={styles.prefixedInput}><span>R$</span><input data-field="firstPurchaseMinimumAmount" type="number" min={0} step="0.01" disabled={!settings.firstPurchaseBonusEnabled} value={settings.firstPurchaseMinimumAmount} onChange={(event) => update('firstPurchaseMinimumAmount', inputNumber(event.currentTarget))} /></div>
            </Field>
            <Field label="Bônus fixo ao indicador" hint="Valor pago ao embaixador que indicou o novo cliente.">
              <div className={styles.prefixedInput}><span>R$</span><input data-field="firstPurchaseBonusAmount" type="number" min={0} step="0.01" disabled={!settings.firstPurchaseBonusEnabled} value={settings.firstPurchaseBonusAmount} onChange={(event) => update('firstPurchaseBonusAmount', inputNumber(event.currentTarget))} /></div>
            </Field>
          </div>
          <div className={styles.infoStrip}><span className="material-symbols-outlined">info</span><p>O bônus é concedido somente na primeira compra elegível, entregue e com pagamento confirmado. Pedidos cancelados, pendentes ou abaixo do mínimo não consomem o benefício; depois da bonificação, ele não se repete.</p></div>
        </section>

        <section className={styles.card} id="comissoes">
          <SectionHeading icon="account_tree" title="Níveis e comissões" description="Expanda a rede com níveis configuráveis e percentuais independentes." />
          <div className={styles.planBar}>
            <Field label="Selecione o plano">
              <select
                value={settings.defaultPlan.id}
                onChange={(event) => {
                  const planId = event.target.value;
                  if (planId === 'new') {
                    setSettings((current) => ({
                      ...current,
                      defaultPlan: {
                        id: 'new',
                        name: 'Novo Plano de Comissões',
                        commissionBase: 'valor_final',
                        levels: [
                          { level_number: 1, name: 'Nível 1', percentage: 5, enabled: true },
                        ],
                      },
                    }));
                  } else {
                    const selected = (initialSettings.plans || []).find((p) => p.id === planId);
                    if (selected) {
                      setSettings((current) => ({
                        ...current,
                        defaultPlan: structuredClone(selected),
                      }));
                    }
                  }
                }}
              >
                {(initialSettings.plans || []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
                <option value="new">+ Criar novo plano...</option>
              </select>
            </Field>
            <Field label="Nome do plano">
              <input
                data-field="planName"
                value={settings.defaultPlan.name}
                maxLength={80}
                onChange={(event) => updatePlan('name', event.target.value)}
                placeholder="Ex: Embaixador Ouro"
              />
            </Field>
            <Field label="Base de cálculo"><select value={settings.defaultPlan.commissionBase} onChange={(event) => updatePlan('commissionBase', event.target.value as ProgramSettingsInput['defaultPlan']['commissionBase'])}><option value="valor_final">Valor final da venda</option><option value="valor_bruto">Valor bruto</option><option value="valor_liquido">Valor líquido</option></select></Field>
            <div className={styles.commissionTotal}><small>Total dos níveis ativos</small><strong className={enabledCommissionTotal > 100 ? styles.totalDanger : ''}>{enabledCommissionTotal.toFixed(2).replace('.', ',')}%</strong><span>Limite combinado: 100%</span></div>
          </div>

          <div className={styles.levelList} data-field="levels" tabIndex={-1}>
            {settings.defaultPlan.levels.map((level, index) => (
              <article className={`${styles.levelRow} ${!level.enabled ? styles.levelDisabled : ''}`} key={level.id || `new-${index}`}>
                <div className={styles.levelNumber}>{index + 1}</div>
                <label className={styles.levelName}><span>Identificação</span><input value={level.name} maxLength={40} onChange={(event) => updateLevel(index, { name: event.target.value })} /></label>
                <label className={styles.levelPercentage}><span>Comissão</span><div className={styles.suffixedInput}><input type="number" min={0} max={100} step="0.01" value={level.percentage} onChange={(event) => updateLevel(index, { percentage: inputNumber(event.currentTarget) })} /><span>%</span></div></label>
                <Switch checked={level.enabled} onChange={(checked) => updateLevel(index, { enabled: checked })} label={level.enabled ? 'Ativo' : 'Inativo'} compact />
                <button className={styles.removeButton} type="button" onClick={() => removeLevel(index)} aria-label={`Remover nível ${index + 1}`} title="Remover nível"><span className="material-symbols-outlined">delete</span></button>
              </article>
            ))}
          </div>
          <button className={styles.addLevelButton} type="button" onClick={addLevel} disabled={settings.defaultPlan.levels.length >= MAX_LEVELS}><span className="material-symbols-outlined">add</span>Adicionar nível <small>{settings.defaultPlan.levels.length}/{MAX_LEVELS}</small></button>
          <div className={styles.warningStrip}><span className="material-symbols-outlined">history</span><p>As novas porcentagens valem para operações futuras. Vendas e comissões existentes mantêm os percentuais registrados no momento da atribuição.</p></div>
        </section>

        <section className={styles.card} id="pagamentos">
          <SectionHeading icon="payments" title="Pagamentos e privacidade Pix" description="Configure o ciclo financeiro e a autonomia dos embaixadores." />
          <div className={styles.gridTwo}>
            <Field label="Valor mínimo para pagamento" hint="Saldo liberado necessário para gerar um repasse."><div className={styles.prefixedInput}><span>R$</span><input data-field="minimumPaymentAmount" type="number" min={0} step="0.01" value={settings.minimumPaymentAmount} onChange={(event) => update('minimumPaymentAmount', inputNumber(event.currentTarget))} /></div></Field>
            <Field label="Frequência dos pagamentos" hint="Periodicidade padrão de conferência e repasse."><select value={settings.paymentFrequency} onChange={(event) => update('paymentFrequency', event.target.value as ProgramSettingsInput['paymentFrequency'])}><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option></select></Field>
          </div>
          <div className={styles.toggleList}>
            <Switch checked={settings.allowPixEdit} onChange={(checked) => update('allowPixEdit', checked)} label="Permitir que o embaixador edite sua chave Pix" description="A alteração fica disponível no perfil do embaixador." />
            <Switch checked={settings.requirePixChangeApproval} onChange={(checked) => update('requirePixChangeApproval', checked)} label="Exigir aprovação para alteração da chave Pix" description="A nova chave só passa a valer depois da revisão administrativa." />
          </div>
        </section>

        <section className={styles.card} id="indicacoes">
          <SectionHeading icon="link" title="Indicações e contato" description="Personalize o destino dos links e a mensagem de compartilhamento." />
          <div className={styles.gridTwo}>
            <Field label="URL de destino das indicações" hint="Deixe vazio para usar a página pública padrão."><input data-field="referralDestinationUrl" type="url" placeholder="https://seudominio.com.br/oferta" value={settings.referralDestinationUrl} onChange={(event) => update('referralDestinationUrl', event.target.value)} /></Field>
            <Field label="WhatsApp do programa" hint="Inclua DDD e código do país. Somente números."><input inputMode="tel" placeholder="5561999999999" value={settings.whatsappNumber} onChange={(event) => update('whatsappNumber', event.target.value.replace(/[^0-9]/g, ''))} /></Field>
          </div>
          <Field label="Mensagem padrão de compartilhamento" hint="Use uma chamada curta. O link individual pode ser acrescentado automaticamente no compartilhamento."><textarea rows={4} maxLength={500} value={settings.whatsappMessageTemplate} onChange={(event) => update('whatsappMessageTemplate', event.target.value)} placeholder="Conheça a Bryza pelo meu link exclusivo..." /><span className={styles.counter}>{settings.whatsappMessageTemplate.length}/500</span></Field>
        </section>

        <footer className={styles.saveBar}>
          <div><span className="material-symbols-outlined">cloud_done</span><span><strong>Configuração central do programa</strong><small>Revise os valores antes de salvar.</small></span></div>
          <div><button className={styles.secondaryButton} type="button" onClick={restore} disabled={isPending}>Descartar alterações</button><button className={styles.primaryButton} type="button" onClick={submit} disabled={isPending}><span className="material-symbols-outlined">{isPending ? 'progress_activity' : 'save'}</span>{isPending ? 'Salvando...' : 'Salvar configurações'}</button></div>
        </footer>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title, description, action }: { icon: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className={styles.sectionHeading}><div className={styles.sectionIcon}><span className="material-symbols-outlined">{icon}</span></div><div><h2>{title}</h2><p>{description}</p></div>{action && <div className={styles.headingAction}>{action}</div>}</header>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Switch({ checked, onChange, label, description, compact = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; compact?: boolean }) {
  return <label className={`${styles.switchLabel} ${compact ? styles.switchCompact : ''}`}><button type="button" role="switch" aria-checked={checked} className={`${styles.switch} ${checked ? styles.switchOn : ''}`} onClick={() => onChange(!checked)}><span /></button><span><strong>{label}</strong>{description && <small>{description}</small>}</span></label>;
}
