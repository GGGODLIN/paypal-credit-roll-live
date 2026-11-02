import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDataEngine, isDataRelation } from 'ag-studio';
import type { DashboardData } from '../lib/dashboard-data';
import type { CreditRollScenarioInput } from '../lib/credit-roll-reconciler';

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
  reconcileCreditRoll,
  buildSettlementProposal,
  createHumanApprovalToken,
  validateSettlementApproval,
} = await import('../lib/credit-roll-reconciler');

const { buildStudioData, hasData } = await import('../app/dashboard/studio/data');

test('AC 1: Contributors in Cut v1 with an approved fixed-fee contract whose cue is removed in Cut v2 are classified as GHOST_CUT and retain 100% of contract payout obligation', () => {
  const reconciled = reconcileCreditRoll(DEFAULT_CREDIT_ROLL_SCENARIO);
  const proposal = buildSettlementProposal(reconciled);

  // Positive control: contributor credited in both Cut v1 and Cut v2
  const djOwlSettlement = reconciled.crewSettlements.find((s) => s.personId === 'crew-dj-owl');
  assert.ok(djOwlSettlement, 'Expected DJ Owl settlement row to exist');
  assert.equal(djOwlSettlement.cutStatus, 'CREDITED');
  assert.equal(djOwlSettlement.contractAmountCents, 185000);
  assert.equal(djOwlSettlement.obligationRetained, true);
  assert.equal(djOwlSettlement.eligibleForPayout, true);

  // Target: Moth (Marcus Vance) present in Cut v1, scene cue removed in Cut v2
  const mothSettlement = reconciled.crewSettlements.find((s) => s.personId === 'crew-moth');
  assert.ok(mothSettlement, 'Expected Moth settlement row to exist');
  assert.equal(mothSettlement.cutStatus, 'GHOST_CUT');
  assert.equal(mothSettlement.reconciliationStatus, 'GHOST_CUT');
  assert.equal(mothSettlement.badgeStatus, 'UNPAID_GHOST');
  assert.equal(mothSettlement.obligationRetained, true);
  assert.equal(mothSettlement.eligibleForPayout, true);
  assert.equal(mothSettlement.contractAmountCents, 140000);
  assert.equal(mothSettlement.contractAmountUsd, 1400);

  // Target 2: Elena Rostova (Nyx Frame) present in Cut v1, removed in Cut v2
  const nyxSettlement = reconciled.crewSettlements.find((s) => s.personId === 'crew-elena-rostova');
  assert.ok(nyxSettlement, 'Expected Elena Rostova settlement row to exist');
  assert.equal(nyxSettlement.cutStatus, 'GHOST_CUT');
  assert.equal(nyxSettlement.obligationRetained, true);
  assert.equal(nyxSettlement.contractAmountCents, 220000);

  const mothExecutable = proposal.executableItems.find((item) => item.personId === 'crew-moth');
  assert.ok(mothExecutable, 'GHOST_CUT with approved contract must remain in executable payout items');
  assert.equal(mothExecutable.amountCents, 140000);
  assert.equal(mothExecutable.cutStatus, 'GHOST_CUT');
  assert.equal(proposal.ghostCutObligationCents, 360000);
});

