'use client';

import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { getMinhaRede, type NetworkMember } from '../actions';
import styles from './minha-rede.module.css';

type NetworkData = Awaited<ReturnType<typeof getMinhaRede>>;
type LevelFilter = 'todos' | '1' | '2' | '3';

const statusLabel: Record<NetworkMember['status'], string> = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  inativo: 'Inativo',
  bloqueado: 'Bloqueado',
};

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

export default function MinhaRedePage() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<LevelFilter>('todos');

  useEffect(() => {
    let active = true;

    getMinhaRede()
      .then((result) => active && setData(result))
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar sua rede.');
      })
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (data?.items || []).filter((item) => {
      const matchesLevel = level === 'todos' || item.level === Number(level);
      const matchesSearch = !term || [item.full_name, item.display_name, item.username, item.city, item.state]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('pt-BR').includes(term));
      return matchesLevel && matchesSearch;
    });
  }, [data, level, search]);

  const counts = data?.counts || { total: 0, level1: 0, level2: 0, level3: 0 };

  return (
    <MainLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>MINHAS INDICAÇÕES</span>
            <h1>Minha Rede</h1>
            <p>Acompanhe os embaixadores conectados a você até o terceiro nível.</p>
          </div>
          <div className={styles.headerIcon}><span className="material-symbols-outlined">account_tree</span></div>
        </header>

        <section className={styles.summary} aria-label="Resumo da rede">
          <article className={styles.totalCard}>
            <span className="material-symbols-outlined">groups</span>
            <div><small>Rede total</small><strong>{counts.total}</strong></div>
          </article>
          {[counts.level1, counts.level2, counts.level3].map((count, index) => (
            <article key={index}>
              <span className={styles.levelBadge}>{index + 1}</span>
              <div><small>Nível {index + 1}</small><strong>{count}</strong></div>
            </article>
          ))}
        </section>

        <section className={styles.contentCard}>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <span className="material-symbols-outlined">search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, usuário ou cidade" aria-label="Buscar na minha rede" />
            </label>
            <div className={styles.filters} aria-label="Filtrar por nível">
              {(['todos', '1', '2', '3'] as LevelFilter[]).map((item) => (
                <button type="button" key={item} className={level === item ? styles.filterActive : ''} onClick={() => setLevel(item)}>
                  {item === 'todos' ? 'Todos' : `Nível ${item}`}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className={styles.state}><span className={`${styles.spinner} material-symbols-outlined`}>progress_activity</span><strong>Carregando sua rede...</strong></div>
          ) : error ? (
            <div className={`${styles.state} ${styles.error}`}><span className="material-symbols-outlined">error</span><strong>{error}</strong></div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.state}>
              <span className="material-symbols-outlined">hub</span>
              <strong>{data?.items.length ? 'Nenhum resultado encontrado.' : 'Sua rede ainda não possui embaixadores.'}</strong>
              <p>{data?.items.length ? 'Tente outro nome ou nível.' : 'Novos embaixadores aparecerão aqui conforme sua rede crescer.'}</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Embaixador</th><th>Nível</th><th>Patrocinador</th><th>Localidade</th><th>Status</th><th>Cadastro</th></tr></thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td><div className={styles.person}><span>{initials(item.display_name || item.full_name)}</span><div><strong>{item.display_name || item.full_name}</strong><small>@{item.username}</small></div></div></td>
                      <td><span className={`${styles.levelPill} ${styles[`level${item.level}`]}`}>Nível {item.level}</span></td>
                      <td>{item.sponsor_name}</td>
                      <td>{[item.city, item.state].filter(Boolean).join(' - ') || 'Não informado'}</td>
                      <td><span className={`${styles.status} ${styles[item.status]}`}>{statusLabel[item.status]}</span></td>
                      <td>{formatDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && data && data.items.length > 0 && (
            <footer className={styles.footer}>Exibindo {filteredItems.length} de {data.items.length} embaixadores da sua rede.</footer>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
