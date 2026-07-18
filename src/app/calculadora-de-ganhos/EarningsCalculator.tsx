'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Calculator,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import styles from './calculadora.module.css';

type Props = {
  planName: string;
  levels: Array<{ level_number: number; name: string; percentage: number }>;
  embedded?: boolean;
};

const DEFAULTS = {
  goal: 1000,
  months: 6,
  monthlyVolume: 100,
  duplication: 5,
};

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

const wholeNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

type NumericInput = number | '';

function readNumericInput(value: string, valueAsNumber: number): NumericInput {
  return value === '' || !Number.isFinite(valueAsNumber) ? '' : valueAsNumber;
}

function safeNumber(value: NumericInput, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Number(value), min), max);
}

export function EarningsCalculator({ planName, levels, embedded = false }: Props) {
  const [goal, setGoal] = useState<NumericInput>(DEFAULTS.goal);
  const [months, setMonths] = useState<NumericInput>(DEFAULTS.months);
  const [monthlyVolume, setMonthlyVolume] = useState<NumericInput>(DEFAULTS.monthlyVolume);
  const [duplication, setDuplication] = useState<NumericInput>(DEFAULTS.duplication);
  const [publicUrl, setPublicUrl] = useState('/calculadora-de-ganhos');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/calculadora-de-ganhos`);
  }, []);

  const result = useMemo(() => {
    const normalizedGoal = safeNumber(goal, DEFAULTS.goal, 1, 100_000_000);
    const normalizedMonths = Math.round(safeNumber(months, DEFAULTS.months, 1, 120));
    const normalizedVolume = safeNumber(monthlyVolume, DEFAULTS.monthlyVolume, 1, 1_000_000);
    const normalizedDuplication = Math.round(safeNumber(duplication, DEFAULTS.duplication, 1, 10));
    const monthlyGoal = normalizedGoal;
    const rates = levels.map((level) => level.percentage / 100);
    const earningsPerDirectBranch = normalizedVolume * rates.reduce(
      (total, rate, index) => total + normalizedDuplication ** index * rate,
      0,
    );
    const level1 = Math.max(1, Math.ceil(monthlyGoal / Math.max(earningsPerDirectBranch, 0.01)));
    const people = rates.map((_, index) => level1 * normalizedDuplication ** index);
    const earnings = people.map((count, index) => count * normalizedVolume * rates[index]);
    const projectedMonthly = earnings.reduce((sum, value) => sum + value, 0);

    return {
      normalizedGoal,
      normalizedMonths,
      normalizedVolume,
      normalizedDuplication,
      monthlyGoal,
      people,
      earnings,
      projectedMonthly,
      directReferralsPerMonth: Math.ceil(level1 / normalizedMonths),
      totalPeople: people.reduce((sum, value) => sum + value, 0),
    };
  }, [duplication, goal, levels, monthlyVolume, months]);

  function reset() {
    setGoal(DEFAULTS.goal);
    setMonths(DEFAULTS.months);
    setMonthlyVolume(DEFAULTS.monthlyVolume);
    setDuplication(DEFAULTS.duplication);
  }

  async function copyPublicLink() {
    await navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  }

  const RootElement = embedded ? 'div' : 'main';

  return (
    <RootElement className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      {!embedded && <header className={styles.header}>
        <a href="#topo" className={styles.brand} aria-label="Bryza - início da calculadora">
          <span className={styles.brandMark}>B</span>
          <span>
            <strong>BRYZA</strong>
            <small>PROGRAMA DE EMBAIXADORES</small>
          </span>
        </a>
        <span className={styles.publicBadge}><ShieldCheck size={16} /> Acesso público</span>
      </header>}

      {!embedded && <section className={styles.hero} id="topo">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}><Sparkles size={16} /> Planeje sua jornada</span>
          <h1>Transforme sua meta em um <em>plano de crescimento.</em></h1>
          <p>
            Informe quanto deseja ganhar por mês e em quanto tempo quer atingir essa meta.
            A calculadora estima o tamanho necessário da sua rede em cada nível.
          </p>
          <a className={styles.heroButton} href="#simulador">
            Fazer simulação <ArrowDown size={18} />
          </a>
        </div>
        <div className={styles.heroCard} aria-hidden="true">
          <div className={styles.heroCardIcon}><TrendingUp size={26} /></div>
          <span>Meta mensal</span>
          <strong>{money.format(result.normalizedGoal)}</strong>
          <div className={styles.heroProgress}><span /></div>
          <small>Objetivo para {result.normalizedMonths} {result.normalizedMonths === 1 ? 'mês' : 'meses'}</small>
        </div>
      </section>}

      {embedded && (
        <section className={styles.publicLinkCard} aria-label="Link público da calculadora">
          <div className={styles.publicLinkIcon}><ExternalLink size={22} /></div>
          <div className={styles.publicLinkContent}>
            <strong>Link externo da calculadora</strong>
            <span>Use este endereço para abrir ou compartilhar a calculadora sem necessidade de login.</span>
            <code>{publicUrl}</code>
          </div>
          <div className={styles.publicLinkActions}>
            <button type="button" onClick={copyPublicLink}>
              {linkCopied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
              {linkCopied ? 'Link copiado' : 'Copiar link'}
            </button>
            <a href="/calculadora-de-ganhos" target="_blank" rel="noreferrer">
              Abrir link <ExternalLink size={16} />
            </a>
          </div>
        </section>
      )}

      <section className={styles.calculatorSection} id="simulador">
        <div className={styles.sectionHeading}>
          <span><Calculator size={18} /> Simulador</span>
          <h2>Monte seu cenário</h2>
          <p>Você pode ajustar todas as premissas para criar uma projeção mais próxima da sua realidade.</p>
        </div>

        <div className={styles.calculatorGrid}>
          <form className={styles.formCard} onSubmit={(event) => event.preventDefault()}>
            <div className={styles.cardTitle}>
              <div><Target size={22} /></div>
              <span><strong>Sua meta</strong><small>Preencha os valores da simulação</small></span>
            </div>

            <label className={styles.field}>
              <span>Quanto você quer ganhar por mês?</span>
              <div className={styles.inputWrap}><b>R$</b><input aria-label="Valor que deseja ganhar por mês" type="number" min="1" max="100000000" step="100" value={goal} onChange={(event) => setGoal(readNumericInput(event.currentTarget.value, event.currentTarget.valueAsNumber))} onBlur={() => goal === '' && setGoal(DEFAULTS.goal)} /></div>
            </label>

            <label className={styles.field}>
              <span>Em quanto tempo quer atingir essa renda mensal?</span>
              <div className={styles.inputWrap}><Clock3 size={18} /><input aria-label="Prazo para atingir a renda mensal" type="number" min="1" max="120" step="1" value={months} onChange={(event) => setMonths(readNumericInput(event.currentTarget.value, event.currentTarget.valueAsNumber))} onBlur={() => months === '' && setMonths(DEFAULTS.months)} /><b>meses</b></div>
            </label>

            <div className={styles.divider} />
            <div className={styles.assumptionTitle}>Premissas da rede</div>

            <label className={styles.field}>
              <span>Volume médio mensal por pessoa <i title="Valor médio de vendas aprovadas gerado mensalmente por cada pessoa da rede.">?</i></span>
              <div className={styles.inputWrap}><b>R$</b><input aria-label="Volume médio mensal por pessoa" type="number" min="1" max="1000000" step="10" value={monthlyVolume} onChange={(event) => setMonthlyVolume(readNumericInput(event.currentTarget.value, event.currentTarget.valueAsNumber))} onBlur={() => monthlyVolume === '' && setMonthlyVolume(DEFAULTS.monthlyVolume)} /></div>
              <small>Valor de vendas aprovadas gerado por cada pessoa.</small>
            </label>

            <label className={styles.field}>
              <span>Indicações por pessoa</span>
              <div className={styles.inputWrap}><Users size={18} /><input aria-label="Quantidade média de indicações por pessoa" type="number" min="1" max="10" step="1" value={duplication} onChange={(event) => setDuplication(readNumericInput(event.currentTarget.value, event.currentTarget.valueAsNumber))} onBlur={() => duplication === '' && setDuplication(DEFAULTS.duplication)} /><b>pessoas</b></div>
              <small>Média de novas pessoas que cada participante indica.</small>
            </label>

            <button className={styles.resetButton} type="button" onClick={reset}><RotateCcw size={16} /> Restaurar valores iniciais</button>
          </form>

          <section className={styles.resultCard} aria-live="polite">
            <div className={styles.resultHeader}>
              <div>
                <span>Resultado da simulação</span>
                <strong>{money.format(result.monthlyGoal)}<small> / mês</small></strong>
                <p>Renda mensal desejada para ser atingida em até {result.normalizedMonths} {result.normalizedMonths === 1 ? 'mês' : 'meses'}.</p>
              </div>
              <div className={styles.walletIcon}><WalletCards size={28} /></div>
            </div>

            <div className={styles.networkTitle}><span>Rede estimada</span><small>{wholeNumber.format(result.totalPeople)} pessoas ativas no total</small></div>
            <div className={styles.levels}>
              {result.people.map((count, index) => (
                <article className={styles.levelCard} key={index}>
                  <div className={styles.levelTop}>
                    <span className={styles.levelNumber}>{index + 1}</span>
                    <span className={styles.levelRate}>{levels[index].percentage}%</span>
                  </div>
                  <span>{levels[index].name || `Nível ${index + 1}`}</span>
                  <strong>{wholeNumber.format(count)}</strong>
                  <small>{index === 0 ? 'indicações diretas' : 'pessoas na rede'}</small>
                  <footer>{money.format(result.earnings[index])}<small> / mês</small></footer>
                </article>
              ))}
            </div>

            <div className={styles.summary}>
              <div><span>Ganho mensal projetado</span><strong>{money.format(result.projectedMonthly)}</strong></div>
              <div><span>Indicações diretas por mês</span><strong>{wholeNumber.format(result.directReferralsPerMonth)}</strong></div>
            </div>
            <p className={styles.resultNote}><CheckCircle2 size={17} /> Ao formar esta rede, a projeção mensal alcança ou supera sua meta.</p>
          </section>
        </div>
      </section>

      {!embedded && <section className={styles.explanation}>
        <div>
          <span className={styles.eyebrow}><Users size={16} /> Entenda os níveis</span>
          <h2>Como a sua rede é calculada?</h2>
          <p>Cada indicação direta pode criar novos relacionamentos abaixo dela. A simulação usa a média informada para projetar os {levels.length} níveis ativos do plano.</p>
        </div>
        <div className={styles.steps}>
          <article><span>01</span><div><strong>Você indica</strong><p>O nível 1 reúne as pessoas indicadas diretamente por você.</p></div></article>
          <article><span>02</span><div><strong>Sua rede se multiplica</strong><p>As indicações do nível 1 formam o nível 2, seguindo a média escolhida.</p></div></article>
          <article><span>03</span><div><strong>O crescimento continua</strong><p>A duplicação segue pelos níveis ativos configurados no programa.</p></div></article>
        </div>
      </section>}

      {!embedded && <footer className={styles.footer}>
        <strong>Importante:</strong> esta é uma simulação educativa baseada no plano {planName}, em volume mensal constante e nas premissas informadas. Não há garantia de renda. As comissões reais dependem de vendas válidas, aprovadas e das regras vigentes do programa.
      </footer>}
    </RootElement>
  );
}
