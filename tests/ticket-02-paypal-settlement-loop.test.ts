import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type ResolveContext = { parentURL?: string };
type NextResolve = (specifier: string, context: ResolveContext) => { url: string };
type ModuleWithRegisterHooks = typeof nodeModule & {
  registerHooks?: (hooks: {
    resolve?: (specifier: string, context: ResolveContext, nextResolve: NextResolve) => { url: string };
  }) => void;
};

(nodeModule as ModuleWithRegisterHooks).registerHooks?.({
  resolve(specifier: string, context: ResolveContext, nextResolve: NextResolve) {
    if (specifier.startsWith('@/')) {
      const target = resolve(ROOT_DIR, specifier.slice(2));
      for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
        if (existsSync(target + ext)) {
          return nextResolve(pathToFileURL(target + ext).href, context);
        }
      }
    }
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file:')
    ) {
      const baseDir = dirname(fileURLToPath(context.parentURL));
      const target = resolve(baseDir, specifier);
      for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
        if (existsSync(target + ext)) {
          return nextResolve(pathToFileURL(target + ext).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  DEFAULT_CREDIT_ROLL_SCENARIO,
  createHumanApprovalToken,
} = await import('../lib/credit-roll-reconciler');

const {
  createSettlementStore,
  captureApprovedSupporterOrder,
  createAndCaptureSupporterOrder,
  createAndSendObligationInvoiceWithQr,
  executeCrewBatchPayoutAndReadBack,
  configureCreditRollRouteDeps,
  resetCreditRollSettlementState,
} = await import('../lib/credit-roll-settlement');

const { POST: postSupporterOrder } = await import('../app/api/credit-roll/supporter-order/route');
const { POST: postObligationInvoice } = await import('../app/api/credit-roll/obligation-invoice/route');
const { POST: postSettle } = await import('../app/api/credit-roll/settle/route');

type RecordedCall = {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyText: string;
};

function normalizeHeaders(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = init?.headers;
  if (!raw) return out;
  if (raw instanceof Headers) {
    raw.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(raw)) {
    for (const [key, value] of raw) {
      out[String(key).toLowerCase()] = String(value);
    }
    return out;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) {
      out[key.toLowerCase()] = String(value);
    }
  }
  return out;
}

function jsonResponse(status: number, payload: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
  });
}

test('AC 1: Creating and capturing a Behind-the-Scenes Supporter Pack order calls POST /v2/checkout/orders (intent: CAPTURE), supports capture and GET /v2/checkout/orders/{id} read-back, and records the real PayPal order ID', async () => {
  const calls: RecordedCall[] = [];
  const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);

  const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = normalizeHeaders(init);
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    calls.push({ method, url, headers, bodyText });

    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_sandbox_order_1', expires_in: 3600 });
    }
    if (method === 'POST' && url.endsWith('/v2/checkout/orders')) {
      return jsonResponse(201, {
        id: '5O190127TN364715T',
        status: 'CREATED',
        intent: 'CAPTURE',
        links: [{ href: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T', rel: 'approve' }],
      });
    }
    if (method === 'POST' && url.endsWith('/v2/checkout/orders/5O190127TN364715T/capture')) {
      return jsonResponse(201, {
        id: '5O190127TN364715T',
        status: 'PENDING',
      });
    }
    if (method === 'GET' && url.endsWith('/v2/checkout/orders/5O190127TN364715T')) {
      return jsonResponse(200, {
        id: '5O190127TN364715T',
        status: 'COMPLETED',
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: 'BTS-SUPPORTER-PACK',
            amount: { currency_code: 'USD', value: '25.00' },
          },
        ],
      });
    }
    return jsonResponse(404, { message: `Unhandled URL ${method} ${url}` });
  };

  const result = await createAndCaptureSupporterOrder(
    {
      supporterName: 'Lin Producer',
      supporterEmail: 'lin.supporter@creditroll.dev',
      amountCents: 2500,
      personId: 'crew-dj-owl',
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.statusCode, 200);
  assert.ok(result.receipt);
  assert.equal(result.receipt.orderId, '5O190127TN364715T');
  // Status must reflect GET read-back ('COMPLETED'), not the transient capture POST status ('PENDING')
  assert.equal(result.receipt.status, 'COMPLETED');
  assert.equal(result.receipt.amountCents, 2500);

  const createCall = calls.find((c) => c.method === 'POST' && c.url.endsWith('/v2/checkout/orders'));
  assert.ok(createCall, 'Expected POST /v2/checkout/orders');
  assert.ok(createCall.headers['paypal-request-id'], 'Expected PayPal-Request-Id header on order creation');
  const createBody = JSON.parse(createCall.bodyText) as {
    intent: string;
    purchase_units: { amount: { currency_code: string; value: string } }[];
  };
  assert.equal(createBody.intent, 'CAPTURE');
  assert.equal(createBody.purchase_units[0]?.amount.currency_code, 'USD');
  assert.equal(createBody.purchase_units[0]?.amount.value, '25.00');

  const captureCall = calls.find(
    (c) => c.method === 'POST' && c.url.endsWith('/v2/checkout/orders/5O190127TN364715T/capture'),
  );
  assert.ok(captureCall, 'Expected POST /v2/checkout/orders/{id}/capture');

  const getCall = calls.find(
    (c) => c.method === 'GET' && c.url.endsWith('/v2/checkout/orders/5O190127TN364715T'),
  );
  assert.ok(getCall, 'Expected GET /v2/checkout/orders/{id} read-back');

  const djOwlRow = store.getState().reconciled.crewSettlements.find((s) => s.personId === 'crew-dj-owl');
  assert.equal(djOwlRow?.paypalOrderId, '5O190127TN364715T');

  // Also verify via the Next.js API route handler seam
  resetCreditRollSettlementState(DEFAULT_CREDIT_ROLL_SCENARIO);
  configureCreditRollRouteDeps({
    fetchImpl: mockFetch,
    clientId: 'sb_client_id',
    clientSecret: 'sb_client_secret',
  });
  const routeRes = await postSupporterOrder(
    new Request('http://localhost:3000/api/credit-roll/supporter-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 2500, personId: 'crew-dj-owl' }),
    }),
  );
  assert.equal(routeRes.status, 200);
  const routeBody = (await routeRes.json()) as { ok: boolean; receipt: { orderId: string; status: string } };
  assert.equal(routeBody.ok, true);
  assert.equal(routeBody.receipt.orderId, '5O190127TN364715T');
  assert.equal(routeBody.receipt.status, 'COMPLETED');
  configureCreditRollRouteDeps(null);
});

