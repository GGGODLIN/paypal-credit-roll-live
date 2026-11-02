import type { ComponentType } from 'react';
import {
  _ALL_WIDGET_DEFS,
  type AgCreateWidgetsParams,
  type AgDefaultRegistry,
  type AgExternalShape,
  type AgFieldIdentifier,
  type AgFormatShapeParams,
  type AgWidgetCrossFilterParams,
  type AgWidgetField,
  type AgWidgetMenuGroup,
  type AgWidgetParams,
  type AgWidgetsConfig,
} from 'ag-studio';
import { createWidgets, type AgWidgetDefinition } from 'ag-studio-react';
import {
  createHumanApprovalToken,
  type CrewSettlementRow,
  type CutVersion,
  type ReconciledCreditRollResult,
  type SettlementBadgeStatus,
} from '@/lib/credit-roll-reconciler';
import {
  getCreditRollSettlementState,
  type CreditRollSettlementState,
  type CrewBatchSettlementOperationResult,
  type CrewBatchSettlementReceipt,
  type ObligationInvoiceOperationResult,
  type ObligationInvoiceReceipt,
  type SupporterOrderOperationResult,
  type SupporterOrderReceipt,
} from '@/lib/credit-roll-settlement';

export type CreditRollStageNode = {
  cueId: string;
  personId: string;
  creditedName: string;
  legalName: string;
  role: string;
  department: string;
  sceneTimestamp: string;
  cueDescription: string;
  contractId: string;
  contractAmountCents: number;
  contractAmountUsd: number;
  appearsInCutV1: boolean;
  appearsInCutV2: boolean;
  cutStatus: CrewSettlementRow['cutStatus'];
  badgeStatus: SettlementBadgeStatus;
  transactionStatus: CrewSettlementRow['transactionStatus'];
  isTranslucentGhost: boolean;
  ghostCallout: string | null;
  eligibleForPayout: boolean;
  reviewReason: string | null;
};

export type PatchbayActionKind =
  | 'supporter-order'
  | 'obligation-invoice'
  | 'batch-settlement';

export type CreditRollErrorBanner = {
  code: string;
  message: string;
  debugId?: string | null;
};

export type CreditRollInteractiveState = {
  cutVersion: CutVersion;
  selectedPersonId: string | null;
  humanApproved: boolean;
  inFlightAction: PatchbayActionKind | null;
  isActionLocked: boolean;
  progressText: string | null;
  errorBanner: CreditRollErrorBanner | null;
  settlementState: CreditRollSettlementState;
  stageNodes: CreditRollStageNode[];
  latestOrderReceipt: SupporterOrderReceipt | null;
  latestInvoiceReceipt: ObligationInvoiceReceipt | null;
  latestBatchReceipt: CrewBatchSettlementReceipt | null;
};

export type CrossFilterTargetApi = {
  toggleCrossFilter: (params: AgWidgetCrossFilterParams) => void;
  resetCrossFilter: () => void;
};

export type RunPatchbayActionParams = {
  kind: PatchbayActionKind;
  personId?: string | null;
  amountCents?: number;
  humanApproved?: boolean;
  onStateChange?: (state: CreditRollInteractiveState) => void;
  fetchImpl?: typeof fetch;
};

export const GHOST_CUT_V2_CALLOUT =
  'Removed from Cut v2 · Contract Fee Still Owed';

export function buildStageNodes(
  reconciled: ReconciledCreditRollResult,
  cutVersion: CutVersion,
): CreditRollStageNode[] {
  const settlementsByPersonId = new Map<string, CrewSettlementRow>(
    reconciled.crewSettlements.map((row) => [row.personId, row]),
  );

  return reconciled.creditCues.map((cue) => {
    const settlement = settlementsByPersonId.get(cue.personId);
    const isGhostInV2 =
      cutVersion === 'v2' && cue.appearsInCutV1 && !cue.appearsInCutV2;
    const settledAlready =
      settlement?.badgeStatus === 'PAID' ||
      settlement?.badgeStatus === 'PENDING' ||
      settlement?.badgeStatus === 'UNCLAIMED' ||
      settlement?.badgeStatus === 'FAILED';

    const badgeStatus: SettlementBadgeStatus =
      settlement?.reconciliationStatus === 'NEEDS_REVIEW'
        ? 'NEEDS_REVIEW'
        : settledAlready && settlement
          ? settlement.badgeStatus
          : isGhostInV2
            ? 'UNPAID_GHOST'
            : 'READY';

    return {
      cueId: cue.cueId,
      personId: cue.personId,
      creditedName: cue.creditedName,
      legalName: settlement?.legalName ?? cue.creditedName,
      role: cue.role,
      department: cue.department,
      sceneTimestamp: cue.sceneTimestamp,
      cueDescription: cue.cueDescription,
      contractId: settlement?.contractId ?? 'UNBOUND-CONTRACT',
      contractAmountCents: settlement?.contractAmountCents ?? 0,
      contractAmountUsd: settlement?.contractAmountUsd ?? 0,
      appearsInCutV1: cue.appearsInCutV1,
      appearsInCutV2: cue.appearsInCutV2,
      cutStatus: settlement?.cutStatus ?? 'ALIAS_AMBIGUOUS',
      badgeStatus,
      transactionStatus: settlement?.transactionStatus ?? 'NEEDS_REVIEW',
      isTranslucentGhost: isGhostInV2,
      ghostCallout: isGhostInV2 ? GHOST_CUT_V2_CALLOUT : null,
      eligibleForPayout: settlement?.eligibleForPayout ?? false,
      reviewReason: settlement?.reviewReason ?? cue.reviewReason,
    };
  });
}

