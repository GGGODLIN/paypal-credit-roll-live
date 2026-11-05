import {
  buildSettlementProposal,
  DEFAULT_CREDIT_ROLL_SCENARIO,
  reconcileCreditRoll,
  sanitizeIdSegment,
  validateSettlementApproval,
  type CreditRollScenarioInput,
  type CrewSettlementRow,
  type ReconciledCreditRollResult,
  type SettlementApprovalValidation,
  type SettlementBadgeStatus,
  type SettlementProposal,
  type SettlementTransactionStatus,
} from './credit-roll-reconciler';
import {
  createAndCaptureOrder,
  createAndReadBackPayoutBatch,
  createSendAndReadBackInvoiceWithQr,
  PayPalApiError,
  redactPayPalSecrets,
  type FetchLike,
  type InvoiceStatus,
  type PayPalCallOptions,
  type PayPalOrderStatus,
  type PayPalPayoutBatchItem,
  type PayPalPayoutTransactionStatus,
} from './paypal';

export type SupporterOrderReceipt = {
  orderId: string;
  status: PayPalOrderStatus;
  amountCents: number;
  currencyCode: 'USD';
  supporterName: string;
  supporterEmail: string;
  personId: string | null;
  approveUrl: string | null;
  requestId: string;
  createdAt: string;
};

export type ObligationInvoiceReceipt = {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amountCents: number;
  currencyCode: 'USD';
  recipientName: string;
  recipientEmail: string;
  personId: string | null;
  qrCodeBase64: string;
  qrCodeDataUrl: string;
  requestId: string;
  createdAt: string;
};

export type PayoutItemReceipt = {
  personId: string;
  senderItemId: string;
  receiverEmail: string;
  amountCents: number;
  payoutItemId: string;
  transactionId: string | null;
  rawTransactionStatus: PayPalPayoutTransactionStatus;
  transactionStatus: SettlementTransactionStatus;
  badgeStatus: SettlementBadgeStatus;
};

export type CrewBatchSettlementReceipt = {
  payoutBatchId: string;
  senderBatchId: string;
  paypalRequestId: string;
  proposalVersionHash: string;
  batchStatus: string;
  totalAmountCents: number;
  items: PayoutItemReceipt[];
  settledAt: string;
};

export type SettlementErrorDetail = {
  code: string;
  message: string;
  paypalStatus: number | null;
  debugId: string | null;
  errors?: string[];
};

export type CreditRollSettlementState = {
  scenario: CreditRollScenarioInput;
  reconciled: ReconciledCreditRollResult;
  proposal: SettlementProposal;
  supporterOrders: SupporterOrderReceipt[];
  obligationInvoices: ObligationInvoiceReceipt[];
  payoutBatches: CrewBatchSettlementReceipt[];
};

export type SettlementStore = {
  getState: () => CreditRollSettlementState;
  reset: (scenario?: CreditRollScenarioInput) => CreditRollSettlementState;
  getBatchByProposalHash: (proposalVersionHash: string) => CrewBatchSettlementReceipt | undefined;
  recordSupporterOrder: (receipt: SupporterOrderReceipt) => void;
  recordObligationInvoice: (receipt: ObligationInvoiceReceipt) => void;
  recordBatchSettlement: (
    receipt: CrewBatchSettlementReceipt,
    updatedSettlements: CrewSettlementRow[],
  ) => void;
};

export type SettlementExecutionOptions = {
  store?: SettlementStore;
  fetchImpl?: FetchLike;
  clientId?: string;
  clientSecret?: string;
};

export type SupporterOrderRequestInput = {
  supporterName?: string;
  supporterEmail?: string;
  amountCents?: number;
  personId?: string | null;
  description?: string;
  requestId?: string;
  capture?: boolean;
};

export type SupporterOrderOperationResult = {
  ok: boolean;
  statusCode: number;
  receipt?: SupporterOrderReceipt;
  error?: SettlementErrorDetail;
  state: CreditRollSettlementState;
};

export type ObligationInvoiceRequestInput = {
  personId?: string | null;
  recipientEmail?: string;
  recipientName?: string;
  invoiceNumber?: string;
  amountCents?: number;
  note?: string;
  requestId?: string;
};