test('AC 2: Generating a production obligation invoice calls POST /v2/invoicing/invoices, POST /v2/invoicing/invoices/{id}/send, POST /v2/invoicing/invoices/{id}/generate-qr-code, and GET /v2/invoicing/invoices/{id} to return a live PayPal Sandbox invoice ID, status, and base64 QR image', async () => {
  const calls: RecordedCall[] = [];
  const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const sampleQrBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = normalizeHeaders(init);
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    calls.push({ method, url, headers, bodyText });

    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_sandbox_inv_1', expires_in: 3600 });
    }
    if (method === 'POST' && url.endsWith('/v2/invoicing/invoices')) {
      return jsonResponse(201, {
        id: 'INV2-Z56S-5LLA-Q52L-CPZ5',
        status: 'DRAFT',
      });
    }
    if (method === 'POST' && url.endsWith('/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5/send')) {
      return jsonResponse(202, {
        href: 'https://www.sandbox.paypal.com/invoice/p/#INV2-Z56S-5LLA-Q52L-CPZ5',
      });
    }
    if (
      method === 'POST' &&
      url.endsWith('/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5/generate-qr-code')
    ) {
      return jsonResponse(200, {
        qr_code: sampleQrBase64,
      });
    }
    if (method === 'GET' && url.endsWith('/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5')) {
      return jsonResponse(200, {
        id: 'INV2-Z56S-5LLA-Q52L-CPZ5',
        status: 'SENT',
        detail: {
          invoice_number: 'CRLIVE-INV-MOTH-001',
          currency_code: 'USD',
          invoice_date: '2026-11-02',
        },
        amount: { currency_code: 'USD', value: '1400.00' },
        due_amount: { currency_code: 'USD', value: '1400.00' },
      });
    }
    return jsonResponse(404, { message: `Unhandled URL ${method} ${url}` });
  };

  const result = await createAndSendObligationInvoiceWithQr(
    {
      personId: 'crew-moth',
      recipientEmail: 'bond.completion.sandbox@creditroll.dev',
      recipientName: 'Completion Bond Escrow',
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.statusCode, 200);
  assert.ok(result.receipt);
  assert.equal(result.receipt.invoiceId, 'INV2-Z56S-5LLA-Q52L-CPZ5');
  assert.equal(result.receipt.status, 'SENT');
  assert.equal(result.receipt.qrCodeBase64, sampleQrBase64);
  assert.equal(result.receipt.qrCodeDataUrl, `data:image/png;base64,${sampleQrBase64}`);
  assert.equal(result.receipt.amountCents, 140000);

  const endpointPaths = calls
    .filter((c) => !c.url.endsWith('/v1/oauth2/token'))
    .map((c) => `${c.method} ${new URL(c.url).pathname}`);
  assert.deepEqual(endpointPaths, [
    'POST /v2/invoicing/invoices',
    'POST /v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5/send',
    'POST /v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5/generate-qr-code',
    'GET /v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5',
  ]);

  const mothRow = store.getState().reconciled.crewSettlements.find((s) => s.personId === 'crew-moth');
  assert.equal(mothRow?.paypalInvoiceId, 'INV2-Z56S-5LLA-Q52L-CPZ5');

  // Verify via Next.js route handler
  resetCreditRollSettlementState(DEFAULT_CREDIT_ROLL_SCENARIO);
  configureCreditRollRouteDeps({
    fetchImpl: mockFetch,
    clientId: 'sb_client_id',
    clientSecret: 'sb_client_secret',
  });
  const routeRes = await postObligationInvoice(
    new Request('http://localhost:3000/api/credit-roll/obligation-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: 'crew-moth' }),
    }),
  );
  assert.equal(routeRes.status, 200);
  const routeJson = (await routeRes.json()) as {
    ok: boolean;
    receipt: { invoiceId: string; status: string; qrCodeBase64: string };
  };
  assert.equal(routeJson.ok, true);
  assert.equal(routeJson.receipt.invoiceId, 'INV2-Z56S-5LLA-Q52L-CPZ5');
  assert.equal(routeJson.receipt.status, 'SENT');
  assert.equal(routeJson.receipt.qrCodeBase64, sampleQrBase64);
  configureCreditRollRouteDeps(null);
});

