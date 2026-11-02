import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import type { AgWidgetCrossFilterParams } from 'ag-studio';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type ResolveContext = { parentURL?: string };
type NextResolve = (specifier: string, context: ResolveContext) => { url: string };
type LoadContext = { format?: string };
type NextLoad = (url: string, context: LoadContext) => { format: string; source: string | ArrayBuffer; shortCircuit?: boolean };
type ModuleWithRegisterHooks = typeof nodeModule & {
  registerHooks?: (hooks: {
    resolve?: (specifier: string, context: ResolveContext, nextResolve: NextResolve) => { url: string };
    load?: (url: string, context: LoadContext, nextLoad: NextLoad) => { format: string; source: string | ArrayBuffer; shortCircuit?: boolean };
  }) => void;
};

(nodeModule as ModuleWithRegisterHooks).registerHooks?.({
  resolve(specifier: string, context: ResolveContext, nextResolve: NextResolve) {
    if (context.parentURL?.includes('/node_modules/')) {
      return nextResolve(specifier, context);
    }
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
  load(url: string, context: LoadContext, nextLoad: NextLoad) {
    if (url.startsWith('file:') && url.endsWith('.tsx')) {
      const filePath = fileURLToPath(url);
      const rawSource = readFileSync(filePath, 'utf8');
      const transpiled = ts.transpileModule(rawSource, {
        fileName: filePath,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      });
      const normalized = transpiled.outputText
        .replace(
          /import\s*\{([^}]+)\}\s*from\s*["']react\/jsx-runtime["'];?/g,
          (_, bindings: string) =>
            `import _jsxRuntimePkg from "react/jsx-runtime"; const {${bindings.replace(/\s+as\s+/g, ': ')}} = _jsxRuntimePkg;`,
        )
        .replace(
          /import\s*\{([^}]+)\}\s*from\s*["']react["'];?/g,
          (_, bindings: string) =>
            `import _reactPkg from "react"; const {${bindings.replace(/\s+as\s+/g, ': ')}} = _reactPkg;`,
        );
      return {
        format: 'module',
        source: normalized,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const { dashboardReport } = await import('../app/dashboard/studio/initial-report');
const { defaultReport } = await import('../app/dashboard/reports-store');
const aiModule = (await import('../app/dashboard/studio/ai')) as Record<string, unknown>;
const {
  CreditRollStageWidget,
  GhostPatchbayWidget,
} = await import('../app/dashboard/studio/credit-roll-widgets');
const {
  buildCreditRollWidgetDefinitions,
  createCreditRollStudioWidgets,
  createInitialCreditRollInteractiveState,
  selectCutVersionView,
  dispatchContributorCrossFilter,
  runPatchbaySandboxAction,
} = await import('../app/dashboard/studio/credit-roll-widget-state');

test('AC 1: Both credit-roll-stage and ghost-patchbay custom widgets are registered via AG Studio widget registration API with complete formatShape and ai metadata and appear on the credit-roll studio report page alongside relational AG Grid and KPI widgets', () => {
  const widgetDefinitions = buildCreditRollWidgetDefinitions({
    stageComp: CreditRollStageWidget,
    patchbayComp: GhostPatchbayWidget,
  });
  assert.equal(Array.isArray(widgetDefinitions), true);
  const stageDef = widgetDefinitions.find((w) => w.id === 'credit-roll-stage');
  const patchbayDef = widgetDefinitions.find((w) => w.id === 'ghost-patchbay');

  assert.ok(stageDef, 'Expected credit-roll-stage custom widget definition');
  assert.ok(patchbayDef, 'Expected ghost-patchbay custom widget definition');

  for (const def of [stageDef, patchbayDef]) {
    assert.equal(typeof def.formatShape, 'function', `Expected formatShape function on ${def.id}`);
    assert.equal(typeof def.form, 'function', `Expected form builder on ${def.id}`);
    assert.ok(def.ai, `Expected ai metadata on ${def.id}`);
    assert.ok(def.ai.label && def.ai.label.length > 0, `Expected ai.label on ${def.id}`);
    assert.ok(def.ai.description && def.ai.description.length > 10, `Expected ai.description on ${def.id}`);
    assert.ok(def.ai.usage && def.ai.usage.length > 10, `Expected ai.usage on ${def.id}`);
    assert.ok(def.ai.configuration && def.ai.configuration.length > 10, `Expected ai.configuration on ${def.id}`);
  }

  const widgetsConfig = createCreditRollStudioWidgets({
    stageComp: CreditRollStageWidget,
    patchbayComp: GhostPatchbayWidget,
  });
  const registeredIds = widgetsConfig.widgets.map((w: { id: string }) => w.id);
  assert.equal(registeredIds.includes('credit-roll-stage'), true);
  assert.equal(registeredIds.includes('ghost-patchbay'), true);
  assert.equal(registeredIds.includes('grid'), true);
  assert.equal(registeredIds.includes('value'), true);

  const pageIds = dashboardReport.pages.map((p) => p.id);
  assert.deepEqual(pageIds, ['credit-roll', 'revenue', 'receivables', 'cash', 'catalogue']);
  assert.equal(dashboardReport.selectedPageId, 'credit-roll');

  const creditRollPage = dashboardReport.pages.find((p) => p.id === 'credit-roll');
  assert.ok(creditRollPage && creditRollPage.widgets);
  const widgetTypes = Object.values(creditRollPage.widgets).map((w) => String(w?.type));
  assert.equal(widgetTypes.includes('credit-roll-stage'), true);
  assert.equal(widgetTypes.includes('ghost-patchbay'), true);
  assert.equal(widgetTypes.includes('grid'), true);
  assert.equal(widgetTypes.includes('value'), true);

  const builtInSaved = defaultReport();
  assert.equal(builtInSaved.pageTitles['credit-roll'], 'CreditRoll Live');
  assert.equal(builtInSaved.pageTitles.revenue, 'Revenue');
  assert.equal(builtInSaved.pageTitles.receivables, 'Receivables');
  assert.equal(builtInSaved.pageTitles.cash, 'Cash & payouts');
  assert.equal(builtInSaved.pageTitles.catalogue, 'Catalogue');
});

test('AC 2: Toggling between Cut v1 (Rough Cut) and Cut v2 (Director Cut) highlights cut contributors as translucent UNPAID_GHOST nodes ("Removed from Cut v2 · Contract Fee Still Owed") and clears any stale action error banner', () => {
  const initialState = {
    ...createInitialCreditRollInteractiveState(),
    cutVersion: 'v1' as const,
    errorBanner: {
      code: 'PAYPAL_TIMEOUT',
      message: 'Stale error from previous cut view',
    },
  };

  const v1State = selectCutVersionView(initialState, 'v1');
  assert.equal(v1State.cutVersion, 'v1');
  assert.equal(v1State.errorBanner, null, 'Switching cut version must clear stale errorBanner');
  const mothInV1 = v1State.stageNodes.find((n) => n.personId === 'crew-moth');
  assert.ok(mothInV1, 'Expected Moth on Credit Roll Stage in Cut v1');
  assert.equal(mothInV1.isTranslucentGhost, false);

  const stateWithError = {
    ...v1State,
    errorBanner: {
      code: 'PAYPAL_API_ERROR',
      message: 'Previous action failed in v1',
    },
  };
  const v2State = selectCutVersionView(stateWithError, 'v2');
  assert.equal(v2State.cutVersion, 'v2');
  assert.equal(v2State.errorBanner, null, 'Switching from v1 to v2 must clear stale errorBanner');

  const mothInV2 = v2State.stageNodes.find((n) => n.personId === 'crew-moth');
  assert.ok(mothInV2, 'Expected Moth on Credit Roll Stage in Cut v2');
  assert.equal(mothInV2.badgeStatus, 'UNPAID_GHOST');
  assert.equal(mothInV2.isTranslucentGhost, true);
  assert.equal(
    mothInV2.ghostCallout,
    'Removed from Cut v2 · Contract Fee Still Owed',
  );

  const djOwlInV2 = v2State.stageNodes.find((n) => n.personId === 'crew-dj-owl');
  assert.ok(djOwlInV2);
  assert.equal(djOwlInV2.isTranslucentGhost, false);
});

test('AC 3: Clicking any contributor chip or ghost credit dispatches toggleCrossFilter for that contributor personId and clicking again clears the filter, synchronizing companion AG Grid rows', () => {
  const calls: { type: 'toggle' | 'reset'; params?: AgWidgetCrossFilterParams }[] = [];
  const mockWidgetApi = {
    toggleCrossFilter(params: AgWidgetCrossFilterParams) {
      calls.push({ type: 'toggle', params });
    },
    resetCrossFilter() {
      calls.push({ type: 'reset' });
    },
  };

  let state = createInitialCreditRollInteractiveState();
  assert.equal(state.selectedPersonId, null);

  state = dispatchContributorCrossFilter(state, 'crew-moth', mockWidgetApi);
  assert.equal(state.selectedPersonId, 'crew-moth');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.type, 'toggle');
  assert.deepEqual(calls[0]?.params, {
    type: 'value',
    group: 0,
    field: {
      fieldId: 'crewSettlements.personId',
      key: 'crewSettlements.personId',
    },
    value: 'crew-moth',
    reset: true,
  });

  state = dispatchContributorCrossFilter(state, 'crew-moth', mockWidgetApi);
  assert.equal(state.selectedPersonId, null);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.type, 'reset');
});

test('AC 4: In-flight PayPal Sandbox actions (BTS Order, Invoice + QR Code, Batch Payouts) disable duplicate submission buttons, display live progress, and upon completion render read-back PayPal IDs, QR code, and per-item statuses (SUCCESS, PENDING, UNCLAIMED, FAILED)', async () => {
  let state = createInitialCreditRollInteractiveState();
  const observedInFlightStates: { inFlightAction: string | null; isActionLocked: boolean; progressText: string | null }[] = [];

  const sampleQrBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  state = await runPatchbaySandboxAction(state, {
    kind: 'supporter-order',
    personId: 'crew-dj-owl',
    amountCents: 2500,
    onStateChange(intermediate) {
      observedInFlightStates.push({
        inFlightAction: intermediate.inFlightAction,
        isActionLocked: intermediate.isActionLocked,
        progressText: intermediate.progressText,
      });
    },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          statusCode: 200,
          receipt: {
            orderId: '5O190127TN364715T',
            status: 'COMPLETED',
            amountCents: 2500,
            currencyCode: 'USD',
            supporterName: 'Executive Producer Backer',
            supporterEmail: 'supporter.bts.sandbox@creditroll.dev',
            personId: 'crew-dj-owl',
            approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
            requestId: 'PPREQ-ORDER-1',
            createdAt: '2026-11-02T00:00:00.000Z',
          },
          state: {
            ...state.settlementState,
            supporterOrders: [
              {
                orderId: '5O190127TN364715T',
                status: 'COMPLETED',
                amountCents: 2500,
                currencyCode: 'USD',
                supporterName: 'Executive Producer Backer',
                supporterEmail: 'supporter.bts.sandbox@creditroll.dev',
                personId: 'crew-dj-owl',
                approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
                requestId: 'PPREQ-ORDER-1',
                createdAt: '2026-11-02T00:00:00.000Z',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  });

  assert.equal(observedInFlightStates.some((s) => s.inFlightAction === 'supporter-order' && s.isActionLocked === true), true);
  assert.equal(state.inFlightAction, null);
  assert.equal(state.isActionLocked, false);
  assert.equal(state.latestOrderReceipt?.orderId, '5O190127TN364715T');
  assert.equal(state.latestOrderReceipt?.status, 'COMPLETED');

  state = await runPatchbaySandboxAction(state, {
    kind: 'obligation-invoice',
    personId: 'crew-moth',
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          statusCode: 200,
          receipt: {
            invoiceId: 'INV2-Z56S-5LLA-Q52L-CPZ5',
            invoiceNumber: 'CRLIVE-MOTH-001',
            status: 'SENT',
            amountCents: 140000,
            currencyCode: 'USD',
            recipientName: 'Completion Bond Trust',
            recipientEmail: 'exec.producer.funding@creditroll.dev',
            personId: 'crew-moth',
            qrCodeBase64: sampleQrBase64,
            qrCodeDataUrl: `data:image/png;base64,${sampleQrBase64}`,
            requestId: 'PPREQ-INV-1',
            createdAt: '2026-11-02T00:00:00.000Z',
          },
          state: state.settlementState,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  });

  assert.equal(state.latestInvoiceReceipt?.invoiceId, 'INV2-Z56S-5LLA-Q52L-CPZ5');
  assert.equal(state.latestInvoiceReceipt?.qrCodeDataUrl, `data:image/png;base64,${sampleQrBase64}`);

  const updatedSettlements = state.settlementState.reconciled.crewSettlements.map((row) => {
    if (row.personId === 'crew-dj-owl') {
      return { ...row, paypalPayoutBatchId: 'PBATCH-9001', paypalPayoutItemId: 'PITEM-1', transactionStatus: 'SUCCESS' as const, badgeStatus: 'PAID' as const };
    }
    if (row.personId === 'crew-moth') {
      return { ...row, paypalPayoutBatchId: 'PBATCH-9001', paypalPayoutItemId: 'PITEM-2', transactionStatus: 'PENDING' as const, badgeStatus: 'PENDING' as const };
    }
    if (row.personId === 'crew-elena-rostova') {
      return { ...row, paypalPayoutBatchId: 'PBATCH-9001', paypalPayoutItemId: 'PITEM-3', transactionStatus: 'UNCLAIMED' as const, badgeStatus: 'UNCLAIMED' as const };
    }
    if (row.personId === 'crew-hana-sato') {
      return { ...row, paypalPayoutBatchId: 'PBATCH-9001', paypalPayoutItemId: 'PITEM-4', transactionStatus: 'FAILED' as const, badgeStatus: 'FAILED' as const };
    }
    return row;
  });

  state = await runPatchbaySandboxAction(state, {
    kind: 'batch-settlement',
    humanApproved: true,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          statusCode: 200,
          idempotentReplay: false,
          receipt: {
            payoutBatchId: 'PBATCH-9001',
            senderBatchId: state.settlementState.proposal.senderBatchId,
            paypalRequestId: state.settlementState.proposal.paypalRequestId,
            proposalVersionHash: state.settlementState.proposal.proposalVersionHash,
            batchStatus: 'SUCCESS',
            totalAmountCents: 705000,
            items: [
              { personId: 'crew-dj-owl', senderItemId: 'ITEM-1', receiverEmail: 'aria@test', amountCents: 185000, payoutItemId: 'PITEM-1', transactionId: 'TX-1', rawTransactionStatus: 'SUCCESS', transactionStatus: 'SUCCESS', badgeStatus: 'PAID' },
              { personId: 'crew-moth', senderItemId: 'ITEM-2', receiverEmail: 'moth@test', amountCents: 140000, payoutItemId: 'PITEM-2', transactionId: 'TX-2', rawTransactionStatus: 'PENDING', transactionStatus: 'PENDING', badgeStatus: 'PENDING' },
              { personId: 'crew-elena-rostova', senderItemId: 'ITEM-3', receiverEmail: 'elena@test', amountCents: 220000, payoutItemId: 'PITEM-3', transactionId: 'TX-3', rawTransactionStatus: 'UNCLAIMED', transactionStatus: 'UNCLAIMED', badgeStatus: 'UNCLAIMED' },
              { personId: 'crew-hana-sato', senderItemId: 'ITEM-4', receiverEmail: 'hana@test', amountCents: 160000, payoutItemId: 'PITEM-4', transactionId: 'TX-4', rawTransactionStatus: 'FAILED', transactionStatus: 'FAILED', badgeStatus: 'FAILED' },
            ],
            settledAt: '2026-11-02T00:00:00.000Z',
          },
          state: {
            ...state.settlementState,
            reconciled: {
              ...state.settlementState.reconciled,
              crewSettlements: updatedSettlements,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  });

  assert.equal(state.latestBatchReceipt?.payoutBatchId, 'PBATCH-9001');
  const statuses = state.latestBatchReceipt?.items.map((i) => i.transactionStatus);
  assert.deepEqual(statuses, ['SUCCESS', 'PENDING', 'UNCLAIMED', 'FAILED']);
});

test('AC 5: AG Studio AI prompt starters and assistant configuration allow users to query ghosted crew members and stage-name mappings while keeping all PayPal write mutations gated behind explicit user approval in the Patchbay widget', async () => {
  const starters = (aiModule.PROMPT_STARTERS ?? []) as { label: string; prompt: string }[];

  assert.equal(Array.isArray(starters), true);
  assert.ok(starters.length > 0, 'Expected exported PROMPT_STARTERS array');
  const allPromptsText = starters.map((p) => `${p.label} ${p.prompt}`).join(' ');

  assert.equal(/ghost/i.test(allPromptsText), true, 'Expected AI prompt starter covering ghosted crew members');
  assert.equal(/stage name|alias/i.test(allPromptsText), true, 'Expected AI prompt starter covering stage-name mappings');

  let fetchCalled = false;
  const initial = createInitialCreditRollInteractiveState();
  const unapprovedResult = await runPatchbaySandboxAction(initial, {
    kind: 'batch-settlement',
    humanApproved: false,
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    },
  });

  assert.equal(fetchCalled, false, 'Batch payout must not call network when humanApproved is false');
  assert.ok(unapprovedResult.errorBanner, 'Expected errorBanner when human approval is not granted');
  assert.equal(unapprovedResult.errorBanner.code, 'MISSING_HUMAN_APPROVAL_TOKEN');
});
