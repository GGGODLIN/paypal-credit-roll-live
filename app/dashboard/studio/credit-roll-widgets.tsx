'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AgWidgetField, AgWidgetParams } from 'ag-studio';
import type { SettlementBadgeStatus } from '@/lib/credit-roll-reconciler';
import {
  creditRollInteractiveStore,
  dispatchContributorCrossFilter,
  runPatchbaySandboxAction,
  selectCutVersionView,
  type PatchbayActionKind,
} from './credit-roll-widget-state';

const BADGE_STYLES: Record<SettlementBadgeStatus, string> = {
  PAID: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
  PENDING: 'bg-sky-950/90 text-sky-300 border-sky-500/50',
  UNCLAIMED: 'bg-amber-950/90 text-amber-200 border-amber-400/50',
  FAILED: 'bg-rose-950/90 text-rose-300 border-rose-500/50',
  UNPAID_GHOST: 'bg-amber-900/80 text-amber-200 border-amber-400/70',
  NEEDS_REVIEW: 'bg-purple-950/90 text-purple-200 border-purple-400/60',
  READY: 'bg-slate-800 text-slate-200 border-slate-600',
};

const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function CreditRollStageWidget(params: AgWidgetParams) {
  const { widgetApi } = params;
  const state = useSyncExternalStore(
    creditRollInteractiveStore.subscribe,
    creditRollInteractiveStore.getState,
    creditRollInteractiveStore.getState,
  );
  const [rolling, setRolling] = useState(true);

  useEffect(() => {
    widgetApi?.setDisplayState?.('displayed');
  }, [widgetApi]);

  const handleCutSwitch = (nextCut: 'v1' | 'v2') => {
    const next = selectCutVersionView(
      creditRollInteractiveStore.getState(),
      nextCut,
    );
    creditRollInteractiveStore.setState(next);
  };

  const mappedCols = (
    params.dataMapping as { cols?: AgWidgetField[] } | undefined
  )?.cols;
  const personField =
    mappedCols?.find(
      (f) => String(f.fieldId) === 'crewSettlements.personId',
    ) ?? mappedCols?.[0];

  const handleContributorClick = (personId: string) => {
    const next = dispatchContributorCrossFilter(
      creditRollInteractiveStore.getState(),
      personId,
      widgetApi,
      personField,
    );
    creditRollInteractiveStore.setState(next);
  };

  const handleClearCrossFilter = () => {
    if (!state.selectedPersonId) return;
    const next = dispatchContributorCrossFilter(
      creditRollInteractiveStore.getState(),
      state.selectedPersonId,
      widgetApi,
      personField,
    );
    creditRollInteractiveStore.setState(next);
  };

  const ghostCount = state.stageNodes.filter((n) => n.isTranslucentGhost).length;

  return (
    <div
      data-testid="credit-roll-stage-widget"
      className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-slate-950 text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
          <span className="font-semibold tracking-wide text-white">
            {state.settlementState.reconciled.projectTitle}
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">
            {state.cutVersion === 'v2'
              ? `Cut v2 · ${ghostCount} Ghost-Cut Owed`
              : 'Cut v1 · All Cues Credited'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="cut-toggle-v1"
            onClick={() => handleCutSwitch('v1')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              state.cutVersion === 'v1'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Cut v1 (Rough Cut)
          </button>
          <button
            type="button"
            data-testid="cut-toggle-v2"
            onClick={() => handleCutSwitch('v2')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              state.cutVersion === 'v2'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Cut v2 (Director&apos;s Cut)
          </button>
          <button
            type="button"
            data-testid="toggle-roll-motion"
            onClick={() => setRolling((prev) => !prev)}
            className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
          >
            {rolling ? 'Pause Roll' : 'Resume Roll'}
          </button>
          {state.selectedPersonId && (
            <button
              type="button"
              data-testid="clear-cross-filter"
              onClick={handleClearCrossFilter}
              className="rounded bg-sky-500/20 px-2 py-1 text-[11px] font-medium text-sky-300 ring-1 ring-sky-400/50 hover:bg-sky-500/30"
            >
              Filter: {state.selectedPersonId} ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        <div
          className={`space-y-2 transition-transform duration-500 ${
            rolling ? 'translate-y-0' : 'opacity-95'
          }`}
        >
          {state.stageNodes.map((node) => {
            const isSelected = state.selectedPersonId === node.personId;
            return (
              <button
                key={node.cueId}
                type="button"
                data-testid={`contributor-chip-${node.personId}`}
                data-badge-status={node.badgeStatus}
                data-ghost={node.isTranslucentGhost ? 'true' : 'false'}
                onClick={() => handleContributorClick(node.personId)}
                className={`w-full rounded-md border px-3 py-2 text-left transition ${
                  node.isTranslucentGhost
                    ? 'border-dashed border-amber-400/70 bg-amber-950/25 opacity-80 hover:opacity-100'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                } ${
                  isSelected
                    ? 'ring-2 ring-cyan-400 border-cyan-400 bg-slate-900'
                    : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-400">
                      {node.sceneTimestamp}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {node.creditedName}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({node.legalName})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-emerald-300">
                      {node.contractAmountCents > 0
                        ? formatUsd(node.contractAmountCents)
                        : 'HOLD'}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                        BADGE_STYLES[node.badgeStatus]
                      }`}
                    >
                      {node.badgeStatus}
                    </span>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    {node.department} · {node.role} ·{' '}
                    <code className="text-[11px] text-slate-400">
                      {node.contractId}
                    </code>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {node.cueDescription}
                  </span>
                </div>

                {node.ghostCallout && (
                  <div
                    data-testid={`ghost-callout-${node.personId}`}
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-200 ring-1 ring-amber-400/40"
                  >
                    <span>GHOST CREDIT:</span>
                    <span>{node.ghostCallout}</span>
                  </div>
                )}

                {node.badgeStatus === 'NEEDS_REVIEW' && node.reviewReason && (
                  <div className="mt-1.5 rounded bg-purple-950/60 px-2 py-0.5 text-[11px] text-purple-200">
                    Guardrail Hold: {node.reviewReason}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-400">
        <span>
          Click any contributor or UNPAID_GHOST node to cross-filter the AG Grid
        </span>
        <span className="font-mono">
          Active Filter: {state.selectedPersonId ?? 'ALL CREW (6)'}
        </span>
      </div>
    </div>
  );
}

export function GhostPatchbayWidget(params: AgWidgetParams) {
  const { widgetApi } = params;
  const state = useSyncExternalStore(
    creditRollInteractiveStore.subscribe,
    creditRollInteractiveStore.getState,
    creditRollInteractiveStore.getState,
  );

  useEffect(() => {
    widgetApi?.setDisplayState?.('displayed');
  }, [widgetApi]);

  const { proposal } = state.settlementState;

  const toggleHumanApproval = (checked: boolean) => {
    const current = creditRollInteractiveStore.getState();
    creditRollInteractiveStore.setState({
      ...current,
      humanApproved: checked,
      errorBanner:
        checked && current.errorBanner?.code === 'MISSING_HUMAN_APPROVAL_TOKEN'
          ? null
          : current.errorBanner,
    });
  };

  const triggerSandboxAction = async (kind: PatchbayActionKind) => {
    const current = creditRollInteractiveStore.getState();
    const next = await runPatchbaySandboxAction(current, {
      kind,
      personId: current.selectedPersonId,
      humanApproved: current.humanApproved,
      onStateChange(inFlight) {
        creditRollInteractiveStore.setState(inFlight);
      },
    });
    creditRollInteractiveStore.setState(next);
  };

  return (
    <div
      data-testid="ghost-patchbay-widget"
      className="flex h-full w-full flex-col justify-between overflow-y-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"
    >
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <div className="text-sm font-semibold text-white">
              Ghost Diff &amp; Identity Patchbay
            </div>
            <div className="text-[11px] text-slate-400">
              Deterministic Reconciler · Locked Integer Cents · PayPal Sandbox
              Read-Back
            </div>
          </div>
          <span className="rounded bg-emerald-950/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
            Executable: {formatUsd(proposal.totalExecutableCents)} (
            {proposal.executableItems.length} Crew)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded bg-slate-900/90 p-2 font-mono text-[11px] text-slate-300">
          <div>
            <span className="text-slate-500">Proposal Hash: </span>
            <span
              data-testid="patchbay-proposal-hash"
              className="break-all text-cyan-300"
            >
              {proposal.proposalVersionHash}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Ghost-Cut Retained: </span>
            <span className="font-semibold text-amber-300">
              {formatUsd(proposal.ghostCutObligationCents)} (100% Owed)
            </span>
          </div>
          <div>
            <span className="text-slate-500">Batch ID Key: </span>
            <span className="text-slate-200">{proposal.senderBatchId}</span>
          </div>
          <div>
            <span className="text-slate-500">Guardrail Hold: </span>
            <span className="text-purple-300">
              {proposal.blockedItems.length} NEEDS_REVIEW (Alex Rivera)
            </span>
          </div>
        </div>

        {state.errorBanner && (
          <div
            role="alert"
            data-testid="patchbay-error-banner"
            className="rounded border border-rose-500/60 bg-rose-950/80 px-2.5 py-2 text-xs text-rose-200"
          >
            <div className="font-semibold">
              [{state.errorBanner.code}] {state.errorBanner.message}
            </div>
            {state.errorBanner.debugId && (
              <div className="mt-0.5 font-mono text-[11px] text-rose-300">
                PayPal debug_id: {state.errorBanner.debugId}
              </div>
            )}
          </div>
        )}

        {state.inFlightAction && (
          <div
            data-testid="patchbay-inflight-banner"
            className="rounded border border-sky-500/50 bg-sky-950/70 px-2.5 py-1.5 font-medium text-sky-200"
          >
            {state.progressText}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-xs hover:border-slate-700">
          <input
            type="checkbox"
            data-testid="patchbay-approval-checkbox"
            checked={state.humanApproved}
            onChange={(e) => toggleHumanApproval(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 accent-cyan-400"
          />
          <span className="font-medium text-slate-200">
            Explicit Producer Approval: Lock {proposal.executableItems.length}{' '}
            verified contracts ({formatUsd(proposal.totalExecutableCents)}) &amp;
            exclude NEEDS_REVIEW aliases
          </span>
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            data-testid="btn-supporter-order"
            disabled={state.isActionLocked}
            onClick={() => {
              void triggerSandboxAction('supporter-order');
            }}
            className="rounded bg-sky-500 px-2.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            1. BTS Order ($25.00)
          </button>

          <button
            type="button"
            data-testid="btn-obligation-invoice"
            disabled={state.isActionLocked}
            onClick={() => {
              void triggerSandboxAction('obligation-invoice');
            }}
            className="rounded bg-amber-400 px-2.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            2. Ghost Invoice + QR
          </button>

          <button
            type="button"
            data-testid="btn-batch-settlement"
            disabled={state.isActionLocked}
            onClick={() => {
              void triggerSandboxAction('batch-settlement');
            }}
            className="rounded bg-emerald-400 px-2.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            3. Settle Crew Payouts
          </button>
        </div>

        <div className="space-y-2 pt-1">
          {state.latestOrderReceipt && (
            <div
              data-testid="receipt-supporter-order"
              className="rounded border border-sky-500/40 bg-slate-900/90 p-2"
            >
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="font-semibold text-sky-300">
                  PayPal Order Read-Back: {state.latestOrderReceipt.orderId}
                </span>
                <span className="rounded bg-sky-950 px-1.5 py-0.5 text-sky-200">
                  {state.latestOrderReceipt.status} ·{' '}
                  {formatUsd(state.latestOrderReceipt.amountCents)}
                </span>
              </div>
            </div>
          )}

          {state.latestInvoiceReceipt && (
            <div
              data-testid="receipt-obligation-invoice"
              className="flex items-center justify-between gap-3 rounded border border-amber-500/40 bg-slate-900/90 p-2"
            >
              <div className="space-y-0.5 font-mono text-[11px]">
                <div className="font-semibold text-amber-300">
                  PayPal Invoice Read-Back: {state.latestInvoiceReceipt.invoiceId}
                </div>
                <div className="text-slate-300">
                  #{state.latestInvoiceReceipt.invoiceNumber} · Status:{' '}
                  <span className="font-semibold text-white">
                    {state.latestInvoiceReceipt.status}
                  </span>{' '}
                  · {formatUsd(state.latestInvoiceReceipt.amountCents)}
                </div>
              </div>
              {state.latestInvoiceReceipt.qrCodeDataUrl && (
                <div
                  role="img"
                  data-testid="invoice-qr-image"
                  aria-label={`QR Code for invoice ${state.latestInvoiceReceipt.invoiceId}`}
                  style={{
                    backgroundImage: `url(${state.latestInvoiceReceipt.qrCodeDataUrl})`,
                  }}
                  className="h-14 w-14 shrink-0 rounded border border-slate-700 bg-white bg-contain bg-center bg-no-repeat p-1"
                />
              )}
            </div>
          )}

          {state.latestBatchReceipt && (
            <div
              data-testid="receipt-batch-settlement"
              className="rounded border border-emerald-500/40 bg-slate-900/90 p-2 font-mono text-[11px]"
            >
              <div className="flex items-center justify-between text-emerald-300">
                <span className="font-semibold">
                  Payout Batch: {state.latestBatchReceipt.payoutBatchId}
                </span>
                <span>
                  Batch Status: {state.latestBatchReceipt.batchStatus} ·{' '}
                  {formatUsd(state.latestBatchReceipt.totalAmountCents)}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {state.latestBatchReceipt.items.map((item) => (
                  <div
                    key={item.personId}
                    data-testid={`batch-item-status-${item.personId}`}
                    className="flex items-center justify-between rounded bg-slate-950 px-2 py-1 text-[10px]"
                  >
                    <span className="truncate text-slate-300">
                      {item.personId} ({item.payoutItemId})
                    </span>
                    <span className="font-semibold text-emerald-300">
                      {item.transactionStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 border-t border-slate-800 pt-1.5 text-[11px] text-slate-400">
        AI Assistant can inspect ghosted crew &amp; stage names; all PayPal writes
        require human Patchbay approval.
      </div>
    </div>
  );
}