test('AC 3: Executing crew batch settlement requires a valid human approval token bound to the current proposalVersionHash and calls POST /v1/payments/payouts followed by GET /v1/payments/payouts/{batch_id}, updating each crew member status to PAID only when their individual item transaction_status is SUCCESS (preserving PENDING, UNCLAIMED, or FAILED otherwise)', async () => {
  const calls: RecordedCall[] = [];
  const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const proposal = store.getState().proposal;
  const approvalToken = createHumanApprovalToken(proposal.proposalVersionHash, 'producer-patchbay');

  const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = normalizeHeaders(init);
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    calls.push({ method, url, headers, bodyText });

    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_sandbox_payout_1', expires_in: 3600 });
    }
    if (method === 'POST' && url.endsWith('/v1/payments/payouts')) {
      return jsonResponse(201, {
        batch_header: {
          payout_batch_id: 'PBATCH-SANDBOX-9001',
          batch_status: 'PENDING',
        },
      });
    }
    if (method === 'GET' && url.endsWith('/v1/payments/payouts/PBATCH-SANDBOX-9001')) {
      return jsonResponse(200, {
        batch_header: {
          payout_batch_id: 'PBATCH-SANDBOX-9001',
          batch_status: 'SUCCESS',
          sender_batch_header: {
            sender_batch_id: proposal.senderBatchId,
          },
        },
        items: [
          {
            payout_item_id: 'PITEM-DJ-OWL-1',
            transaction_id: 'TX-DJ-OWL-1',
            transaction_status: 'SUCCESS',
            payout_batch_id: 'PBATCH-SANDBOX-9001',
            payout_item: {
              recipient_type: 'EMAIL',
              amount: { value: '1850.00', currency: 'USD' },
              receiver: 'aria.djowl.sandbox@creditroll.dev',
              sender_item_id: 'CTR-2026-101-CREW-DJ-OWL',
            },
          },
          {
            payout_item_id: 'PITEM-MOTH-2',
            transaction_id: 'TX-MOTH-2',
            transaction_status: 'PENDING',
            payout_batch_id: 'PBATCH-SANDBOX-9001',
            payout_item: {
              recipient_type: 'EMAIL',
              amount: { value: '1400.00', currency: 'USD' },
              receiver: 'marcus.moth.sandbox@creditroll.dev',
              sender_item_id: 'CTR-2026-102-CREW-MOTH',
            },
          },
          {
            payout_item_id: 'PITEM-ELENA-3',
            transaction_id: 'TX-ELENA-3',
            transaction_status: 'UNCLAIMED',
            payout_batch_id: 'PBATCH-SANDBOX-9001',
            payout_item: {
              recipient_type: 'EMAIL',
              amount: { value: '2200.00', currency: 'USD' },
              receiver: 'elena.nyx.sandbox@creditroll.dev',
              sender_item_id: 'CTR-2026-103-CREW-ELENA-ROSTOVA',
            },
          },
          {
            payout_item_id: 'PITEM-HANA-4',
            transaction_id: 'TX-HANA-4',
            transaction_status: 'FAILED',
            payout_batch_id: 'PBATCH-SANDBOX-9001',
            payout_item: {
              recipient_type: 'EMAIL',
              amount: { value: '1600.00', currency: 'USD' },
              receiver: 'hana.sato.sandbox@creditroll.dev',
              sender_item_id: 'CTR-2026-104-CREW-HANA-SATO',
            },
          },
        ],
      });
    }
    return jsonResponse(404, { message: `Unhandled URL ${method} ${url}` });
  };

  const settlementResult = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken,
      expectedProposalVersionHash: proposal.proposalVersionHash,
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );

  assert.equal(settlementResult.ok, true);
  assert.equal(settlementResult.statusCode, 200);
  assert.equal(settlementResult.idempotentReplay, false);
  assert.ok(settlementResult.receipt);
  assert.equal(settlementResult.receipt.payoutBatchId, 'PBATCH-SANDBOX-9001');
  assert.equal(settlementResult.receipt.proposalVersionHash, proposal.proposalVersionHash);

  const postPayoutCall = calls.find((c) => c.method === 'POST' && c.url.endsWith('/v1/payments/payouts'));
  assert.ok(postPayoutCall, 'Expected POST /v1/payments/payouts');
  assert.equal(postPayoutCall.headers['paypal-request-id'], proposal.paypalRequestId);

  const getPayoutCall = calls.find(
    (c) => c.method === 'GET' && c.url.endsWith('/v1/payments/payouts/PBATCH-SANDBOX-9001'),
  );
  assert.ok(getPayoutCall, 'Expected GET /v1/payments/payouts/{batch_id} read-back');

  const updatedRows = store.getState().reconciled.crewSettlements;
  const byPerson = new Map(updatedRows.map((row) => [row.personId, row]));

  // Only DJ Owl had transaction_status: SUCCESS -> badgeStatus: PAID
  const djOwl = byPerson.get('crew-dj-owl');
  assert.ok(djOwl);
  assert.equal(djOwl.badgeStatus, 'PAID');
  assert.equal(djOwl.transactionStatus, 'SUCCESS');
  assert.equal(djOwl.paypalPayoutBatchId, 'PBATCH-SANDBOX-9001');
  assert.equal(djOwl.paypalPayoutItemId, 'PITEM-DJ-OWL-1');

  // Moth had transaction_status: PENDING -> badgeStatus: PENDING (not PAID)
  const moth = byPerson.get('crew-moth');
  assert.ok(moth);
  assert.equal(moth.badgeStatus, 'PENDING');
  assert.equal(moth.transactionStatus, 'PENDING');
  assert.equal(moth.paypalPayoutItemId, 'PITEM-MOTH-2');

  // Elena had transaction_status: UNCLAIMED -> badgeStatus: UNCLAIMED (not PAID)
  const elena = byPerson.get('crew-elena-rostova');
  assert.ok(elena);
  assert.equal(elena.badgeStatus, 'UNCLAIMED');
  assert.equal(elena.transactionStatus, 'UNCLAIMED');
  assert.equal(elena.paypalPayoutItemId, 'PITEM-ELENA-3');

  // Hana had transaction_status: FAILED -> badgeStatus: FAILED (not PAID)
  const hana = byPerson.get('crew-hana-sato');
  assert.ok(hana);
  assert.equal(hana.badgeStatus, 'FAILED');
  assert.equal(hana.transactionStatus, 'FAILED');
  assert.equal(hana.paypalPayoutItemId, 'PITEM-HANA-4');

  // Homonymous Alex Rivera remained NEEDS_REVIEW and untouched
  const alex = updatedRows.find((r) => r.stageName.includes('Alex Rivera'));
  assert.ok(alex);
  assert.equal(alex.badgeStatus, 'NEEDS_REVIEW');
  assert.equal(alex.transactionStatus, 'NEEDS_REVIEW');
  assert.equal(alex.paypalPayoutBatchId, null);
});