export type ObligationInvoiceOperationResult = {
  ok: boolean;
  statusCode: number;
  receipt?: ObligationInvoiceReceipt;
  error?: SettlementErrorDetail;
  state: CreditRollSettlementState;
};

export type CrewBatchSettlementRequestInput = {
  approvalToken?: string | null;
  approvedBy?: string | null;
  expectedProposalVersionHash?: string | null;
  requestedPersonIds?: string[];
};

export type CrewBatchSettlementOperationResult = {
  ok: boolean;
  statusCode: number;
  idempotentReplay: boolean;
  receipt?: CrewBatchSettlementReceipt;
  validation?: SettlementApprovalValidation;
  error?: SettlementErrorDetail;
  state: CreditRollSettlementState;
};

export function mapPayPalPayoutStatusToSettlement(
  rawStatus: PayPalPayoutTransactionStatus | string | undefined,
): {
  rawTransactionStatus: PayPalPayoutTransactionStatus;
  transactionStatus: SettlementTransactionStatus;
  badgeStatus: SettlementBadgeStatus;
} {
  const normalized = (rawStatus ?? 'PENDING').trim().toUpperCase();
  if (normalized === 'SUCCESS') {
    return {
      rawTransactionStatus: 'SUCCESS',
      transactionStatus: 'SUCCESS',
      badgeStatus: 'PAID',
    };
  }
  if (normalized === 'UNCLAIMED') {
    return {
      rawTransactionStatus: 'UNCLAIMED',
      transactionStatus: 'UNCLAIMED',
      badgeStatus: 'UNCLAIMED',
    };
  }
  if (
    normalized === 'FAILED' ||
    normalized === 'BLOCKED' ||
    normalized === 'RETURNED' ||
    normalized === 'REFUNDED' ||
    normalized === 'REVERSED' ||
    normalized === 'CANCELED'
  ) {
    return {
      rawTransactionStatus: normalized as PayPalPayoutTransactionStatus,
      transactionStatus: 'FAILED',
      badgeStatus: 'FAILED',
    };
  }
  return {
    rawTransactionStatus: (normalized as PayPalPayoutTransactionStatus) || 'PENDING',
    transactionStatus: 'PENDING',
    badgeStatus: 'PENDING',
  };
}

export function createSettlementStore(
  initialScenario: CreditRollScenarioInput = DEFAULT_CREDIT_ROLL_SCENARIO,
): SettlementStore {
  let scenario: CreditRollScenarioInput = structuredClone(initialScenario);
  let reconciled: ReconciledCreditRollResult = reconcileCreditRoll(scenario);
  let proposal: SettlementProposal = buildSettlementProposal(reconciled);
  let supporterOrders: SupporterOrderReceipt[] = [];
  let obligationInvoices: ObligationInvoiceReceipt[] = [];
  const batchesByProposalHash = new Map<string, CrewBatchSettlementReceipt>();

  const buildSnapshot = (): CreditRollSettlementState => ({
    scenario: structuredClone(scenario),
    reconciled: structuredClone(reconciled),
    proposal: structuredClone(proposal),
    supporterOrders: structuredClone(supporterOrders),
    obligationInvoices: structuredClone(obligationInvoices),
    payoutBatches: structuredClone([...batchesByProposalHash.values()]),
  });

  return {
    getState: buildSnapshot,
    reset(nextScenario = DEFAULT_CREDIT_ROLL_SCENARIO) {
      scenario = structuredClone(nextScenario);
      reconciled = reconcileCreditRoll(scenario);
      proposal = buildSettlementProposal(reconciled);
      supporterOrders = [];
      obligationInvoices = [];
      batchesByProposalHash.clear();
      return buildSnapshot();
    },
    getBatchByProposalHash(proposalVersionHash: string) {
      const found = batchesByProposalHash.get(proposalVersionHash);
      return found ? structuredClone(found) : undefined;
    },
    recordSupporterOrder(receipt: SupporterOrderReceipt) {
      supporterOrders = [receipt, ...supporterOrders];
      if (receipt.personId) {
        reconciled = {
          ...reconciled,
          crewSettlements: reconciled.crewSettlements.map((row) =>
            row.personId === receipt.personId
              ? { ...row, paypalOrderId: receipt.orderId }
              : row,
          ),
        };
      }
    },
    recordObligationInvoice(receipt: ObligationInvoiceReceipt) {
      obligationInvoices = [receipt, ...obligationInvoices];
      if (receipt.personId) {
        reconciled = {
          ...reconciled,
          crewSettlements: reconciled.crewSettlements.map((row) =>
            row.personId === receipt.personId
              ? { ...row, paypalInvoiceId: receipt.invoiceId }
              : row,
          ),
        };
      } else {
        reconciled = {
          ...reconciled,
          crewSettlements: reconciled.crewSettlements.map((row) =>
            row.cutStatus === 'GHOST_CUT' && row.eligibleForPayout
              ? { ...row, paypalInvoiceId: receipt.invoiceId }
              : row,
          ),
        };
      }
    },
    recordBatchSettlement(
      receipt: CrewBatchSettlementReceipt,
      updatedSettlements: CrewSettlementRow[],
    ) {
      batchesByProposalHash.set(receipt.proposalVersionHash, structuredClone(receipt));
      reconciled = {
        ...reconciled,
        crewSettlements: structuredClone(updatedSettlements),
      };
    },
  };
}

