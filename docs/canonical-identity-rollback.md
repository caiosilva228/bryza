# Rollback seguro — identidade canônica

O rollback recomendado é lógico e preserva dados. Não se deve apagar pessoas, atribuições, auditorias, convites, aceites, qualificações, pedidos ou comissões.

## Procedimento

1. Reverter a aplicação para o commit anterior.
2. Revogar temporariamente os novos pontos de entrada:

```sql
REVOKE EXECUTE ON FUNCTION public.fn_admin_create_ambassador_invitation(uuid,text,uuid,timestamptz) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_accept_ambassador_invitation(uuid,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_admin_upsert_profile_canonical(uuid,jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_admin_update_ambassador_canonical(uuid,jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_update_my_profile_canonical(text,text) FROM authenticated;
```

3. Se a aplicação anterior precisar voltar a editar campos legados diretamente, remover somente os guards de compatibilidade:

```sql
DROP TRIGGER IF EXISTS trg_clientes_require_canonical_identity_write ON public.clientes;
DROP TRIGGER IF EXISTS trg_profiles_require_canonical_identity_write ON public.profiles;
DROP TRIGGER IF EXISTS trg_ambassadors_require_canonical_identity_write ON public.ambassadors;
```

4. Restaurar `fn_criar_agendamento_publico` a partir da migration anterior `20260718044648_amb_multilevel_scheduling_commissions.sql` somente se o checkout anterior também for restaurado. Esse passo reativa comportamento legado e exige aprovação explícita.
5. Restaurar as funções anteriores de comissão/pedido a partir das migrations anteriores somente em uma janela controlada. Não atualizar pedidos ou comissões existentes.
6. Manter o schema `private` e todas as linhas históricas. Marcar novas operações como inativas/arquivadas em vez de excluir.
7. Comparar novamente as contagens de `clientes`, `pedidos`, `commissions`, atribuições e auditorias.

## Rollback físico

Não é seguro nem suportado depois que o sistema começa a produzir convites, aceites ou atribuições oficiais. As FKs `ON DELETE RESTRICT` existem deliberadamente para impedir perda histórica. Qualquer remoção física exigiria exportação auditada, aprovação específica e uma migration própria.