test('AC 2: Stage names with verified cue-sheet and contract aliases resolve to verified personId, while homonymous or unverified aliases become NEEDS_REVIEW and are excluded from executable payouts', () => {
  const reconciled = reconcileCreditRoll(DEFAULT_CREDIT_ROLL_SCENARIO);
  const proposal = buildSettlementProposal(reconciled);

  // Positive control: verified stage names DJ Owl and Moth resolve to their exact personId
  const djOwlCue = reconciled.creditCues.find((c) => c.creditedName === 'DJ Owl');
  assert.ok(djOwlCue, 'Expected DJ Owl cue row');
  assert.equal(djOwlCue.personId, 'crew-dj-owl');
  assert.equal(djOwlCue.reconciliationStatus, 'VERIFIED');

  const mothCue = reconciled.creditCues.find((c) => c.creditedName === 'Moth');
  assert.ok(mothCue, 'Expected Moth cue row');
  assert.equal(mothCue.personId, 'crew-moth');
  assert.equal(mothCue.reconciliationStatus, 'GHOST_CUT');

  // Homonymous / ambiguous alias in scenario (Alex Rivera matches two candidate records or unverified alias)
  const ambiguousSettlements = reconciled.crewSettlements.filter(
    (s) => s.reconciliationStatus === 'NEEDS_REVIEW',
  );
  assert.ok(ambiguousSettlements.length >= 1, 'Expected at least one NEEDS_REVIEW settlement row');

  const alexSettlement = ambiguousSettlements.find((s) => s.stageName.includes('Alex Rivera'));
  assert.ok(alexSettlement, 'Expected homonymous alias Alex Rivera to be flagged NEEDS_REVIEW');
  assert.equal(alexSettlement.cutStatus, 'ALIAS_AMBIGUOUS');
  assert.equal(alexSettlement.badgeStatus, 'NEEDS_REVIEW');
  assert.equal(alexSettlement.eligibleForPayout, false);

  // Positive control in executableItems vs negative control exclusion
  assert.equal(
    proposal.executableItems.some((item) => item.personId === 'crew-dj-owl'),
    true,
  );
  assert.equal(
    proposal.executableItems.some((item) => item.personId === alexSettlement.personId),
    false,
  );
  assert.equal(
    proposal.blockedItems.some((item) => item.personId === alexSettlement.personId),
    true,
  );

  // Approval validation must also reject any request attempting to include a NEEDS_REVIEW recipient
  const token = createHumanApprovalToken(proposal.proposalVersionHash);
  const validApproval = validateSettlementApproval(proposal, {
    approvalToken: token,
    expectedProposalVersionHash: proposal.proposalVersionHash,
    requestedPersonIds: ['crew-dj-owl', 'crew-moth'],
  });
  assert.equal(validApproval.valid, true);
  assert.equal(validApproval.statusCode, 200);

  const blockedApproval = validateSettlementApproval(proposal, {
    approvalToken: token,
    expectedProposalVersionHash: proposal.proposalVersionHash,
    requestedPersonIds: ['crew-dj-owl', alexSettlement.personId],
  });
  assert.equal(blockedApproval.valid, false);
  assert.equal(blockedApproval.statusCode, 400);
  assert.equal(blockedApproval.errors.includes('NEEDS_REVIEW_RECIPIENT_BLOCKED'), true);
});

test('AC 3: Monetary amounts are calculated strictly in integer cents from locked contracts; AI-supplied altered or hallucinated fee values are discarded', () => {
  const scenarioWithAiHallucination: CreditRollScenarioInput = {
    ...DEFAULT_CREDIT_ROLL_SCENARIO,
    aiCandidateMappings: [
      {
        cueId: 'CUE-01',
        creditedName: 'DJ Owl',
        proposedPersonId: 'crew-dj-owl',
        proposedAmountCents: 999999,
        proposedAmountUsd: 9999.99,
        confidence: 0.99,
        evidenceCite: 'Cue Sheet #01 + Contract CTR-2026-101',
      },
      {
        cueId: 'CUE-02',
        creditedName: 'Moth',
        proposedPersonId: 'crew-moth',
        proposedAmountCents: 5000,
        proposedAmountUsd: 50,
        confidence: 0.96,
        evidenceCite: 'Cue Sheet #02 + Contract CTR-2026-102',
      },
    ],
  };

  const reconciled = reconcileCreditRoll(scenarioWithAiHallucination);
  const proposal = buildSettlementProposal(reconciled);

  const djOwl = reconciled.crewSettlements.find((s) => s.personId === 'crew-dj-owl');
  const moth = reconciled.crewSettlements.find((s) => s.personId === 'crew-moth');
  assert.ok(djOwl && moth);

  // Locked contract rates win over AI hallucinated amounts
  assert.equal(djOwl.contractAmountCents, 185000);
  assert.equal(djOwl.discardedAiAmountOverride, true);
  assert.equal(moth.contractAmountCents, 140000);
  assert.equal(moth.discardedAiAmountOverride, true);

  assert.equal(reconciled.discardedAiAmountOverrides.length, 2);
  assert.equal(proposal.discardedAiOverrideCount, 2);

  // Total executable cents is exact integer-cent sum of the 4 verified approved contracts:
  // 185000 (DJ Owl) + 140000 (Moth) + 220000 (Elena Rostova) + 160000 (Hana Sato) = 705000 cents ($7,050.00)
  assert.equal(Number.isSafeInteger(proposal.totalExecutableCents), true);
  assert.equal(proposal.totalExecutableCents, 705000);
  assert.equal(proposal.totalExecutableUsd, 7050);
  const sumOfItemsCents = proposal.executableItems.reduce((acc, item) => acc + item.amountCents, 0);
  assert.equal(sumOfItemsCents, 705000);
});