export function createInitialCreditRollInteractiveState(
  initialSettlementState?: CreditRollSettlementState,
): CreditRollInteractiveState {
  const settlementState =
    initialSettlementState ?? getCreditRollSettlementState();
  const cutVersion: CutVersion = 'v2';
  return {
    cutVersion,
    selectedPersonId: null,
    humanApproved: false,
    inFlightAction: null,
    isActionLocked: false,
    progressText: null,
    errorBanner: null,
    settlementState,
    stageNodes: buildStageNodes(settlementState.reconciled, cutVersion),
    latestOrderReceipt: settlementState.supporterOrders[0] ?? null,
    latestInvoiceReceipt: settlementState.obligationInvoices[0] ?? null,
    latestBatchReceipt: settlementState.payoutBatches.at(-1) ?? null,
  };
}

export function selectCutVersionView(
  state: CreditRollInteractiveState,
  cutVersion: CutVersion,
): CreditRollInteractiveState {
  return {
    ...state,
    cutVersion,
    errorBanner: null,
    stageNodes: buildStageNodes(state.settlementState.reconciled, cutVersion),
  };
}

export const DEFAULT_PERSON_ID_FIELD = {
  fieldId: 'crewSettlements.personId' as AgFieldIdentifier,
  key: 'crewSettlements.personId',
} as unknown as AgWidgetField;

export function dispatchContributorCrossFilter(
  state: CreditRollInteractiveState,
  personId: string,
  widgetApi?: CrossFilterTargetApi,
  personField: AgWidgetField = DEFAULT_PERSON_ID_FIELD,
): CreditRollInteractiveState {
  const trimmed = personId.trim();
  if (!trimmed) return state;

  if (state.selectedPersonId === trimmed) {
    widgetApi?.resetCrossFilter();
    return {
      ...state,
      selectedPersonId: null,
    };
  }

  widgetApi?.toggleCrossFilter({
    type: 'value',
    group: 0,
    field: personField,
    value: trimmed,
    reset: true,
  });

  return {
    ...state,
    selectedPersonId: trimmed,
  };
}

const PROGRESS_LABELS: Record<PatchbayActionKind, string> = {
  'supporter-order':
    'Creating & capturing PayPal Sandbox Order + GET read-back...',
  'obligation-invoice':
    'Creating, sending & generating QR for PayPal Invoice + GET read-back...',
  'batch-settlement':
    'Executing approved PayPal Sandbox Payouts batch + GET item read-back...',
};