test('AC 4: Submitting the same approved proposalVersionHash twice returns the existing batch settlement record without issuing a second POST /v1/payments/payouts call', async () => {
  const calls: RecordedCall[] = [];
  const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const proposal = store.getState().proposal;
  const approvalToken = createHumanApprovalToken(proposal.proposalVersionHash, 'producer-patchbay');

  const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = normalizeHeaders(init);
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    calls.push({ method, url, headers, bodyText });

    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_idempotent_1', expires_in: 3600 });
    }
    if (method === 'POST' && url.endsWith('/v1/payments/payouts')) {
      return jsonResponse(201, {
        batch_header: {
          payout_batch_id: 'PBATCH-IDEMPOTENT-777',
          batch_status: 'PENDING',
        },
      });
    }
    if (method === 'GET' && url.endsWith('/v1/payments/payouts/PBATCH-IDEMPOTENT-777')) {
      return jsonResponse(200, {
        batch_header: {
          payout_batch_id: 'PBATCH-IDEMPOTENT-777',
          batch_status: 'SUCCESS',
          sender_batch_header: {
            sender_batch_id: proposal.senderBatchId,
          },
        },
        items: proposal.executableItems.map((item, idx) => ({
          payout_item_id: `PITEM-IDEMP-${idx + 1}`,
          transaction_id: `TX-IDEMP-${idx + 1}`,
          transaction_status: 'SUCCESS',
          payout_batch_id: 'PBATCH-IDEMPOTENT-777',
          payout_item: {
            recipient_type: 'EMAIL',
            amount: { value: item.amountUsd.toFixed(2), currency: 'USD' },
            receiver: item.receiverEmail,
            sender_item_id: item.senderItemId,
          },
        })),
      });
    }
    return jsonResponse(404, { message: `Unhandled URL ${method} ${url}` });
  };

  const firstAttempt = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken,
      expectedProposalVersionHash: proposal.proposalVersionHash,
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );

  assert.equal(firstAttempt.ok, true);
  assert.equal(firstAttempt.idempotentReplay, false);
  assert.equal(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/v1/payments/payouts')).length,
    1,
    'Positive control: first submission must issue exactly one POST /v1/payments/payouts call',
  );

  const secondAttempt = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken,
      expectedProposalVersionHash: proposal.proposalVersionHash,
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );

  assert.equal(secondAttempt.ok, true);
  assert.equal(secondAttempt.statusCode, 200);
  assert.equal(secondAttempt.idempotentReplay, true);
  assert.equal(secondAttempt.receipt?.payoutBatchId, 'PBATCH-IDEMPOTENT-777');
  assert.equal(secondAttempt.receipt?.proposalVersionHash, proposal.proposalVersionHash);
  assert.equal(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/v1/payments/payouts')).length,
    1,
    'Second identical submission must not issue a second POST /v1/payments/payouts call',
  );
});