test('AC 4: Re-running reconciliation or proposal generation on the same versioned inputs produces identical proposalVersionHash, senderBatchId, and PayPal-Request-Id without duplicating rows', () => {
  const firstRun = reconcileCreditRoll(DEFAULT_CREDIT_ROLL_SCENARIO);
  const firstProposal = buildSettlementProposal(firstRun);

  // Re-run with reversed cue order and a duplicate cue entry for the same contributor
  const reorderedWithDuplicateCue: CreditRollScenarioInput = {
    ...DEFAULT_CREDIT_ROLL_SCENARIO,
    contracts: [...DEFAULT_CREDIT_ROLL_SCENARIO.contracts].reverse(),
    cues: [
      ...DEFAULT_CREDIT_ROLL_SCENARIO.cues.slice().reverse(),
      ...(DEFAULT_CREDIT_ROLL_SCENARIO.cues[0] ? [DEFAULT_CREDIT_ROLL_SCENARIO.cues[0]] : []),
    ],
  };

  const secondRun = reconcileCreditRoll(reorderedWithDuplicateCue);
  const secondProposal = buildSettlementProposal(secondRun);

  assert.ok(firstProposal.proposalVersionHash.length > 10);
  assert.equal(secondProposal.proposalVersionHash, firstProposal.proposalVersionHash);
  assert.equal(secondProposal.senderBatchId, firstProposal.senderBatchId);
  assert.equal(secondProposal.paypalRequestId, firstProposal.paypalRequestId);
  assert.equal(secondRun.crewSettlements.length, firstRun.crewSettlements.length);
  assert.equal(secondProposal.executableItems.length, firstProposal.executableItems.length);

  // Positive control: changing revision changes the deterministic keys
  const nextRevisionProposal = buildSettlementProposal({
    ...DEFAULT_CREDIT_ROLL_SCENARIO,
    revision: 2,
  });
  assert.notEqual(nextRevisionProposal.proposalVersionHash, firstProposal.proposalVersionHash);
  assert.notEqual(nextRevisionProposal.senderBatchId, firstProposal.senderBatchId);
  assert.notEqual(nextRevisionProposal.paypalRequestId, firstProposal.paypalRequestId);
});