const defaultStore = createSettlementStore(DEFAULT_CREDIT_ROLL_SCENARIO);
let configuredRouteDeps: Omit<SettlementExecutionOptions, 'store'> | null = null;

export function configureCreditRollRouteDeps(
  deps: Omit<SettlementExecutionOptions, 'store'> | null,
): void {
  configuredRouteDeps = deps;
}

function resolveOptions(options?: SettlementExecutionOptions): {
  store: SettlementStore;
  paypalOptions: PayPalCallOptions;
  secretForRedaction?: string;
} {
  const merged: SettlementExecutionOptions = {
    ...(configuredRouteDeps ?? {}),
    ...(options ?? {}),
  };
  const store = merged.store ?? defaultStore;
  const clientId = merged.clientId ?? process.env.PAYPAL_CLIENT_ID;
  const clientSecret = merged.clientSecret ?? process.env.PAYPAL_SECRET;

  return {
    store,
    paypalOptions: {
      fetchImpl: merged.fetchImpl,
      clientId,
      clientSecret,
    },
    secretForRedaction: clientSecret,
  };
}

function toSettlementErrorResponse(
  err: unknown,
  secretForRedaction?: string,
): { statusCode: number; error: SettlementErrorDetail } {
  if (err instanceof PayPalApiError) {
    return {
      statusCode: err.status,
      error: {
        code: 'PAYPAL_API_ERROR',
        message: redactPayPalSecrets(err.message, secretForRedaction),
        paypalStatus: err.status,
        debugId: err.debugId,
      },
    };
  }
  const rawMessage = err instanceof Error ? err.message : String(err);
  const errorName = err instanceof Error ? err.name : 'Error';
  const safeMessage = redactPayPalSecrets(rawMessage, secretForRedaction);
  const isTimeout =
    errorName === 'TimeoutError' ||
    errorName === 'AbortError' ||
    /timed?\s*out|abort/i.test(rawMessage);

  return {
    statusCode: isTimeout ? 504 : 502,
    error: {
      code: isTimeout ? 'PAYPAL_TIMEOUT' : 'PAYPAL_NETWORK_ERROR',
      message: safeMessage,
      paypalStatus: null,
      debugId: null,
    },
  };
}

export function getCreditRollSettlementState(): CreditRollSettlementState {
  return defaultStore.getState();
}

export function resetCreditRollSettlementState(
  scenario: CreditRollScenarioInput = DEFAULT_CREDIT_ROLL_SCENARIO,
): CreditRollSettlementState {
  return defaultStore.reset(scenario);
}

