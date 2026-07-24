# Bryza — implementação de identidade canônica e Programa de Embaixadores

Data da execução: 24/07/2026

Projeto Supabase: `kkjrunhubqixftemndrm` (`BRYZA SYSTEM`, `sa-east-1`)

Ambiente: produção, conforme autorização explícita do responsável pelo projeto

Backup: não executado, conforme dispensa explícita do responsável pelo projeto

## Resultado

A arquitetura foi migrada para uma identidade canônica privada, com papéis de negócio separados das permissões de acesso. Cliente e embaixador podem coexistir na mesma pessoa. Responsável comercial e embaixador indicador são estruturas independentes.

Pedidos e comissões usam exclusivamente uma atribuição oficial ativa, validada e comissionável. Os 126 vínculos de `migracao_vendedor_caio` e `migracao_vendedor_isabele` foram preservados em arquivo histórico privado e neutralizados como fonte de comissão. Nenhum deles foi convertido automaticamente em indicação oficial.

## Baseline anterior às alterações

| Objeto crítico | Antes |
| --- | ---: |
| `auth.users` | 7 |
| `profiles` | 7 |
| `clientes` | 126 |
| `ambassadors` | 3 |
| `referral_attributions` | 126 |
| `pedidos` | 170 |
| `commissions` | 0 |

Fingerprints do catálogo capturado antes da primeira migration:

| Catálogo | Quantidade | SHA-256 |
| --- | ---: | --- |
| colunas | 963 | `6e158d...` |
| constraints | 281 | `7c7de...` |
| enums | 93 | `660a...` |
| extensões | 6 | `5d83...` |
| funções | 175 | `d702...` |
| grants | 1102 | `0eb0...` |
| índices | 205 | `0a93...` |
| policies | 77 | `426f...` |
| schemas | 11 | `38aa...` |
| tabelas | 74 | `5789...` |
| triggers | 44 | `0c13...` |

## Estado final

| Objeto crítico | Depois |
| --- | ---: |
| `auth.users` | 7 |
| `profiles` / vinculados | 7 / 7 |
| `clientes` / vinculados | 126 / 125 |
| `ambassadors` / vinculados | 3 / 3 |
| pessoas canônicas | 132 |
| vínculos pessoa-conta | 7 |
| atribuições oficiais | 0 |
| vínculos legados arquivados | 126 |
| vínculos legados comissionáveis | 0 |
| pedidos | 170 |
| comissões | 0 |
| revisões de identidade abertas | 8 |

Um cliente permaneceu sem `person_id` por ambiguidade e está destinado à revisão administrativa. Nenhuma unificação silenciosa foi feita.

## Estruturas e regras implementadas

- Schema privado `private`, fora da Data API.
- Pessoas, fingerprints HMAC-SHA-256, vínculo pessoa-conta um-para-um, papéis de negócio e permissões de acesso.
- Revisões persistentes de conflito com retorno `manual_review_required`.
- Idempotência com escopo, tipo, cliente, hash de payload, lease de recuperação, retenção e resultado mínimo.
- Histórico separado de responsável comercial.
- Fonte histórica oficial de atribuições de embaixador, com índice parcial que permite no máximo uma atribuição ativa por cliente.
- Atribuição e reatribuição atômicas, com bloqueio do cliente, encerramento da anterior, novo ponteiro e auditoria.
- Convites, aceite de termos, exceções de qualificação e qualificações por período.
- Inativação/arquivamento no lugar de exclusão física de clientes e embaixadores.
- Escrita de dados pessoais somente pela identidade canônica, seguida de replicação unidirecional para `clientes`, `profiles` e `ambassadors`.
- Checkout público canônico sem criação automática de embaixador.
- Pedido manual atômico e idempotente, com snapshot da atribuição e da qualificação.
- Compra própria sem autoindicação ou autocomissão.

## Aplicação

- Cadastro e edição de cliente usam a RPC canônica.
- O formulário do cliente pesquisa embaixadores ativos por nome ou código e permite cadastro sem embaixador.
- Detalhes do cliente separam “Indicado por” de “Também é embaixador”.
- Pedido mostra a atribuição do cliente; quando ainda não existe, um administrador pode selecioná-la antes da criação.
- Detalhes do pedido mostram embaixador, código e qualificação congelados.
- Cadastro direto de embaixador foi desativado e substituído pelo convite a partir do cliente.
- Aceite do programa exige conta autenticada correspondente ao e-mail canônico e versão vigente dos termos.
- Tela administrativa de revisões: `/configuracoes/identidade`.

## Segurança validada

- `anon` e `authenticated`: sem `USAGE` no schema privado e sem `SELECT` em `private.persons`.
- `service_role`: `SELECT/INSERT/UPDATE` necessário e sem `DELETE` em `private.persons`.
- Checkout público: execução somente por `service_role`.
- Funções novas usam `SECURITY DEFINER`, `search_path = pg_catalog`, validação de ator e grants mínimos.
- Tokens de convite são armazenados somente como HMAC.
- Resultados de idempotência não aceitam CPF, telefone, e-mail, endereço, token, credencial ou segredo.
- Estruturas históricas possuem proteção contra `DELETE`.

O Advisor continua exibindo avisos anteriores ao projeto, especialmente funções antigas com `search_path` mutável, tabelas públicas antigas sem policy e proteção de senhas vazadas desativada. Os avisos “RLS sem policy” no schema `private` são intencionais: o acesso direto é negado e ocorre apenas por RPCs autorizadas. Referência: https://supabase.com/docs/guides/database/database-linter

## Testes executados

- `phase1_canonical_identity_foundations.sql`: passou.
- `phase2_identity_roles_and_official_attribution.sql`: passou.
- `phase4_official_order_attribution_and_qualification.sql`: passou.
- `phase5_phase7_end_to_end_identity_program.sql`: passou.
- `npm test`: 3/3 testes passaram.
- `npm run lint`: 0 erros; 12 avisos preexistentes de fontes.
- `npm run build`: passou com TypeScript e 39 rotas geradas.

Os testes SQL são transacionais e terminam com `ROLLBACK`; não deixam pessoas, pedidos, convites, atribuições ou comissões sintéticos.

## Divergências de migrations

O histórico remoto anterior já não correspondia um-para-um aos nomes locais:

- migrations logicamente equivalentes usam timestamps diferentes;
- o remoto contém três registros chamados `amb_portal_views_and_security`, enquanto o repositório possui um;
- há migrations locais antigas sem versão remota correspondente e migrations remotas antigas sem arquivo local correspondente;
- objetos como drivers, descontos, segurança do núcleo, rate limit e campos complementares aparecem em apenas um dos históricos ou agrupados de forma diferente.

Essas divergências antigas não foram “reparadas” nem regravadas. As migrations criadas nesta execução foram renomeadas para as versões que o Supabase registrou remotamente, evitando que sejam reaplicadas pelo pipeline.

## Limitações

- O cliente ambíguo continua sem vínculo canônico até revisão baseada em evidência.
- Nenhuma atribuição oficial retroativa foi criada; a contagem permanece zero.
- Os avisos legados do Advisor devem ser tratados em uma iniciativa separada, com teste de regressão dos fluxos antigos.
- O envio de convite depende do e-mail do cliente e da configuração de e-mail do Supabase Auth. Se o provedor não enviar, o painel disponibiliza o link para compartilhamento manual.

## Preservação histórica

- Nenhum pedido foi alterado retroativamente.
- Nenhuma comissão foi criada, apagada ou recalculada.
- Nenhuma indicação oficial foi inferida dos vendedores Caio ou Isabele.
- Nenhum registro histórico foi excluído.