test('AC 5: Malformed, empty, or missing optional fields in credit cue inputs degrade gracefully to NEEDS_REVIEW without throwing unhandled exceptions', () => {
  const malformedScenario: CreditRollScenarioInput = {
    projectId: 'MALFORMED-TEST',
    contracts: DEFAULT_CREDIT_ROLL_SCENARIO.contracts,
    cues: [
      // Valid cue as positive control
      {
        cueId: 'CUE-VALID-1',
        creditedName: 'DJ Owl',
        appearsInCutV1: true,
        appearsInCutV2: true,
      },
      // Empty credited name and missing optional fields
      {
        cueId: '',
        creditedName: '   ',
        sceneTimestamp: null,
        cueDescription: undefined,
      },
      // Completely empty cue object
      {},
      // Nullish cue entry coerced at runtime
      null as unknown as CreditRollScenarioInput['cues'][number],
    ],
  };

  const reconciled = reconcileCreditRoll(malformedScenario);
  const proposal = buildSettlementProposal(reconciled);

  // Positive control still resolves
  const validSettlement = reconciled.crewSettlements.find((s) => s.personId === 'crew-dj-owl');
  assert.ok(validSettlement, 'Valid DJ Owl cue should still reconcile when sibling cues are malformed');
  assert.equal(validSettlement.eligibleForPayout, true);

  // Malformed cues degrade to NEEDS_REVIEW and never enter executableItems
  const needsReviewCues = reconciled.creditCues.filter(
    (c) => c.reconciliationStatus === 'NEEDS_REVIEW',
  );
  assert.ok(needsReviewCues.length >= 2, 'Malformed cues must be recorded as NEEDS_REVIEW');
  for (const cue of needsReviewCues) {
    assert.equal(cue.reconciliationStatus, 'NEEDS_REVIEW');
    assert.ok(cue.reviewReason && cue.reviewReason.length > 0);
  }
  assert.equal(proposal.executableItems.length, 1);
  assert.equal(proposal.executableItems[0]?.personId, 'crew-dj-owl');
});

test('AC 6: buildStudioData() exposes crewMembers, creditCues, and crewSettlements sources with valid many-to-one relationships on personId while preserving all existing PayPal sources', () => {
  const reconciled = reconcileCreditRoll(DEFAULT_CREDIT_ROLL_SCENARIO);

  const dashboardData: DashboardData = {
    asOf: '2026-11-02T00:00:00.000Z',
    customers: [],
    invoices: [],
    invoiceItems: [],
    invoicePayments: [],
    products: [],
    plans: [],
    transactions: [],
    payouts: [],
    balances: [],
    crewMembers: reconciled.crewMembers,
    creditCues: reconciled.creditCues,
    crewSettlements: reconciled.crewSettlements,
  };

  assert.equal(
    hasData(dashboardData),
    true,
    'hasData() must return true when crewSettlements has rows even if PayPal sandbox tables are empty',
  );

  const studioData = buildStudioData(dashboardData);
  const sourceIds = studioData.sources.map((s) => s.id);

  // Regression check: all 9 existing PayPal data sources are preserved
  for (const expectedExisting of [
    'customers',
    'invoices',
    'invoiceItems',
    'invoicePayments',
    'products',
    'plans',
    'transactions',
    'payouts',
    'balances',
  ]) {
    assert.equal(
      sourceIds.includes(expectedExisting),
      true,
      `Missing existing PayPal source: ${expectedExisting}`,
    );
  }

  // New CreditRoll Live relational sources
  for (const expectedNew of ['crewMembers', 'creditCues', 'crewSettlements']) {
    assert.equal(
      sourceIds.includes(expectedNew),
      true,
      `Missing CreditRoll source: ${expectedNew}`,
    );
  }

  const relationships = (studioData.relationships ?? []).filter(isDataRelation);

  const cueToCrewRel = relationships.find(
    (r) =>
      r.type === 'many-to-one' &&
      r.source.tableId === 'creditCues' &&
      r.source.fieldId === 'personId' &&
      r.target.tableId === 'crewMembers' &&
      r.target.fieldId === 'personId',
  );
  assert.ok(cueToCrewRel, 'Expected many-to-one relationship creditCues.personId -> crewMembers.personId');

  const settlementToCrewRel = relationships.find(
    (r) =>
      r.type === 'many-to-one' &&
      r.source.tableId === 'crewSettlements' &&
      r.source.fieldId === 'personId' &&
      r.target.tableId === 'crewMembers' &&
      r.target.fieldId === 'personId',
  );
  assert.ok(
    settlementToCrewRel,
    'Expected many-to-one relationship crewSettlements.personId -> crewMembers.personId',
  );

  // Verify AG Studio's actual data engine accepts the full schema and relationships without throwing
  const engine = createDataEngine(studioData);
  assert.equal(typeof engine.execute, 'function');
});