export async function createAndCaptureSupporterOrder(
  input: SupporterOrderRequestInput = {},
  options?: SettlementExecutionOptions,
): Promise<SupporterOrderOperationResult> {
  const { store, paypalOptions, secretForRedaction } = resolveOptions(options);
  const currentState = store.getState();

  const amountCents = input.amountCents ?? 2500;
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        code: 'INVALID_SUPPORTER_ORDER_AMOUNT',
        message: 'Supporter Pack order amountCents must be a positive safe integer.',
        paypalStatus: null,
        debugId: null,
      },
      state: currentState,
    };
  }

  const supporterName = (input.supporterName ?? 'Executive Producer Backer').trim();
  const supporterEmail = (input.supporterEmail ?? 'supporter.bts.sandbox@creditroll.dev').trim();
  const personId = input.personId?.trim() ? input.personId.trim() : null;
  const orderIndex = currentState.supporterOrders.length + 1;
  const requestId =
    input.requestId?.trim() ??
    `PPREQ-ORDER-${sanitizeIdSegment(currentState.reconciled.projectId)}-${amountCents}-${orderIndex}`;

  try {
    const { createOrderResponse, readBackOrder } = await createAndCaptureOrder(
      {
        amountCents,
        currencyCode: 'USD',
        description:
          input.description ?? 'Neon Nocturne — Behind-the-Scenes Digital Supporter Pack',
        customId: personId ?? currentState.reconciled.projectId,
        referenceId: personId ? `BTS-${sanitizeIdSegment(personId)}` : 'BTS-SUPPORTER-PACK',
        requestId,
        capture: input.capture ?? true,
      },
      paypalOptions,
    );

    const approveLink =
      readBackOrder.links?.find((l) => l.rel === 'approve')?.href ??
      createOrderResponse.links?.find((l) => l.rel === 'approve')?.href ??
      null;

    const receipt: SupporterOrderReceipt = {
      orderId: readBackOrder.id,
      status: readBackOrder.status,
      amountCents,
      currencyCode: 'USD',
      supporterName,
      supporterEmail,
      personId,
      approveUrl: approveLink,
      requestId,
      createdAt: new Date().toISOString(),
    };

    store.recordSupporterOrder(receipt);
    return {
      ok: true,
      statusCode: 200,
      receipt,
      state: store.getState(),
    };
  } catch (err) {
    const { statusCode, error } = toSettlementErrorResponse(err, secretForRedaction);
    return {
      ok: false,
      statusCode,
      error,
      state: store.getState(),
    };
  }
}