export async function runPatchbaySandboxAction(
  state: CreditRollInteractiveState,
  params: RunPatchbayActionParams,
): Promise<CreditRollInteractiveState> {
  if (state.isActionLocked) {
    return state;
  }

  const effectiveApproved = params.humanApproved ?? state.humanApproved;
  if (params.kind === 'batch-settlement' && !effectiveApproved) {
    return {
      ...state,
      errorBanner: {
        code: 'MISSING_HUMAN_APPROVAL_TOKEN',
        message:
          'Explicit human producer approval in the Patchbay widget is required before executing PayPal Payouts.',
        debugId: null,
      },
    };
  }

  const inFlightState: CreditRollInteractiveState = {
    ...state,
    humanApproved: effectiveApproved,
    inFlightAction: params.kind,
    isActionLocked: true,
    progressText: PROGRESS_LABELS[params.kind],
    errorBanner: null,
  };
  params.onStateChange?.(inFlightState);

  const fetchFn = params.fetchImpl ?? globalThis.fetch;

  try {
    if (params.kind === 'supporter-order') {
      const targetPersonId =
        params.personId ?? state.selectedPersonId ?? 'crew-dj-owl';
      const response = await fetchFn('/api/credit-roll/supporter-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: targetPersonId,
          amountCents: params.amountCents ?? 2500,
        }),
      });
      const payload =
        (await response.json()) as SupporterOrderOperationResult;
      const nextSettlementState = payload.state ?? state.settlementState;

      if (!response.ok || !payload.ok || !payload.receipt) {
        return {
          ...state,
          humanApproved: effectiveApproved,
          inFlightAction: null,
          isActionLocked: false,
          progressText: null,
          errorBanner: {
            code: payload.error?.code ?? 'PAYPAL_ORDER_FAILED',
            message:
              payload.error?.message ??
              'Failed to create and capture Supporter Pack order.',
            debugId: payload.error?.debugId ?? null,
          },
        };
      }

      return {
        ...state,
        humanApproved: effectiveApproved,
        inFlightAction: null,
        isActionLocked: false,
        progressText: null,
        errorBanner: null,
        settlementState: nextSettlementState,
        stageNodes: buildStageNodes(
          nextSettlementState.reconciled,
          state.cutVersion,
        ),
        latestOrderReceipt: payload.receipt,
      };
    }

    if (params.kind === 'obligation-invoice') {
      const selectedRow = state.settlementState.reconciled.crewSettlements.find(
        (row) => row.personId === (params.personId ?? state.selectedPersonId),
      );
      const targetPersonId =
        selectedRow && selectedRow.eligibleForPayout
          ? selectedRow.personId
          : 'crew-moth';

      const response = await fetchFn('/api/credit-roll/obligation-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: targetPersonId,
        }),
      });
      const payload =
        (await response.json()) as ObligationInvoiceOperationResult;
      const nextSettlementState = payload.state ?? state.settlementState;

      if (!response.ok || !payload.ok || !payload.receipt) {
        return {
          ...state,
          humanApproved: effectiveApproved,
          inFlightAction: null,
          isActionLocked: false,
          progressText: null,
          errorBanner: {
            code: payload.error?.code ?? 'PAYPAL_INVOICE_FAILED',
            message:
              payload.error?.message ??
              'Failed to create and send obligation invoice.',
            debugId: payload.error?.debugId ?? null,
          },
        };
      }

      return {
        ...state,
        humanApproved: effectiveApproved,
        inFlightAction: null,
        isActionLocked: false,
        progressText: null,
        errorBanner: null,
        settlementState: nextSettlementState,
        stageNodes: buildStageNodes(
          nextSettlementState.reconciled,
          state.cutVersion,
        ),
        latestInvoiceReceipt: payload.receipt,
      };
    }

    const proposalHash = state.settlementState.proposal.proposalVersionHash;
    const approvalToken = createHumanApprovalToken(
      proposalHash,
      'producer-patchbay',
    );
    const response = await fetchFn('/api/credit-roll/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvalToken,
        approvedBy: 'producer-patchbay',
        expectedProposalVersionHash: proposalHash,
      }),
    });
    const payload =
      (await response.json()) as CrewBatchSettlementOperationResult;
    const nextSettlementState = payload.state ?? state.settlementState;

    if (!response.ok || !payload.ok || !payload.receipt) {
      return {
        ...state,
        humanApproved: effectiveApproved,
        inFlightAction: null,
        isActionLocked: false,
        progressText: null,
        errorBanner: {
          code: payload.error?.code ?? 'PAYPAL_BATCH_SETTLEMENT_FAILED',
          message:
            payload.error?.message ??
            'Failed to execute crew batch settlement.',
          debugId: payload.error?.debugId ?? null,
        },
      };
    }

    return {
      ...state,
      humanApproved: effectiveApproved,
      inFlightAction: null,
      isActionLocked: false,
      progressText: null,
      errorBanner: null,
      settlementState: nextSettlementState,
      stageNodes: buildStageNodes(
        nextSettlementState.reconciled,
        state.cutVersion,
      ),
      latestBatchReceipt: payload.receipt,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected network error';
    return {
      ...state,
      humanApproved: effectiveApproved,
      inFlightAction: null,
      isActionLocked: false,
      progressText: null,
      errorBanner: {
        code: 'PAYPAL_NETWORK_ERROR',
        message,
        debugId: null,
      },
    };
  }
}

type Listener = () => void;

