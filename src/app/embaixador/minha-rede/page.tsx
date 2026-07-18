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
                <thead><tr><th>Embaixador</th><th>Nível</th><th>Patrocinador</th><th>Contato</th><th>Localidade</th><th>Status</th><th>Cadastro</th></tr></thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td><div className={styles.person}><span>{initials(item.display_name || item.full_name)}</span><div><strong>{item.display_name || item.full_name}</strong><small>@{item.username}</small></div></div></td>
                      <td><span className={`${styles.levelPill} ${styles[`level${item.level}`]}`}>Nível {item.level}</span></td>
                      <td>{item.sponsor_name}</td>
                      <td>
                        {item.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--color-on-surface)', whiteSpace: 'nowrap' }}>{item.phone}</span>
                            <a 
                              href={`https://wa.me/55${item.phone.replace(/\D/g, '')}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#25D366', color: '#FFF', borderRadius: '50%', width: '28px', height: '28px', textDecoration: 'none', flexShrink: 0 }}
                              title="Chamar no WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                              </svg>
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>Não informado</span>
                        )}
                      </td>
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