export async function createAndSendObligationInvoiceWithQr(
  input: ObligationInvoiceRequestInput = {},
  options?: SettlementExecutionOptions,
): Promise<ObligationInvoiceOperationResult> {
  const { store, paypalOptions, secretForRedaction } = resolveOptions(options);
  const currentState = store.getState();

  const targetPersonId = input.personId?.trim() ? input.personId.trim() : null;
  const targetRow = targetPersonId
    ? currentState.reconciled.crewSettlements.find((row) => row.personId === targetPersonId)
    : undefined;

  if (targetPersonId && (!targetRow || !targetRow.eligibleForPayout)) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        code: 'INVALID_OBLIGATION_TARGET',
        message: `Cannot generate production obligation invoice for unverified or ineligible personId "${targetPersonId}".`,
        paypalStatus: null,
        debugId: null,
      },
      state: currentState,
    };
  }

  const amountCents =
    targetRow?.contractAmountCents ??
    input.amountCents ??
    (currentState.proposal.ghostCutObligationCents > 0
      ? currentState.proposal.ghostCutObligationCents
      : currentState.proposal.totalExecutableCents);

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        code: 'INVALID_INVOICE_AMOUNT',
        message: 'Obligation invoice amountCents must be a positive safe integer.',
        paypalStatus: null,
        debugId: null,
      },
      state: currentState,
    };
  }

  // PayPal rejects an invoice_number it has issued before and caps its length (the live sandbox
  // refused 32 characters and accepted 23). The in-memory invoice count restarts with the
  // server, so the number also carries the issue time: a short person tag, base-36 milliseconds
  // and the count keep every issued invoice unique at about 20 characters.
  const invoiceIndex = currentState.obligationInvoices.length + 1;
  const slug = sanitizeIdSegment(targetPersonId ?? currentState.reconciled.projectId);
  const personTag = slug.replace(/^CREW-/, '').slice(0, 8).replace(/-+$/, '');
  const issueStamp = `${Date.now().toString(36)}${invoiceIndex}`.toUpperCase();
  const invoiceNumber = input.invoiceNumber?.trim() ?? `CR-${personTag}-${issueStamp}`;
  const requestId = input.requestId?.trim() ?? `PPREQ-INV-${invoiceNumber}`;
  const recipientEmail = (
    input.recipientEmail ?? 'exec.producer.funding@creditroll.dev'
  ).trim();
  const recipientName = (
    input.recipientName ?? 'Neon Nocturne Completion Bond Trust'
  ).trim();
  const itemName = targetRow
    ? `${targetRow.stageName} (${targetRow.legalName}) — ${targetRow.contractId} Production Obligation`
    : `${currentState.reconciled.projectTitle} — Ghost-Cut & Crew Obligation Funding`;
  const note =
    input.note ??
    (targetRow
      ? `Locked contract ${targetRow.contractId} (${targetRow.cutStatus}) obligation for ${targetRow.stageName}.`
      : `Production obligation funding for ${currentState.reconciled.projectTitle}.`);

  try {
    const { invoiceId, qrCodeBase64, readBackInvoice } = await createSendAndReadBackInvoiceWithQr(
      {
        invoiceNumber,
        recipientEmail,
        recipientName,
        itemName,
        itemDescription: note,
        amountCents,
        currencyCode: 'USD',
        note,
        requestId,
      },
      paypalOptions,
    );

    const receipt: ObligationInvoiceReceipt = {
      invoiceId: readBackInvoice.id ?? invoiceId,
      invoiceNumber: readBackInvoice.detail?.invoice_number ?? invoiceNumber,
      status: readBackInvoice.status ?? 'SENT',
      amountCents,
      currencyCode: 'USD',
      recipientName,
      recipientEmail,
      personId: targetPersonId,
      qrCodeBase64,
      qrCodeDataUrl: `data:image/png;base64,${qrCodeBase64}`,
      requestId,
      createdAt: new Date().toISOString(),
    };

    store.recordObligationInvoice(receipt);
    return {
      ok: true,
      statusCode: 200,
      receipt,
      state: store.getState(),
    };
  } catch (err) {
    const { statusCode, error } = toSettlementErrorResponse(err, secretForRedaction);
    return {
      ok: false,
      statusCode,
      error,
      state: store.getState(),
    };
  }
}

function applyBatchItemsToSettlementRows(
  currentRows: CrewSettlementRow[],
  approvedSenderItemsByPersonId: Map<string, string>,
  payoutBatchId: string,
  batchItems: PayPalPayoutBatchItem[],
): { updatedRows: CrewSettlementRow[]; itemReceipts: PayoutItemReceipt[] } {
  const bySenderItemId = new Map<string, PayPalPayoutBatchItem>();
  const byReceiverEmail = new Map<string, PayPalPayoutBatchItem>();

  for (const item of batchItems) {
    const senderItemId = item.payout_item?.sender_item_id;
    if (senderItemId) {
      bySenderItemId.set(senderItemId, item);
    }
    const receiver = item.payout_item?.receiver?.toLowerCase();
    if (receiver) {
      byReceiverEmail.set(receiver, item);
    }
  }

  const itemReceipts: PayoutItemReceipt[] = [];
  const updatedRows = currentRows.map((row) => {
    const expectedSenderItemId = approvedSenderItemsByPersonId.get(row.personId);
    if (!expectedSenderItemId) {
      return row;
    }

    const matchedItem =
      bySenderItemId.get(expectedSenderItemId) ??
      (row.receiverEmail ? byReceiverEmail.get(row.receiverEmail.toLowerCase()) : undefined);

    const mapped = mapPayPalPayoutStatusToSettlement(matchedItem?.transaction_status ?? 'PENDING');
    const payoutItemId = matchedItem?.payout_item_id ?? `PITEM-${expectedSenderItemId}`;

    itemReceipts.push({
      personId: row.personId,
      senderItemId: expectedSenderItemId,
      receiverEmail: row.receiverEmail ?? '',
      amountCents: row.contractAmountCents,
      payoutItemId,
      transactionId: matchedItem?.transaction_id ?? null,
      rawTransactionStatus: mapped.rawTransactionStatus,
      transactionStatus: mapped.transactionStatus,
      badgeStatus: mapped.badgeStatus,
    });

    return {
      ...row,
      paypalPayoutBatchId: payoutBatchId,
      paypalPayoutItemId: payoutItemId,
      transactionStatus: mapped.transactionStatus,
      badgeStatus: mapped.badgeStatus,
    };
  });

  return { updatedRows, itemReceipts };
}