let currentSharedState: CreditRollInteractiveState =
  createInitialCreditRollInteractiveState();
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const creditRollInteractiveStore = {
  getState(): CreditRollInteractiveState {
    return currentSharedState;
  },
  setState(next: CreditRollInteractiveState): void {
    currentSharedState = next;
    emitChange();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function buildCustomWidgetFormatShape(
  description: string,
): (params: AgFormatShapeParams) => AgExternalShape<Record<string, unknown>> {
  return (params: AgFormatShapeParams) => {
    try {
      const builtInShape = _ALL_WIDGET_DEFS.grid.formatShape?.(params);
      if (builtInShape) {
        return builtInShape as unknown as AgExternalShape<Record<string, unknown>>;
      }
    } catch {
      // Fallback when invoked outside AG Studio bean container in unit tests
    }
    return {
      description,
    } as unknown as AgExternalShape<Record<string, unknown>>;
  };
}

export function buildCreditRollWidgetDefinitions(components: {
  stageComp: ComponentType<AgWidgetParams>;
  patchbayComp: ComponentType<AgWidgetParams>;
}): AgWidgetDefinition[] {
  return [
    {
      id: 'credit-roll-stage',
      label: 'Interactive Credit Roll Stage',
      dataMapping: {
        cols: {
          type: 'fieldset',
          supportedRoles: ['category', 'temporal', 'numeric'],
          required: false,
          aiDescription:
            'Crew settlement and credit cue fields displayed in the rolling credit roll stage.',
        },
      },
      formatShape: buildCustomWidgetFormatShape(
        'Interactive Credit Roll Stage widget configuration supporting Cut v1 vs Cut v2 ghost diff visualization and contributor cross-filtering.',
      ),
      form: (params) =>
        params.createDefaults({
          supportsCrossHighlight: false,
          dataMappingItems: [{ key: 'cols', label: 'Credit Roll Fields' }],
        }),
      comp: components.stageComp,
      defaultSize: { width: 12, height: 22 },
      minSize: { width: 8, height: 14 },
      ai: {
        label: 'Interactive Credit Roll Stage',
        description:
          'A live rolling end-credits stage that compares Rough Cut (v1) against Director Cut (v2), highlights cut contributors as translucent UNPAID_GHOST nodes ("Removed from Cut v2 · Contract Fee Still Owed"), and cross-filters the companion AG Grid by personId when any contributor chip is clicked.',
        usage:
          'Use on the CreditRoll Live page to inspect scene cues, toggle between Cut v1 and Cut v2, and click any contributor or ghost credit to cross-filter the Crew Settlements AG Grid.',
        configuration:
          'Map crewSettlements.personId, crewSettlements.stageName, crewSettlements.cutStatus, crewSettlements.badgeStatus, and crewSettlements.contractAmountUsd to cols.',
      },
    },
    {
      id: 'ghost-patchbay',
      label: 'Ghost Diff & Identity Patchbay',
      dataMapping: {
        cols: {
          type: 'fieldset',
          supportedRoles: ['category', 'temporal', 'numeric'],
          required: false,
          aiDescription:
            'Crew settlement fields reconciled in the Ghost Diff & Identity Patchbay.',
        },
      },
      formatShape: buildCustomWidgetFormatShape(
        'Ghost Diff & Identity Patchbay widget configuration for human-gated PayPal Sandbox Orders, Invoices with QR code, and Batch Payouts.',
      ),
      form: (params) =>
        params.createDefaults({
          supportsCrossHighlight: false,
          dataMappingItems: [{ key: 'cols', label: 'Settlement Fields' }],
        }),
      comp: components.patchbayComp,
      defaultSize: { width: 12, height: 22 },
      minSize: { width: 8, height: 14 },
      ai: {
        label: 'Ghost Diff & Identity Patchbay',
        description:
          'A deterministic financial guardrail and PayPal Sandbox execution panel showing the current proposalVersionHash, Ghost-Cut retained obligations, NEEDS_REVIEW alias holds, and human-approved actions for BTS Supporter Orders, Obligation Invoices with QR codes, and Batch Payouts.',
        usage:
          'Use alongside the Interactive Credit Roll Stage and Crew Settlements AG Grid so human producers can verify stage-name mappings and explicitly approve PayPal Sandbox write operations.',
        configuration:
          'Map crewSettlements.personId, crewSettlements.contractId, crewSettlements.reconciliationStatus, crewSettlements.transactionStatus, and crewSettlements.contractAmountUsd to cols.',
      },
    },
  ];
}

export function createCreditRollStudioWidgets(components: {
  stageComp: ComponentType<AgWidgetParams>;
  patchbayComp: ComponentType<AgWidgetParams>;
}): AgWidgetsConfig<AgDefaultRegistry> {
  const defaultConfig = createWidgets({});
  const customGroup = {
    label: 'CreditRoll Live',
    widgetIds: ['credit-roll-stage', 'ghost-patchbay'],
  } as unknown as AgWidgetMenuGroup<AgDefaultRegistry>;
  const params = {
    additionalTypes: buildCreditRollWidgetDefinitions(components),
    menu: [customGroup, ...defaultConfig.menu],
  } as unknown as AgCreateWidgetsParams<AgDefaultRegistry>;
  return createWidgets(params);
}