test('AC 5: Settlement requests missing the human approval token, carrying a stale proposalVersionHash, or attempting to include a NEEDS_REVIEW recipient are rejected with HTTP 400 before any PayPal network request is sent', async () => {
  const calls: RecordedCall[] = [];
  const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const proposal = store.getState().proposal;
  const validToken = createHumanApprovalToken(proposal.proposalVersionHash);
  const needsReviewRow = store
    .getState()
    .reconciled.crewSettlements.find((s) => s.reconciliationStatus === 'NEEDS_REVIEW');
  assert.ok(needsReviewRow, 'Expected pre-seeded NEEDS_REVIEW row in scenario');

  const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url, headers: normalizeHeaders(init), bodyText: '' });
    return jsonResponse(200, { batch_header: { payout_batch_id: 'SHOULD-NOT-BE-CALLED' } });
  };

  // Case A: Missing human approval token
  const missingTokenRes = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken: '',
      expectedProposalVersionHash: proposal.proposalVersionHash,
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );
  assert.equal(missingTokenRes.ok, false);
  assert.equal(missingTokenRes.statusCode, 400);
  assert.equal(missingTokenRes.validation?.errors.includes('MISSING_HUMAN_APPROVAL_TOKEN'), true);

  // Case B: Stale proposalVersionHash
  const staleHashRes = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken: validToken,
      expectedProposalVersionHash: 'CRLIVE-STALE-VERSION-HASH-000',
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );
  assert.equal(staleHashRes.ok, false);
  assert.equal(staleHashRes.statusCode, 400);
  assert.equal(staleHashRes.validation?.errors.includes('STALE_PROPOSAL_VERSION_HASH'), true);

  // Case C: Attempting to include a NEEDS_REVIEW recipient
  const needsReviewRes = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken: validToken,
      expectedProposalVersionHash: proposal.proposalVersionHash,
      requestedPersonIds: ['crew-dj-owl', needsReviewRow.personId],
    },
    {
      store,
      fetchImpl: mockFetch,
      clientId: 'sb_client_id',
      clientSecret: 'sb_client_secret',
    },
  );
  assert.equal(needsReviewRes.ok, false);
  assert.equal(needsReviewRes.statusCode, 400);
  assert.equal(needsReviewRes.validation?.errors.includes('NEEDS_REVIEW_RECIPIENT_BLOCKED'), true);

  // Zero network calls were made across all three rejected guardrail attempts
  assert.equal(calls.length, 0, 'No PayPal network request may be sent when guardrails reject with 400');

  // Verify HTTP 400 at Next.js /api/credit-roll/settle route handler seam as well
  resetCreditRollSettlementState(DEFAULT_CREDIT_ROLL_SCENARIO);
  configureCreditRollRouteDeps({
    fetchImpl: mockFetch,
    clientId: 'sb_client_id',
    clientSecret: 'sb_client_secret',
  });
  const routeRes = await postSettle(
    new Request('http://localhost:3000/api/credit-roll/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvalToken: '',
        expectedProposalVersionHash: proposal.proposalVersionHash,
      }),
    }),
  );
  assert.equal(routeRes.status, 400);
  assert.equal(calls.length, 0);
  configureCreditRollRouteDeps(null);
});

