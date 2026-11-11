import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type ResolveContext = { parentURL?: string };
type NextResolve = (specifier: string, context: ResolveContext) => { url: string };
const moduleWithHooks = nodeModule as typeof nodeModule & {
  registerHooks: (hooks: { resolve: (specifier: string, context: ResolveContext, nextResolve: NextResolve) => { url: string } }) => void;
};
moduleWithHooks.registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith('@/')
      ? resolve(root, specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? resolve(dirname(fileURLToPath(context.parentURL)), specifier)
        : null;
    if (target) {
      for (const ext of ['', '.ts', '.tsx']) {
        if (existsSync(target + ext)) return nextResolve(pathToFileURL(target + ext).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
const { buildSettlementProposal, DEFAULT_CREDIT_ROLL_SCENARIO, createHumanApprovalToken } = await import('../lib/credit-roll-reconciler');
const { createAndCaptureOrder, createAndReadBackPayoutBatch } = await import('../lib/paypal');
const { createSettlementStore, createAndCaptureSupporterOrder, executeCrewBatchPayoutAndReadBack } = await import('../lib/credit-roll-settlement');
const { POST } = await import('../app/api/ai/responses/route');
const { aiResponsesUrl } = await import('../lib/ai');
const json = (data: unknown, status = 200, headers = {}) => Response.json(data, { status, headers });

test('checkout preserves payer-action link returned for payment_source orders', async () => {
  const result = await createAndCaptureSupporterOrder({}, {
    store: createSettlementStore(), clientId: 'fake-id', clientSecret: 'fake-secret',
    fetchImpl: async (url) => String(url).endsWith('/token')
      ? json({ access_token: 'fake-token', expires_in: 3600 })
      : String(url).endsWith('/capture')
        ? json({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'PAYER_ACTION_REQUIRED' }] }, 422)
        : json({ id: 'PAYER-ACTION', status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYER-ACTION' }] }),
  });
  assert.equal(result.receipt?.approveUrl, 'https://www.sandbox.paypal.com/checkoutnow?token=PAYER-ACTION');
});

test('insufficient funds explains funding and one-cent option without changing contracts', async () => {
  const store = createSettlementStore();
  const before = store.getState();
  const result = await executeCrewBatchPayoutAndReadBack({ approvalToken: createHumanApprovalToken(before.proposal.proposalVersionHash) }, {
    store, clientId: 'fake-id', clientSecret: 'fake-secret',
    fetchImpl: async (url) => String(url).endsWith('/token')
      ? json({ access_token: 'fake-token', expires_in: 3600 })
      : json({ name: 'INSUFFICIENT_FUNDS' }, 422),
  });
  assert.equal(result.error?.code, 'PAYPAL_INSUFFICIENT_FUNDS');
  assert.ok(result.error?.message.includes('$0.01'));
  assert.deepEqual(result.state.reconciled.crewSettlements, before.reconciled.crewSettlements);
});

test('explicit full roster replays same batch and partial roster cannot repay contracts', async () => {
  const store = createSettlementStore();
  const proposal = store.getState().proposal;
  const request = { approvalToken: createHumanApprovalToken(proposal.proposalVersionHash) };
  let posts = 0;
  const options = { store, clientId: 'fake-id', clientSecret: 'fake-secret', fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith('/token')) return json({ access_token: 'fake-token', expires_in: 3600 });
    if (init?.method === 'POST') posts++;
    return json({ batch_header: { payout_batch_id: 'SAME-BATCH', batch_status: 'SUCCESS' }, items: proposal.executableItems.map((item) => ({ sender_item_id: item.senderItemId, payout_item_id: item.personId, transaction_status: 'SUCCESS' })) });
  } };
  assert.equal((await executeCrewBatchPayoutAndReadBack(request, options)).ok, true);
  const replay = await executeCrewBatchPayoutAndReadBack({ ...request, requestedPersonIds: proposal.executableItems.map((item) => item.personId) }, options);
  assert.equal(replay.idempotentReplay, true);
  const partial = await executeCrewBatchPayoutAndReadBack({ ...request, requestedPersonIds: [proposal.executableItems[0].personId] }, options);
  assert.equal(partial.error?.code, 'PARTIAL_PAYOUT_NOT_SUPPORTED');
  assert.equal(posts, 1);
});

for (const value of ['', '   ', ' https://custom.example/v1/ ']) {
  test(`base URL configuration handles ${JSON.stringify(value)}`, async () => {
    const previousAi = process.env.OPENAI_BASE_URL;
    const previousApp = process.env.APP_BASE_URL;
    try {
      process.env.OPENAI_BASE_URL = value;
      process.env.APP_BASE_URL = value;
      assert.equal(aiResponsesUrl(), value.trim() ? 'https://custom.example/v1/responses' : 'https://api.openai.com/v1/responses');
      let context: Record<string, string> = {};
      await createAndCaptureOrder({ amountCents: 1, requestId: 'empty-base-test', capture: false }, {
        clientId: 'fake-id', clientSecret: 'fake-secret', fetchImpl: async (url, init) => {
          if (String(url).endsWith('/token')) return json({ access_token: 'fake-token', expires_in: 3600 });
          if (init?.method === 'POST') context = JSON.parse(String(init.body)).payment_source.paypal.experience_context;
          return json({ id: 'ORDER-BASE', status: 'CREATED' });
        },
      });
      const origin = value.trim() ? 'https://custom.example' : 'https://paypal-credit-roll-live.onrender.com';
      assert.equal(context.return_url, `${origin}/dashboard?checkout=approved`);
      assert.equal(context.cancel_url, `${origin}/dashboard?checkout=cancelled`);
    } finally {
      if (previousAi === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = previousAi;
      if (previousApp === undefined) delete process.env.APP_BASE_URL; else process.env.APP_BASE_URL = previousApp;
    }
  });
}

for (const variant of ['detail-link', 'top-level-links', 'legacy-no-link', 'unknown-no-link', 'wrong-sender', 'unrelated-business-error']) {
  test(`Payouts v1 USER_BUSINESS_ERROR recovery: ${variant}`, async () => {
    const legacyKey = 'BATCH-NEON-NOCTURNE-2026-V2-R1-4I-705000';
    const senderBatchId = variant === 'legacy-no-link' || variant === 'unrelated-business-error' ? legacyKey : 'stable-v1-key';
    const expectedBatch = variant === 'legacy-no-link' ? '6GGPBS2JUKU5N' : 'EXISTING-V1';
    let posts = 0;
    let reads = 0;
    const link = { href: 'https://api-m.sandbox.paypal.com/v1/payments/payouts/EXISTING-V1', rel: 'self' };
    const error = {
      name: 'USER_BUSINESS_ERROR',
      details: [{ field: 'SENDER_BATCH_ID', issue: variant === 'unrelated-business-error' ? 'Invalid sender batch id' : 'Batch with given sender_batch_id already exists', ...(variant === 'detail-link' || variant === 'wrong-sender' ? { link } : {}) }],
      ...(variant === 'top-level-links' ? { links: [link] } : {}),
    };
    const operation = () => createAndReadBackPayoutBatch({
      senderBatchId, requestId: 'v1-recovery', emailSubject: 'test', emailMessage: 'test',
      items: [{ receiverEmail: 'crew@example.com', amountCents: 1, note: 'test', senderItemId: 'crew' }],
    }, { clientId: 'fake-id', clientSecret: 'fake-secret', fetchImpl: async (url, init) => {
      if (String(url).endsWith('/token')) return json({ access_token: 'fake-token', expires_in: 3600 });
      if (init?.method === 'POST') { posts++; return json(error, 400); }
      reads++;
      assert.equal(String(url), `https://api-m.sandbox.paypal.com/v1/payments/payouts/${expectedBatch}`);
      return json({ batch_header: { payout_batch_id: expectedBatch, batch_status: 'SUCCESS', sender_batch_header: { sender_batch_id: variant === 'wrong-sender' ? 'not-the-sender' : senderBatchId } } });
    } });
    if (['unknown-no-link', 'wrong-sender', 'unrelated-business-error'].includes(variant)) {
      await assert.rejects(operation, /PayPal 400/);
      assert.equal(reads, variant === 'wrong-sender' ? 1 : 0);
    } else {
      const result = await operation();
      assert.equal(result.readBackBatch.batch_header.payout_batch_id, expectedBatch);
      assert.equal(reads, 1);
    }
    assert.equal(posts, 1);
  });
}

test('payout identity changes for a different receiver even when totals and revision match', () => {
  const original = buildSettlementProposal();
  const scenario = structuredClone(DEFAULT_CREDIT_ROLL_SCENARIO);
  scenario.contracts[0].receiverEmail = 'different.sandbox@example.com';
  const changed = buildSettlementProposal(scenario);
  assert.equal(original.senderBatchId, 'BATCH-NEON-NOCTURNE-2026-V2-R1-4I-705000');
  assert.notEqual(changed.senderBatchId, original.senderBatchId);
  assert.notEqual(changed.proposalVersionHash, original.proposalVersionHash);
  assert.ok(changed.senderBatchId.length <= 50);
});

test('checkout includes HTTPS return and cancel destinations', async () => {
  let body: Record<string, unknown> = {};
  await createAndCaptureOrder({ amountCents: 1, requestId: 'redirect-test', capture: false }, {
    clientId: 'fake-id', clientSecret: 'fake-secret',
    fetchImpl: async (url, init) => {
      if (String(url).endsWith('/token')) return json({ access_token: 'fake-token', expires_in: 3600 });
      if (init?.method === 'POST') {
        body = JSON.parse(String(init.body));
        return json({ id: 'ORDER-REDIRECT', status: 'CREATED' });
      }
      return json({ id: 'ORDER-REDIRECT', status: 'CREATED' });
    },
  });
  const context = ((body.payment_source as { paypal: { experience_context: Record<string, string> } }).paypal.experience_context);
  assert.equal(new URL(context.return_url).pathname, '/dashboard');
  assert.equal(new URL(context.cancel_url).pathname, '/dashboard');
  assert.equal(new URL(context.return_url).protocol, 'https:');
  assert.notEqual(context.return_url, context.cancel_url);
});

test('duplicate PayPal batch after store restart is read back without a new transfer key', async () => {
  const calls: string[] = [];
  const result = await createAndReadBackPayoutBatch({
    senderBatchId: 'stable-key', requestId: 'stable-request', emailSubject: 'test', emailMessage: 'test',
    items: [{ receiverEmail: 'crew@example.com', amountCents: 1, note: 'test', senderItemId: 'crew' }],
  }, { clientId: 'fake-id', clientSecret: 'fake-secret', fetchImpl: async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    if (String(url).endsWith('/token')) return json({ access_token: 'fake-token', expires_in: 3600 });
    if (init?.method === 'POST') return json({ name: 'DUPLICATE_BATCH_ID', links: [{ rel: 'self', href: 'https://api-m.sandbox.paypal.com/v1/payments/payouts/EXISTING' }] }, 422);
    return json({ batch_header: { payout_batch_id: 'EXISTING', batch_status: 'PENDING', sender_batch_header: { sender_batch_id: 'stable-key' } } });
  } });
  assert.equal(result.readBackBatch.batch_header.payout_batch_id, 'EXISTING');
  assert.equal(calls.filter((c) => c.startsWith('POST') && c.endsWith('/payouts')).length, 1);
});

test('one-cent test payout never settles the real contract', async () => {
  const store = createSettlementStore();
  const before = store.getState();
  let sent: { amount: { value: string } }[] = [];
  const result = await executeCrewBatchPayoutAndReadBack({
    approvalToken: createHumanApprovalToken(before.proposal.proposalVersionHash),
    expectedProposalVersionHash: before.proposal.proposalVersionHash,
    testMode: true,
  }, { store, clientId: 'fake-id', clientSecret: 'fake-secret', fetchImpl: async (url, init) => {
    if (String(url).endsWith('/token')) return json({ access_token: 'fake-token', expires_in: 3600 });
    if (init?.method === 'POST') {
      sent = JSON.parse(String(init.body)).items;
      return json({ batch_header: { payout_batch_id: 'TEST-BATCH' } });
    }
    return json({ batch_header: { payout_batch_id: 'TEST-BATCH', batch_status: 'SUCCESS' }, items: [{ sender_item_id: before.proposal.executableItems[0].senderItemId, transaction_status: 'SUCCESS', payout_item_id: 'TEST-ITEM' }] });
  } });
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].amount.value, '0.01');
  assert.equal(result.receipt?.testMode, true);
  assert.deepEqual(result.state.reconciled.crewSettlements, before.reconciled.crewSettlements);
});

