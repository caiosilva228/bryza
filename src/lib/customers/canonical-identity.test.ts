import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCustomerIdentity,
  upsertPublicCustomerCanonical,
} from './canonical-identity.ts';

test('normalizes phone, CPF and email consistently across public channels', () => {
  assert.deepEqual(normalizeCustomerIdentity({
    phone: '+55 (61) 98211-5107',
    cpf: '056.207.431-79',
    email: ' Cliente@Exemplo.COM ',
  }), {
    phone: '61982115107',
    cpf: '05620743179',
    email: 'cliente@exemplo.com',
  });
});

test('uses only the service-role canonical RPC for a public customer upsert', async () => {
  let rpcName = '';
  let rpcArgs: Record<string, unknown> | undefined;
  const fakeClient = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcName = name;
      rpcArgs = args;
      return {
        data: {
          status: 'resolved',
          customer_id: 'customer-175',
          person_id: 'person-175',
        },
        error: null,
      };
    },
  };

  const result = await upsertPublicCustomerCanonical(fakeClient as never, {
    fullName: 'Cliente Teste',
    phone: '(61) 98211-5107',
    cpf: '056.207.431-79',
    address: 'Rua Um',
    number: '10',
    neighborhood: 'Centro',
    city: 'Cidade Ocidental',
    state: 'go',
    origin: 'loja_virtual_publica',
  });

  assert.equal(rpcName, 'fn_upsert_public_customer_canonical');
  assert.deepEqual(rpcArgs, {
    p_customer_data: {
      nome: 'Cliente Teste',
      telefone: '61982115107',
      cpf: '05620743179',
      email: null,
      endereco: 'Rua Um',
      numero: '10',
      bairro: 'Centro',
      cidade: 'Cidade Ocidental',
      estado: 'GO',
      cep: null,
      origem: 'loja_virtual_publica',
    },
    p_referral_code: null,
    p_source: 'public_checkout',
  });
  assert.equal(result.customerId, 'customer-175');
  assert.equal(result.personId, 'person-175');
});

test('rejects a canonical customer result without its person link', async () => {
  const fakeClient = {
    rpc: async () => ({
      data: {
        status: 'resolved',
        customer_id: 'customer-without-person',
      },
      error: null,
    }),
  };

  await assert.rejects(
    upsertPublicCustomerCanonical(fakeClient as never, {
      fullName: 'Cliente Sem Pessoa',
      phone: '61999999999',
      origin: 'loja_virtual_publica',
    }),
    /canonical_person_id_missing/,
  );
});

test('does not silently merge conflicting CPF and phone identities', async () => {
  const fakeClient = {
    rpc: async () => ({
      data: {
        status: 'manual_review_required',
        code: 'identifiers_point_to_different_people',
      },
      error: null,
    }),
  };

  await assert.rejects(
    upsertPublicCustomerCanonical(fakeClient as never, {
      fullName: 'Cliente Conflitante',
      phone: '61999999999',
      cpf: '12345678901',
      origin: 'loja_virtual_publica',
    }),
    /customer_identity_review_required/,
  );
});