test('AC 6: When PayPal returns a non-2xx error or timeout on a write endpoint, the server preserves the pre-mutation settlement state, surfaces the PayPal status and debug_id without leaking PAYPAL_SECRET, and never marks failed or pending items as PAID', async () => {
  const fakeSecret = 'FAKE_PP_SECRET_DO_NOT_ECHO_991122';
  const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const beforeSettlements = structuredClone(store.getState().reconciled.crewSettlements);
  const proposal = store.getState().proposal;
  const approvalToken = createHumanApprovalToken(proposal.proposalVersionHash, 'producer-patchbay');

  // Positive control for our secret detector: verify the check catches the synthetic secret if present
  assert.equal(`error with ${fakeSecret}`.includes(fakeSecret), true);

  // Sub-case 1: PayPal returns non-2xx (422) with debug_id and accidental secret echo in upstream body
  const non2xxFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_err_test_1', expires_in: 3600 });
    }
    if (method === 'POST' && url.endsWith('/v1/payments/payouts')) {
      return jsonResponse(
        422,
        {
          name: 'INSUFFICIENT_FUNDS',
          message: `Payout declined by sandbox processor (auth=${fakeSecret})`,
          debug_id: 'dbg_payout_422_xyz',
        },
        { 'paypal-debug-id': 'dbg_payout_422_xyz' },
      );
    }
    return jsonResponse(500, { message: 'Unexpected call', debug_id: 'dbg_unexpected' });
  };

  const errorResult = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken,
      expectedProposalVersionHash: proposal.proposalVersionHash,
    },
    {
      store,
      fetchImpl: non2xxFetch,
      clientId: 'sb_client_id',
      clientSecret: fakeSecret,
    },
  );

  assert.equal(errorResult.ok, false);
  assert.equal(errorResult.statusCode, 422);
  assert.equal(errorResult.error?.paypalStatus, 422);
  assert.equal(errorResult.error?.debugId, 'dbg_payout_422_xyz');

  const serializedErrorResult = JSON.stringify(errorResult);
  assert.equal(
    serializedErrorResult.includes(fakeSecret),
    false,
    'synthetic PAYPAL_SECRET leaked in settlement error output',
  );

  // Pre-mutation settlement state must be preserved with zero items marked PAID
  const afterNon2xxSettlements = store.getState().reconciled.crewSettlements;
  assert.deepEqual(afterNon2xxSettlements, beforeSettlements);
  assert.equal(
    afterNon2xxSettlements.some((s) => s.badgeStatus === 'PAID' || s.transactionStatus === 'SUCCESS'),
    false,
  );

  // Sub-case 2: Network timeout / AbortError on write endpoint
  const timeoutFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_timeout_test_1', expires_in: 3600 });
    }
    const abortErr = new Error(`Request timed out while calling ${url} with secret ${fakeSecret}`);
    abortErr.name = 'TimeoutError';
    throw abortErr;
  };

  const timeoutResult = await executeCrewBatchPayoutAndReadBack(
    {
      approvalToken,
      expectedProposalVersionHash: proposal.proposalVersionHash,
    },
    {
      store,
      fetchImpl: timeoutFetch,
      clientId: 'sb_client_id',
      clientSecret: fakeSecret,
    },
  );

  assert.equal(timeoutResult.ok, false);
  assert.equal(timeoutResult.statusCode, 504);
  assert.equal(
    JSON.stringify(timeoutResult).includes(fakeSecret),
    false,
    'synthetic PAYPAL_SECRET leaked in timeout error output',
  );
  assert.deepEqual(store.getState().reconciled.crewSettlements, beforeSettlements);
});

