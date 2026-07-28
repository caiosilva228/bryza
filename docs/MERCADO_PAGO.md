# Mercado Pago — configuração do Checkout Pro

O sistema já está preparado para criar o agendamento, abrir o Checkout Pro e
confirmar o pagamento pelo webhook antes de liberar as comissões.

## Credenciais

Crie ou edite o arquivo `.env.local` na raiz do projeto:

`C:\Users\lucas\Desktop\Bryza\.env.local`

Adicione:

```env
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_APP_URL=
```

- `MERCADO_PAGO_ACCESS_TOKEN`: Access Token das credenciais da aplicação.
- `MERCADO_PAGO_WEBHOOK_SECRET`: assinatura secreta exibida ao configurar o
  webhook.
- `MERCADO_PAGO_APP_URL`: URL pública HTTPS da aplicação, sem barra no final.

As duas primeiras variáveis são exclusivas do servidor e nunca devem usar o
prefixo `NEXT_PUBLIC_`.

## Webhook

Na aplicação do Mercado Pago, configure notificações de **Pagamentos** para:

```text
https://SEU-DOMINIO/api/payments/mercado-pago/webhook
```

O endpoint valida `x-signature`, consulta o pagamento novamente na API oficial
e reconcilia o resultado de forma idempotente no banco.

## Teste local

O Mercado Pago não aceita `localhost` nas URLs de retorno ou de webhook. Para
testar o checkout com a aplicação na porta 3000, exponha essa porta por um túnel
HTTPS e use a URL do túnel em `MERCADO_PAGO_APP_URL`.

Depois de alterar `.env.local`, reinicie `npm run dev`.

