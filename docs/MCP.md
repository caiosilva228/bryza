# MCP seguro do Bryza

## Visão geral

O servidor MCP remoto fica no mesmo projeto Next.js/Netlify:

```text
https://admin.bryza.com.br/api/mcp
```

O endpoint usa `@modelcontextprotocol/sdk@1.30.0`, transporte Streamable HTTP stateless e runtime Node.js 20. A aplicação web continua protegida pelo `src/proxy.ts`; `/api/mcp` não depende de cookie e valida seu próprio `Authorization: Bearer`.

O código MCP nunca importa `createAdminClient()`, nunca recebe `service_role`, não executa SQL arbitrário e não retorna CPF, Pix, tokens de pagamento, credenciais, HMACs, `old_data` ou `new_data` de auditoria.

## Estado seguro inicial

Em todos os ambientes:

```env
MCP_ENABLED=false
MCP_WRITES_ENABLED=false
```

O arquivo `.env.example` contém apenas nomes e valores não secretos. Os valores reais devem ser configurados nos ambientes da Netlify, nunca em commits:

```env
MCP_ENABLED=true
MCP_WRITES_ENABLED=false
MCP_RESOURCE_URL=https://admin.bryza.com.br/api/mcp
MCP_ALLOWED_ORIGINS=https://admin.bryza.com.br
MCP_CONFIRMATION_TTL_SECONDS=300
MCP_MAX_PAGE_SIZE=50
MCP_MAX_DATE_RANGE_DAYS=31
```

`MCP_ALLOWED_ORIGINS` é uma lista exata separada por vírgulas. Requests sem `Origin` são aceitos para clientes server-to-server; quando `Origin` existe, ele precisa estar na allowlist.

## OAuth 2.1 no Supabase

O OAuth 2.1 do Supabase está em beta e deve ser ativado primeiro em um projeto de staging. No Dashboard:

1. Ative Authentication → OAuth Server.
2. Configure o Authorization Path como `/oauth/consent` e o Site URL do ambiente como `https://admin.bryza.com.br` (ou o domínio de staging).
3. Use assinatura JWT assimétrica RS256 ou ES256 e valide o JWKS em `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`.
4. Cadastre um OAuth client separado para development, staging e production. Registre callback URLs HTTPS completas e exatas.
5. Mantenha Dynamic Client Registration desligado na v1.
6. Faça o deploy do hook HTTP e configure-o em Authentication → Hooks:

   ```bash
   supabase functions deploy mcp-token-hook --no-verify-jwt
   ```

   O `--no-verify-jwt` é necessário porque o Auth chama o hook com um webhook assinado, não com um JWT de usuário. Configure no segredo da Edge Function `CUSTOM_ACCESS_TOKEN_SECRET` com o segredo HTTP exibido pelo Supabase e configure a URL `/functions/v1/mcp-token-hook` como Custom Access Token Hook. O código verifica a assinatura com `standardwebhooks` e só adiciona `aud`, `mcp_agent` e `agent_name` quando o `client_id` está na tabela privada.

A migration cria `private.mcp_approved_agents`, mas não insere clientes. Depois de cadastrar o client no OAuth Server, um administrador deve inserir somente o identificador público do cliente no ambiente correto, por SQL administrativo:

```sql
insert into private.mcp_approved_agents
  (client_id, display_name, description, environment, resource_url)
values
  ('CLIENT_ID_DO_STAGING', 'Agente Bryza Staging', 'Cliente de validação MCP', 'staging', 'https://staging-admin.bryza.com.br/api/mcp');
```

Não armazene client secret no repositório. O client secret fica somente no cofre do cliente OAuth/Netlify quando aplicável.

O endpoint `/.well-known/oauth-protected-resource` anuncia o resource URL e o authorization server. Em caso de Bearer ausente ou inválido, `/api/mcp` responde `401` com `WWW-Authenticate` e link para essa metadata.

## Consentimento e confirmação

`/oauth/consent` usa a sessão atual do Bryza e `supabase.auth.oauth.getAuthorizationDetails()`. Mostra o nome do cliente, escopos, dados operacionais, papéis, limitações e ações possíveis. O POST em `/api/oauth/decision` revalida a sessão, o perfil, o status do embaixador e a allowlist antes de chamar `approveAuthorization()` ou `denyAuthorization()`.

Escritas seguem um segundo fluxo independente do OAuth:

1. `prepare_*` valida a entidade com RLS, gera uma prévia curta e cria uma confirmação vinculada ao usuário, client, entidade e hash do payload.
2. O usuário abre a URL autenticada `/mcp/confirm`, confere a prévia e aprova.
3. `execute_confirmed_action` envia o token de uso único.
4. O RPC privado valida usuário, client, hash, expiração e status `approved`, executa a ação dentro da mesma transação e consome a confirmação.

A URL da tela contém somente o UUID da confirmação; o token de execução não vai para a URL nem para a tela. A migration apaga o payload da confirmação depois da execução. Tokens de confirmação não são registrados em logs.

Usuários autenticados podem revisar os acessos em `/oauth/grants`. A tela usa `listGrants()` e o POST `/api/oauth/revoke` usa `revokeGrant({ clientId })`; a revogação invalida as sessões ativas e refresh tokens do cliente. Esse caminho permanece disponível mesmo quando `MCP_ENABLED=false`, para resposta a incidentes.

## Ferramentas v1

Leitura:

- `get_operational_summary`
- `list_orders`
- `get_order`
- `list_stock`
- `list_routes`
- `get_route`
- `get_my_ambassador_summary` — somente `embaixador`

Escrita confirmada:

- `prepare_update_order_status`
- `prepare_update_route_status`
- `prepare_register_delivery_problem`
- `execute_confirmed_action`

Matriz inicial:

| Papel | Leitura | Escrita |
| --- | --- | --- |
| `admin` | resumo, pedidos, estoque, rotas | pedidos e logística operacional |
| `vendedor` | pedidos da própria carteira e resumo comercial permitido | nenhuma escrita MCP na v1 |
| `logistica` | pedidos, estoque, rotas | pedidos e logística operacional |
| `embaixador` | próprio resumo | nenhuma escrita MCP |

Paginação é limitada a 50 itens e períodos a 31 dias. Endereços aparecem somente em consultas logísticas indispensáveis. O servidor usa allowlists de colunas e mantém RLS como segunda barreira; o papel é sempre consultado em `profiles`.

Status financeiros e ações de pagamento, Pix, comissões, criação de clientes, alteração de identidade e `finalizado` ficam fora da v1.

## Migration e operação

Aplicar a migration em staging e verificar o SQL no Supabase antes da produção:

```bash
npx supabase db push
```

A migration cria:

- allowlist privada de agentes;
- confirmações temporárias e de uso único;
- RPCs para validar agentes, aprovar/executar confirmações e registrar auditoria;
- limitador atômico por usuário/client/minuto: 60 leituras, 10 preparações e 5 execuções;
- grants sem acesso direto de `anon`/`authenticated` às tabelas privadas.

Cada chamada autenticada registra no `audit_logs` o usuário, papel, client OAuth, ferramenta, entidade, resultado, request ID, latência e motivo de negação. Não registra o corpo dos argumentos, PII ou tokens.

## Testes e rollout

Antes de habilitar produção:

```bash
npm run lint
npm test
npm run build
```

Validar adicionalmente com MCP Inspector e um cliente real:

- `tools/list`, `tools/call`, metadata e `WWW-Authenticate`;
- Origin permitido e rejeitado;
- JWT expirado, assinatura/audience/issuer incorretos e client não aprovado;
- perfil inativo, troca de senha pendente e embaixador bloqueado;
- isolamento vendedor/logística/admin/embaixador e tentativa BOLA;
- ausência de CPF, Pix, payment tokens, HMACs e snapshots de auditoria;
- confirmação falsa, expirada, alterada e reutilizada;
- transições inválidas rejeitadas pelos gatilhos existentes;
- respostas `429`, auditoria e regressão de login, proxy, RLS, pagamentos e loja.

Sequência recomendada:

1. staging + OAuth client próprio;
2. `MCP_ENABLED=true`, `MCP_WRITES_ENABLED=false`;
3. validar leituras de usuários internos de teste;
4. ativar escritas somente após o teste manual da tela de confirmação;
5. monitorar 401/403/429, 5xx, latência, auditoria e negações;
6. incidente: definir `MCP_ENABLED=false`, revogar o OAuth client e reverter pelo GitHub/Netlify.

## Referências oficiais

- [Netlify — Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Supabase — MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase — OAuth 2.1 getting started](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase — Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [MCP — Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP — Streamable HTTP](https://modelcontextprotocol.io/specification/draft/basic/transports/streamable-http)