test('Live sandbox: a CAPTURE order the supporter has not approved yet is recorded as pending with its approve link, while other capture failures still fail', async () => {
  const approveHref = 'https://www.sandbox.paypal.com/checkoutnow?token=8H093206YF5676710';
  const notApprovedBody = {
    name: 'UNPROCESSABLE_ENTITY',
    details: [{ issue: 'ORDER_NOT_APPROVED', description: 'Payer has not yet approved the Order for payment.' }],
    debug_id: 'dbg_not_approved',
  };

  const run = async (captureFailure: { status: number; body: unknown }) => {
    const calls: RecordedCall[] = [];
    const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ method, url, headers: normalizeHeaders(init), bodyText: typeof init?.body === 'string' ? init.body : '' });
      if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
        return jsonResponse(200, { access_token: 'tok_sandbox_pending', expires_in: 3600 });
      }
      if (method === 'POST' && url.endsWith('/v2/checkout/orders')) {
        return jsonResponse(201, { id: '8H093206YF5676710', status: 'CREATED', links: [{ rel: 'approve', href: approveHref }] });
      }
      if (method === 'POST' && url.endsWith('/v2/checkout/orders/8H093206YF5676710/capture')) {
        return jsonResponse(captureFailure.status, captureFailure.body);
      }
      if (method === 'GET' && url.endsWith('/v2/checkout/orders/8H093206YF5676710')) {
        return jsonResponse(200, { id: '8H093206YF5676710', status: 'CREATED', links: [{ rel: 'approve', href: approveHref }] });
      }
      return jsonResponse(404, { message: `Unhandled URL ${method} ${url}` });
    };
    const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
    const result = await createAndCaptureSupporterOrder(
      { personId: 'crew-dj-owl', amountCents: 2500 },
      { store, fetchImpl: mockFetch, clientId: 'sb_client_id', clientSecret: 'sb_client_secret' },
    );
    return { result, calls, store };
  };

  const pending = await run({ status: 422, body: notApprovedBody });
  assert.equal(pending.result.ok, true, 'ORDER_NOT_APPROVED is a pending order, not a failed one');
  assert.equal(pending.result.receipt?.orderId, '8H093206YF5676710');
  assert.equal(pending.result.receipt?.status, 'CREATED');
  assert.equal(pending.result.receipt?.approveUrl, approveHref);
  assert.equal(pending.store.getState().supporterOrders.length, 1);
  assert.equal(
    pending.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/capture')).length,
    1,
    'capture is attempted exactly once',
  );
  assert.equal(
    pending.calls.some((c) => c.method === 'GET' && c.url.endsWith('/v2/checkout/orders/8H093206YF5676710')),
    true,
    'the pending order is still read back with GET',
  );

  const refused = await run({
    status: 422,
    body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }], debug_id: 'dbg_declined' },
  });
  assert.equal(refused.result.ok, false);
  assert.equal(refused.result.statusCode, 422);
  assert.equal(refused.result.error?.debugId, 'dbg_declined');
  assert.equal(refused.store.getState().supporterOrders.length, 0);
});

test('Live sandbox: obligation invoice numbers stay within the length PayPal accepted and never repeat, even for long person ids or after the store restarts', async () => {
  const sentNumbers: string[] = [];
  const sentRequestIds: string[] = [];
  const sampleQrBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  let invoiceSeq = 0;

  const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_sandbox_numbers', expires_in: 3600 });
    }
    if (method === 'POST' && url.endsWith('/v2/invoicing/invoices')) {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { detail?: { invoice_number?: string } };
      sentNumbers.push(body.detail?.invoice_number ?? '');
      sentRequestIds.push(normalizeHeaders(init)['paypal-request-id'] ?? '');
      invoiceSeq += 1;
      return jsonResponse(201, { id: `INV2-TEST-${invoiceSeq}`, status: 'DRAFT' });
    }
    if (method === 'POST' && /\/v2\/invoicing\/invoices\/INV2-TEST-\d+\/send$/.test(url)) {
      return jsonResponse(202, {});
    }
    if (method === 'POST' && /\/generate-qr-code$/.test(url)) {
      return jsonResponse(200, { qr_code: sampleQrBase64 });
    }
    const readBack = /\/v2\/invoicing\/invoices\/(INV2-TEST-\d+)$/.exec(url);
    if (method === 'GET' && readBack) {
      return jsonResponse(200, { id: readBack[1], status: 'SENT', detail: { currency_code: 'USD' } });
    }
    return jsonResponse(404, { message: `Unhandled URL ${method} ${url}` });
  };
  const options = (store: ReturnType<typeof createSettlementStore>) => ({
    store,
    fetchImpl: mockFetch,
    clientId: 'sb_client_id',
    clientSecret: 'sb_client_secret',
  });

  const firstStore = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const nyx = await createAndSendObligationInvoiceWithQr({ personId: 'crew-elena-rostova' }, options(firstStore));
  const moth = await createAndSendObligationInvoiceWithQr({ personId: 'crew-moth' }, options(firstStore));
  const restartedStore = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const mothAfterRestart = await createAndSendObligationInvoiceWithQr({ personId: 'crew-moth' }, options(restartedStore));

  for (const result of [nyx, moth, mothAfterRestart]) {
    assert.equal(result.ok, true, JSON.stringify(result.error));
  }
  assert.equal(sentNumbers.length, 3);
  for (const invoiceNumber of sentNumbers) {
    assert.ok(invoiceNumber.length > 0 && invoiceNumber.length <= 23, `invoice_number "${invoiceNumber}" exceeds 23 characters`);
  }
  assert.equal(new Set(sentNumbers).size, 3, 'every issued invoice gets its own number');
  assert.equal(new Set(sentRequestIds).size, 3, 'every issued invoice gets its own PayPal-Request-Id');
});