test('credit review calls configured Responses endpoint and exposes upstream receipt, or honest no-key fallback', async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.AG_STUDIO_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const request = () => new Request('http://localhost/api/ai/responses', { method: 'POST', body: JSON.stringify({ action: 'credit-roll-review' }) });
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), 'https://example.test/v1/responses');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, 'review-model');
      assert.ok(body.input.includes('Moth'));
      return json({ id: 'resp_real', model: 'review-model-actual', output: [{ content: [{ type: 'output_text', text: 'Moth remains owed; Alex Rivera needs review.' }] }], usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 } }, 200, { 'x-request-id': 'req_real' });
    };
    const fallback = await (await POST(request())).json();
    assert.equal(fallback.fallback, 'deterministic-local');
    assert.equal(calls, 0);
    process.env.OPENAI_API_KEY = 'synthetic-key';
    process.env.OPENAI_BASE_URL = 'https://example.test/v1';
    process.env.OPENAI_MODELS = 'review-model';
    const response = await POST(request());
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.model, 'review-model-actual');
    assert.equal(result.requestId, 'req_real');
    assert.equal(result.responseId, 'resp_real');
    assert.equal(result.usage.total_tokens, 100);
    assert.ok(result.analysis.includes('Moth'));
    assert.equal(calls, 1);
    globalThis.fetch = async () => json({ error: { message: 'bad key' } }, 401);
    const failed = await POST(request());
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).fallback, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ['AG_STUDIO_OPENAI_API_KEY', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODELS']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