export async function executeCrewBatchPayoutAndReadBack(
  request: CrewBatchSettlementRequestInput,
  options?: SettlementExecutionOptions,
): Promise<CrewBatchSettlementOperationResult> {
  const { store, paypalOptions, secretForRedaction } = resolveOptions(options);
  const currentState = store.getState();
  const proposal = currentState.proposal;

  // Step 1: Deterministic financial guardrail validation BEFORE any network request
  const validation = validateSettlementApproval(proposal, request);
  if (!validation.valid) {
    return {
      ok: false,
      statusCode: 400,
      idempotentReplay: false,
      validation,
      error: {
        code: validation.errors[0] ?? 'GUARDRAIL_VALIDATION_FAILED',
        message: `Settlement rejected by deterministic guardrail: ${validation.errors.join(', ')}`,
        paypalStatus: null,
        debugId: null,
        errors: validation.errors,
      },
      state: currentState,
    };
  }

  // Step 2: Idempotent deduplication on proposalVersionHash BEFORE issuing a second POST
  const existingBatch = store.getBatchByProposalHash(proposal.proposalVersionHash);
  if (existingBatch) {
    return {
      ok: true,
      statusCode: 200,
      idempotentReplay: true,
      receipt: existingBatch,
      validation,
      state: store.getState(),
    };
  }

  const approvedSenderItemsByPersonId = new Map<string, string>(
    validation.approvedItems.map((item) => [item.personId, item.senderItemId]),
  );

  try {
    const { readBackBatch } = await createAndReadBackPayoutBatch(
      {
        senderBatchId: proposal.senderBatchId,
        requestId: proposal.paypalRequestId,
        emailSubject: `CreditRoll Live Crew Settlement (${currentState.reconciled.projectId} ${currentState.reconciled.cutVersion})`,
        emailMessage: `Verified production crew settlement for ${currentState.reconciled.projectTitle}.`,
        items: validation.approvedItems.map((item) => ({
          receiverEmail: item.receiverEmail,
          amountCents: item.amountCents,
          currencyCode: 'USD',
          note: item.note,
          senderItemId: item.senderItemId,
        })),
      },
      paypalOptions,
    );

    const payoutBatchId = readBackBatch.batch_header.payout_batch_id;
    const { updatedRows, itemReceipts } = applyBatchItemsToSettlementRows(
      currentState.reconciled.crewSettlements,
      approvedSenderItemsByPersonId,
      payoutBatchId,
      readBackBatch.items ?? [],
    );

    const receipt: CrewBatchSettlementReceipt = {
      payoutBatchId,
      senderBatchId: proposal.senderBatchId,
      paypalRequestId: proposal.paypalRequestId,
      proposalVersionHash: proposal.proposalVersionHash,
      batchStatus: readBackBatch.batch_header.batch_status ?? 'PENDING',
      totalAmountCents: validation.totalAmountCents,
      items: itemReceipts,
      settledAt: new Date().toISOString(),
    };

    store.recordBatchSettlement(receipt, updatedRows);

    return {
      ok: true,
      statusCode: 200,
      idempotentReplay: false,
      receipt,
      validation,
      state: store.getState(),
    };
  } catch (err) {
    const { statusCode, error } = toSettlementErrorResponse(err, secretForRedaction);
    return {
      ok: false,
      statusCode,
      idempotentReplay: false,
      validation,
      error,
      state: store.getState(),
    };
  }
}