test('Live sandbox: once the supporter approves at PayPal, capturing the pending order reads it back COMPLETED and replaces the pending record; unknown or still-unapproved orders are refused', async () => {
  const orderId = '31S06570LA976733L';
  const approveHref = `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`;
  let payerApproved = false;
  let captured = false;
  const calls: RecordedCall[] = [];

  const mockFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url, headers: normalizeHeaders(init), bodyText: typeof init?.body === 'string' ? init.body : '' });
    if (method === 'POST' && url.endsWith('/v1/oauth2/token')) {
      return jsonResponse(200, { access_token: 'tok_sandbox_capture', expires_in: 3600 });
    }
    if (method === 'POST' && url.endsWith('/v2/checkout/orders')) {
      return jsonResponse(201, { id: orderId, status: 'CREATED', links: [{ rel: 'approve', href: approveHref }] });
    }
    if (method === 'POST' && url.endsWith(`/v2/checkout/orders/${orderId}/capture`)) {
      if (!payerApproved) {
        return jsonResponse(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_NOT_APPROVED' }], debug_id: 'dbg_not_yet' });
      }
      captured = true;
      return jsonResponse(201, { id: orderId, status: 'COMPLETED' });
    }
    if (method === 'GET' && url.endsWith(`/v2/checkout/orders/${orderId}`)) {
      return jsonResponse(200, {
        id: orderId,
        status: captured ? 'COMPLETED' : payerApproved ? 'APPROVED' : 'CREATED',
        links: captured ? [] : [{ rel: 'approve', href: approveHref }],
      });
    }
    return jsonResponse(404, { message: `Unhandled URL ${method} ${url}` });
  };
  const store = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
  const options = { store, fetchImpl: mockFetch, clientId: 'sb_client_id', clientSecret: 'sb_client_secret' };

  const pending = await createAndCaptureSupporterOrder({ personId: 'crew-dj-owl', amountCents: 2500 }, options);
  assert.equal(pending.receipt?.status, 'CREATED');

  const unknown = await captureApprovedSupporterOrder({ orderId: 'NOT-A-SESSION-ORDER' }, options);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.statusCode, 404);
  assert.equal(unknown.error?.code, 'UNKNOWN_SUPPORTER_ORDER');

  const tooEarly = await captureApprovedSupporterOrder({ orderId }, options);
  assert.equal(tooEarly.ok, false, 'capturing before the supporter approves is refused by PayPal and surfaced');
  assert.equal(tooEarly.statusCode, 422);

  payerApproved = true;
  const done = await captureApprovedSupporterOrder({ orderId }, options);
  assert.equal(done.ok, true, JSON.stringify(done.error));
  assert.equal(done.receipt?.orderId, orderId);
  assert.equal(done.receipt?.status, 'COMPLETED');
  assert.equal(done.receipt?.approveUrl, null);
  assert.equal(store.getState().supporterOrders.length, 1, 'the captured order replaces its pending record');
  assert.equal(store.getState().supporterOrders[0]?.status, 'COMPLETED');

  const captureRequestIds = calls
    .filter((c) => c.method === 'POST' && c.url.endsWith('/capture'))
    .map((c) => c.headers['paypal-request-id']);
  assert.equal(captureRequestIds.length, 3);
  assert.notEqual(captureRequestIds[2], captureRequestIds[0], 'the post-approval capture does not reuse the refused request id');
});
