'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AgWidgetField, AgWidgetParams } from 'ag-studio';
import type {
  CrewBatchSettlementReceipt,
  ObligationInvoiceReceipt,
  SupporterOrderReceipt,
} from '@/lib/credit-roll-settlement';
import { formatUsdCents } from '@/lib/format-usd';
import {
  creditRollInteractiveStore,
  dispatchContributorCrossFilter,
  runPatchbaySandboxAction,
  selectCutVersionView,
  type CreditRollErrorBanner,
  type CreditRollStageNode,
  type PatchbayActionKind,
} from './credit-roll-widget-state';

// The cut's end roll starts here; the cue ruler is scaled so this timecode sits at its right edge.
const END_ROLL_TIMECODE = '01:58:12';
const END_ROLL_SECONDS = 1 * 3600 + 58 * 60 + 12;
const RULER_LABEL_MINUTES = [0, 20, 40, 60, 80, 100];

const toSeconds = (timestamp: string): number => {
  const [hours = 0, minutes = 0, seconds = 0] = timestamp.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

const rulerOffset = (seconds: number): string =>
  `${Math.min(100, (seconds / END_ROLL_SECONDS) * 100).toFixed(2)}%`;

const clockLabel = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

type BannerReading = { headline: string | null; detail: string; meta: string | null };

// PayPal failures reach the banner as "PayPal 422 on <path>: <raw JSON body>", and the server
// may cut the body short, so fields are picked out by pattern instead of JSON.parse. Anything
// else (guardrail codes, network errors) is shown as written.
function readBannerMessage(message: string): BannerReading {
  const match = /^PayPal (\d{3}) on (\S+?):\s+([\s\S]*)$/.exec(message);
  if (!match) return { headline: null, detail: message, meta: null };
  const [, status, path, body] = match;
  const pick = (key: string) => {
    const found = new RegExp(`"${key}":"([^"]+)("?)`).exec(body);
    if (!found) return null;
    return found[2] ? found[1] : `${found[1]}…`;
  };
  return {
    headline: pick('issue') ?? pick('name'),
    detail: pick('description') ?? pick('message') ?? body,
    meta: `${status} · ${path.split('?')[0]}`,
  };
}

type LedgerTone = 'bond' | 'splice' | 'hold';

const LEDGER_TONE: Record<LedgerTone, string> = {
  bond: 'text-cr-bond',
  splice: 'text-cr-splice-dim',
  hold: 'text-cr-hold-ink',
};

type PatchKeyTone = 'bond' | 'splice' | 'paid';

const PATCH_KEY_TONE: Record<PatchKeyTone, string> = {
  bond: 'bg-cr-bond text-white',
  splice: 'bg-cr-splice text-cr-ink',
  paid: 'bg-cr-paid-ink text-white',
};

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
  const selectedNode =
    state.stageNodes.find((n) => n.personId === state.selectedPersonId) ?? null;

  return (
    <div
      data-testid="credit-roll-stage-widget"
      data-cut={state.cutVersion}
      className="cr-grain relative flex h-full w-full flex-col overflow-hidden rounded-[4px] bg-cr-void font-grotesk text-cr-bone shadow-[inset_0_0_0_1px_var(--cr-hairline)]"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-black/80 bg-[linear-gradient(180deg,#25211c,#14120f)] px-3 pb-2.5 pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ReelGlyph spinning={rolling} />
            <span className="truncate font-display text-[15px] italic leading-tight text-cr-bone">
              {state.settlementState.reconciled.projectTitle}
            </span>
          </div>
          <span className="cr-label cr-lit shrink-0 text-[9px]">
            {state.cutVersion === 'v2'
              ? `Cut v2 · ${ghostCount} Ghost-Cut Owed`
              : 'Cut v1 · All Cues Credited'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="cut-toggle-v1"
            data-cut="v1"
            aria-pressed={state.cutVersion === 'v1'}
            onClick={() => handleCutSwitch('v1')}
            className="cr-key flex flex-col items-start rounded-[3px] px-2.5 pb-1 pt-1.5 text-left leading-none"
          >
            <span className="text-[12px] font-bold">Cut v1</span>
            <span className="cr-label mt-1 text-[7.5px] opacity-80">Rough Cut · Workprint</span>
          </button>
          <button
            type="button"
            data-testid="cut-toggle-v2"
            data-cut="v2"
            aria-pressed={state.cutVersion === 'v2'}
            onClick={() => handleCutSwitch('v2')}
            className="cr-key flex flex-col items-start rounded-[3px] px-2.5 pb-1 pt-1.5 text-left leading-none"
          >
            <span className="text-[12px] font-bold">Cut v2</span>
            <span className="cr-label mt-1 text-[7.5px] opacity-80">Director&apos;s Cut · Splice</span>
          </button>
          <button
            type="button"
            data-testid="toggle-roll-motion"
            onClick={() => setRolling((prev) => !prev)}
            className="cr-key ml-auto flex items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-[10.5px] font-semibold leading-none"
          >
            <TransportGlyph rolling={rolling} />
            {rolling ? 'Pause Roll' : 'Resume Roll'}
          </button>
        </div>
      </div>

      <TimecodeRuler nodes={state.stageNodes} selectedNode={selectedNode} rolling={rolling} />

      <div className="relative flex min-h-0 flex-1">
        <div aria-hidden data-running={rolling} className="cr-sprockets w-4 shrink-0 border-r border-black" />
        <ol
          aria-label="End credits"
          className="cr-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-[radial-gradient(120%_70%_at_50%_0%,#1b1713_0%,#0b0a08_72%)] px-2 py-2"
        >
          {state.stageNodes.map((node) => (
            <li key={node.cueId}>
              <CreditFrame
                node={node}
                selected={state.selectedPersonId === node.personId}
                onSelect={handleContributorClick}
              />
            </li>
          ))}
        </ol>
        <div aria-hidden data-running={rolling} className="cr-sprockets w-4 shrink-0 border-l border-black" />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-black/80 bg-[#13110e] px-3 py-1.5">
        <span className="truncate text-[10.5px] text-cr-smoke">
          Click a credit or UNPAID_GHOST to cross-filter the grid
        </span>
        {state.selectedPersonId ? (
          <button
            type="button"
            data-testid="clear-cross-filter"
            onClick={handleClearCrossFilter}
            className="cr-chip cr-focus shrink-0 rounded-[3px] px-2 py-1 font-mono text-[10px] leading-none"
          >
            Filter: {state.selectedPersonId} ×
          </button>
        ) : (
          <span className="cr-label shrink-0 text-[8px] text-cr-ash">
            Active filter{' '}
            <span className="cr-lit ml-1 font-mono text-[10px] normal-case tracking-normal">
              all crew · {state.stageNodes.length} cues
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function CreditFrame({
  node,
  selected,
  onSelect,
}: {
  node: CreditRollStageNode;
  selected: boolean;
  onSelect: (personId: string) => void;
}) {
  const onHold = node.badgeStatus === 'NEEDS_REVIEW';
  const frameTone = node.isTranslucentGhost
    ? 'border-dashed border-cr-splice/55 bg-[repeating-linear-gradient(135deg,rgba(242,180,64,0.08)_0_6px,transparent_6px_12px)] hover:border-cr-splice'
    : onHold
      ? 'border-dashed border-cr-hold/45 bg-[#15121a] hover:border-cr-hold'
      : 'border-white/[0.07] bg-[#15130f] hover:border-white/25';
  const amountTone = node.isTranslucentGhost
    ? 'text-cr-splice'
    : onHold
      ? 'text-cr-hold'
      : 'text-cr-bone';

  return (
    <button
      type="button"
      data-testid={`contributor-chip-${node.personId}`}
      data-badge-status={node.badgeStatus}
      data-ghost={node.isTranslucentGhost ? 'true' : 'false'}
      aria-pressed={selected}
      onClick={() => onSelect(node.personId)}
      className={`cr-focus relative block w-full rounded-[3px] border px-2.5 py-1.5 text-left transition-colors ${frameTone} ${
        selected ? 'cr-viewfinder !border-[color:var(--cr-key-lit)]' : ''
      }`}
    >
      <span className="grid grid-cols-[50px_minmax(0,1fr)_auto] items-start gap-x-2.5">
        <span className="pt-[3px] font-mono leading-tight">
          <span className="cr-lit block text-[10.5px]">{node.sceneTimestamp}</span>
          <span className="block text-[9px] text-cr-ash">{node.cueId}</span>
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span
              className={`truncate font-display text-[17px] leading-tight ${
                node.isTranslucentGhost ? 'cr-ghost-name' : 'text-cr-bone'
              }`}
            >
              {node.creditedName}
            </span>
            <span className="truncate font-display text-[11px] italic text-cr-smoke">
              ({node.legalName})
            </span>
          </span>
          <span className="mt-0.5 block truncate font-type text-[10.5px] leading-snug text-cr-ash">
            <span className="cr-label mr-1 text-[8px] text-cr-smoke">{node.role}</span>
            {node.department} · {node.contractId} · {node.cueDescription}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 pt-[3px]">
          <span className={`cr-numerals font-mono text-[12.5px] font-semibold leading-none ${amountTone}`}>
            {node.contractAmountCents > 0 ? formatUsdCents(node.contractAmountCents) : 'HOLD'}
          </span>
          <span className="cr-stamp" data-status={node.badgeStatus}>
            {node.badgeStatus}
          </span>
        </span>
      </span>

      {node.ghostCallout && (
        <span
          data-testid={`ghost-callout-${node.personId}`}
          className="mt-1 flex items-center gap-1.5 text-[10.5px] text-cr-splice"
        >
          <span className="cr-label text-[8px]">UNPAID_GHOST</span>
          <span aria-hidden>·</span>
          <span className="truncate font-type">{node.ghostCallout}</span>
        </span>
      )}

      {onHold && node.reviewReason && (
        <span className="mt-1 block font-type text-[10.5px] leading-snug text-cr-hold">
          Guardrail Hold: {node.reviewReason}
        </span>
      )}

      {node.isTranslucentGhost && (
        <>
          <span aria-hidden className="cr-tape cr-tape--lead left-[32%] -top-[5px] h-[10px] w-[50px]" />
          <span aria-hidden className="cr-tape cr-tape--tail -bottom-[5px] right-[24%] h-[10px] w-[42px]" />
        </>
      )}
    </button>
  );
}

function TimecodeRuler({
  nodes,
  selectedNode,
  rolling,
}: {
  nodes: CreditRollStageNode[];
  selectedNode: CreditRollStageNode | null;
  rolling: boolean;
}) {
  return (
    <div aria-hidden className="flex h-[38px] shrink-0 items-stretch border-b border-black/80 bg-[#0b0a08]">
      <div className="flex w-[122px] shrink-0 flex-col justify-center gap-0.5 border-r border-cr-hairline px-2.5">
        <span className="cr-label truncate text-[7.5px] text-cr-ash">
          {selectedNode ? `${selectedNode.cueId} · ${selectedNode.creditedName}` : 'End roll · SMPTE'}
        </span>
        <span className="cr-vfd text-[14px] leading-none">
          {selectedNode ? selectedNode.sceneTimestamp : END_ROLL_TIMECODE}:
          <span className="cr-frame-counter" data-running={rolling} />
        </span>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden bg-[repeating-linear-gradient(90deg,var(--cr-hairline-strong)_0_1px,transparent_1px_4.23%)] bg-[length:100%_6px] bg-bottom bg-no-repeat">
        {RULER_LABEL_MINUTES.map((minutes) => (
          <span
            key={minutes}
            className="absolute bottom-0 h-3 w-px bg-cr-ash"
            style={{ left: rulerOffset(minutes * 60) }}
          >
            <span className="absolute -top-[13px] left-1 font-mono text-[8px] text-cr-ash">
              {clockLabel(minutes)}
            </span>
          </span>
        ))}
        {nodes.map((node) => (
          <span
            key={node.cueId}
            className="cr-cue-marker"
            data-tone={node.isTranslucentGhost ? 'ghost' : node.badgeStatus === 'NEEDS_REVIEW' ? 'hold' : 'credited'}
            data-selected={selectedNode?.cueId === node.cueId}
            style={{ left: rulerOffset(toSeconds(node.sceneTimestamp)) }}
          />
        ))}
        <span className="cr-label cr-lit absolute right-1.5 top-1 text-[7.5px]">End roll ▸</span>
      </div>
    </div>
  );
}

function ReelGlyph({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      className={`cr-lit size-[18px] shrink-0 ${spinning ? 'motion-safe:animate-[spin_6s_linear_infinite]' : ''}`}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="6.2" r="2.2" />
      <circle cx="17.5" cy="10.2" r="2.2" />
      <circle cx="15.4" cy="16.7" r="2.2" />
      <circle cx="8.6" cy="16.7" r="2.2" />
      <circle cx="6.5" cy="10.2" r="2.2" />
    </svg>
  );
}

function TransportGlyph({ rolling }: { rolling: boolean }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-2.5 shrink-0" fill="currentColor">
      {rolling ? (
        <>
          <rect x="2" y="1.5" width="2.6" height="9" rx="0.5" />
          <rect x="7.4" y="1.5" width="2.6" height="9" rx="0.5" />
        </>
      ) : (
        <path d="M3 1.5v9l7.5-4.5z" />
      )}
    </svg>
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

  const ghostNames = proposal.executableItems
    .filter((item) => item.cutStatus === 'GHOST_CUT')
    .map((item) => item.stageName);
  const holdNames = [...new Set(proposal.blockedItems.map((row) => row.stageName))];
  const creditedNames = new Map(
    state.stageNodes.map((node) => [node.personId, node.creditedName]),
  );
  const nameFor = (personId: string) => creditedNames.get(personId) ?? personId;

  return (
    <div
      data-testid="ghost-patchbay-widget"
      className="cr-scroll flex h-full w-full flex-col overflow-y-auto rounded-[4px] bg-[linear-gradient(180deg,#201c17,#100e0c)] p-1.5 font-grotesk text-cr-bone shadow-[inset_0_0_0_1px_var(--cr-hairline)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-1.5 pb-1.5 pt-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="cr-screw" />
          <span className="cr-label truncate text-[9px] text-cr-bone">
            Ghost Diff &amp; Identity Patchbay
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="cr-label text-[8px] text-cr-smoke">PayPal Sandbox · Read-Back</span>
          <span aria-hidden className="cr-screw" />
        </span>
      </div>

      <div className="cr-paper relative shrink-0 rounded-[2px] shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
        <section className="px-3 pb-2.5 pt-2">
          <div className="flex items-baseline justify-between gap-2 border-b border-cr-ink/20 pb-1">
            <h3 className="font-display text-[16px] italic leading-tight">Settlement voucher</h3>
            <span className="cr-label truncate text-[7.5px] text-cr-ink-soft">
              Completion bond · Rev {proposal.revision} · Cut {proposal.cutVersion}
            </span>
          </div>
          <ul className="mt-0.5 divide-y divide-dashed divide-cr-ink/15">
            <LedgerLine
              tone="bond"
              label="Executable"
              detail={`${proposal.executableItems.length} verified crew · locked integer cents`}
              value={formatUsdCents(proposal.totalExecutableCents)}
            />
            <LedgerLine
              tone="splice"
              label="Ghost-cut retained"
              detail={`100% owed · ${ghostNames.join(' & ') || 'none'}`}
              value={formatUsdCents(proposal.ghostCutObligationCents)}
            />
            <LedgerLine
              tone="hold"
              label="Guardrail hold"
              detail={`${proposal.blockedItems.length} NEEDS_REVIEW · ${holdNames.join(', ') || 'none'}`}
              value={
                <span className="cr-stamp" data-status="NEEDS_REVIEW">
                  Hold
                </span>
              }
            />
          </ul>
          <div className="mt-1.5 space-y-0.5 font-mono text-[9px] leading-snug text-cr-ink-soft">
            <p>
              <span className="cr-label mr-1.5 text-[7px]">Proposal hash</span>
              <span data-testid="patchbay-proposal-hash" className="break-all text-cr-bond-navy">
                {proposal.proposalVersionHash}
              </span>
            </p>
            <p>
              <span className="cr-label mr-1.5 text-[7px]">Batch key</span>
              <span className="break-all text-cr-ink">{proposal.senderBatchId}</span>
            </p>
          </div>
        </section>

        <div aria-hidden className="cr-perforation" />

        <section className="space-y-2 bg-cr-paper-shade/55 px-3 pb-3 pt-2">
          {state.errorBanner && <HaltNotice banner={state.errorBanner} />}

          {state.inFlightAction && (
            <div
              data-testid="patchbay-inflight-banner"
              className="cr-progress flex items-center gap-2 rounded-[2px] bg-cr-bond-navy px-2.5 py-1.5 text-[11px] font-semibold text-white"
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-cr-bond-sky shadow-[0_0_8px_var(--cr-bond-sky)] motion-safe:animate-pulse" />
              <span className="cr-label shrink-0 text-[7.5px] text-cr-bond-sky">On air</span>
              <span className="min-w-0 flex-1 leading-snug">{state.progressText}</span>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[2px] border border-cr-ink/20 bg-cr-paper/80 px-2.5 py-2 transition-colors hover:border-cr-ink/40">
            <input
              type="checkbox"
              data-testid="patchbay-approval-checkbox"
              checked={state.humanApproved}
              onChange={(e) => toggleHumanApproval(e.target.checked)}
              className="cr-arming mt-0.5"
            />
            <span className="min-w-0">
              <span
                className={`cr-label block text-[7.5px] ${
                  state.humanApproved ? 'text-cr-bond' : 'text-cr-ink-soft'
                }`}
              >
                {state.humanApproved
                  ? 'Approved · payouts armed'
                  : 'Safety on · producer approval required'}
              </span>
              <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-cr-ink">
                Explicit Producer Approval: Lock {proposal.executableItems.length} verified
                contracts ({formatUsdCents(proposal.totalExecutableCents)}) &amp; exclude
                NEEDS_REVIEW aliases
              </span>
            </span>
          </label>

          <div className="grid grid-cols-3 gap-1.5">
            <PatchKey
              testId="btn-supporter-order"
              tone="bond"
              api="Orders v2 · capture"
              label="1. BTS Order ($25.00)"
              disabled={state.isActionLocked}
              onPress={() => {
                void triggerSandboxAction('supporter-order');
              }}
            />
            <PatchKey
              testId="btn-obligation-invoice"
              tone="splice"
              api="Invoicing v2 · QR"
              label="2. Ghost Invoice + QR"
              disabled={state.isActionLocked}
              onPress={() => {
                void triggerSandboxAction('obligation-invoice');
              }}
            />
            <PatchKey
              testId="btn-batch-settlement"
              tone="paid"
              api="Payouts v1 · batch"
              label="3. Settle Crew Payouts"
              disabled={state.isActionLocked}
              onPress={() => {
                void triggerSandboxAction('batch-settlement');
              }}
            />
          </div>
        </section>

        <ReadBackVouchers
          order={state.latestOrderReceipt}
          invoice={state.latestInvoiceReceipt}
          batch={state.latestBatchReceipt}
          nameFor={nameFor}
        />
      </div>

      <p className="shrink-0 px-1.5 pb-0.5 pt-1.5 text-[10px] leading-snug text-cr-smoke">
        AI Assistant can inspect ghosted crew &amp; stage names; all PayPal writes require human
        Patchbay approval.
      </p>
    </div>
  );
}

function HaltNotice({ banner }: { banner: CreditRollErrorBanner }) {
  const reading = readBannerMessage(banner.message);
  const trail = [reading.meta, banner.debugId ? `PayPal debug_id ${banner.debugId}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      role="alert"
      data-testid="patchbay-error-banner"
      className="rounded-[2px] border border-cr-fail-ink/40 bg-[#f6dcd3] px-2.5 py-2 text-cr-fail-ink [overflow-wrap:anywhere]"
    >
      <span className="cr-label block text-[7.5px]">Notice · settlement halted</span>
      <span className="mt-0.5 block text-[11.5px] font-semibold leading-snug">
        [{banner.code}] {reading.headline ?? reading.detail}
      </span>
      {reading.headline && <span className="mt-0.5 block text-[11px] leading-snug">{reading.detail}</span>}
      {trail && <span className="mt-1 block font-mono text-[10px] leading-snug opacity-90">{trail}</span>}
    </div>
  );
}

function ReadBackVouchers({
  order,
  invoice,
  batch,
  nameFor,
}: {
  order: SupporterOrderReceipt | null;
  invoice: ObligationInvoiceReceipt | null;
  batch: CrewBatchSettlementReceipt | null;
  nameFor: (personId: string) => string;
}) {
  const empty = !order && !invoice && !batch;
  return (
    <section className="px-3 pb-3 pt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="cr-label text-[8px] text-cr-ink-soft">Read-back vouchers</h4>
        <span className="font-type text-[10px] text-cr-ink-soft">GET after every write</span>
      </div>
      {empty ? (
        <p className="mt-1.5 rounded-[2px] border border-dashed border-cr-ink/25 px-2.5 py-2 font-type text-[10.5px] leading-snug text-cr-ink-soft">
          No PayPal read-back yet. Order ids, the invoice QR and per-item payout stamps land here
          once a sandbox call returns.
        </p>
      ) : (
        <div className="mt-1.5 space-y-2">
          {order && <OrderStub receipt={order} />}
          {invoice && <InvoiceStub receipt={invoice} />}
          {batch && <BatchStub receipt={batch} nameFor={nameFor} />}
        </div>
      )}
    </section>
  );
}

function LedgerLine({
  label,
  detail,
  value,
  tone,
}: {
  label: string;
  detail: string;
  value: ReactNode;
  tone: LedgerTone;
}) {
  return (
    <li className="py-1">
      <span className="flex items-baseline gap-2">
        <span className="shrink-0 text-[12px] font-semibold">{label}</span>
        <span aria-hidden className="min-w-3 flex-1 -translate-y-[3px] border-b border-dotted border-cr-ink/35" />
        <span className={`cr-numerals shrink-0 font-mono text-[13px] font-bold ${LEDGER_TONE[tone]}`}>
          {value}
        </span>
      </span>
      <span className="block truncate font-type text-[10px] text-cr-ink-soft">{detail}</span>
    </li>
  );
}

function PatchKey({
  testId,
  tone,
  api,
  label,
  disabled,
  onPress,
}: {
  testId: string;
  tone: PatchKeyTone;
  api: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onPress}
      className={`cr-patch-key flex flex-col items-start rounded-[3px] px-2 pb-1.5 pt-1.5 text-left disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 ${PATCH_KEY_TONE[tone]}`}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="cr-jack" />
        <span className="cr-label text-[7px] opacity-85">{api}</span>
      </span>
      <span className="mt-1 text-[11px] font-bold leading-tight">{label}</span>
    </button>
  );
}

function OrderStub({ receipt }: { receipt: SupporterOrderReceipt }) {
  const captured = receipt.status === 'COMPLETED';
  const approveUrl = !captured && receipt.approveUrl?.startsWith('https://') ? receipt.approveUrl : null;
  return (
    <div data-testid="receipt-supporter-order" className="cr-stub bg-[#fcfaf4]">
      <span className="flex items-center justify-between gap-2">
        <span className="cr-label text-[7.5px] text-cr-ink-soft">
          {captured ? 'Orders v2 · capture read-back' : 'Orders v2 · awaiting supporter approval'}
        </span>
        <span className="cr-stamp" data-status={receipt.status}>
          {receipt.status}
        </span>
      </span>
      <span className="mt-1 flex items-baseline justify-between gap-2 font-mono text-[10.5px]">
        <span className="truncate">PayPal Order Read-Back: {receipt.orderId}</span>
        <span className="cr-numerals shrink-0 font-semibold">{formatUsdCents(receipt.amountCents)}</span>
      </span>
      <span className="block truncate font-type text-[10px] text-cr-ink-soft">
        BTS Supporter Pack · {receipt.supporterName}
        {approveUrl && (
          <>
            {' · '}
            <a href={approveUrl} target="_blank" rel="noreferrer" className="text-cr-bond-navy underline">
              approve in PayPal ↗
            </a>
          </>
        )}
      </span>
    </div>
  );
}

function InvoiceStub({ receipt }: { receipt: ObligationInvoiceReceipt }) {
  return (
    <div data-testid="receipt-obligation-invoice" className="cr-stub flex items-center gap-3 bg-[#f8efc9]">
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="cr-label text-[7.5px] text-cr-ink-soft">Invoicing v2 · QR read-back</span>
          <span className="cr-stamp" data-status={receipt.status}>
            {receipt.status}
          </span>
        </span>
        <span className="mt-1 block truncate font-mono text-[10.5px]">
          PayPal Invoice Read-Back: {receipt.invoiceId}
        </span>
        <span className="block truncate font-type text-[10px] text-cr-ink-soft">
          #{receipt.invoiceNumber} · {formatUsdCents(receipt.amountCents)} · {receipt.recipientName}
        </span>
      </span>
      {receipt.qrCodeDataUrl && (
        <div
          role="img"
          data-testid="invoice-qr-image"
          aria-label={`QR Code for invoice ${receipt.invoiceId}`}
          style={{ backgroundImage: `url(${receipt.qrCodeDataUrl})` }}
          className="size-16 shrink-0 rounded-[2px] border border-cr-ink/25 bg-white bg-contain bg-center bg-no-repeat p-1"
        />
      )}
    </div>
  );
}

function BatchStub({
  receipt,
  nameFor,
}: {
  receipt: CrewBatchSettlementReceipt;
  nameFor: (personId: string) => string;
}) {
  return (
    <div data-testid="receipt-batch-settlement" className="cr-stub bg-[#f5e5df]">
      <span className="flex items-center justify-between gap-2">
        <span className="cr-label text-[7.5px] text-cr-ink-soft">Payouts v1 · batch read-back</span>
        <span className="cr-stamp" data-status={receipt.batchStatus}>
          {receipt.batchStatus}
        </span>
      </span>
      <span className="mt-1 flex items-baseline justify-between gap-2 font-mono text-[10.5px]">
        <span className="truncate">Payout Batch: {receipt.payoutBatchId}</span>
        <span className="cr-numerals shrink-0 font-semibold">
          {formatUsdCents(receipt.totalAmountCents)}
        </span>
      </span>
      <ul className="mt-1 divide-y divide-dashed divide-cr-ink/15">
        {receipt.items.map((item) => (
          <li
            key={item.personId}
            data-testid={`batch-item-status-${item.personId}`}
            className="flex items-center gap-2 py-1 text-[10.5px]"
          >
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{nameFor(item.personId)}</span>{' '}
              <span className="font-mono text-[9.5px] text-cr-ink-soft">{item.payoutItemId}</span>
            </span>
            <span className="cr-numerals shrink-0 font-mono">{formatUsdCents(item.amountCents)}</span>
            <span className="cr-stamp" data-status={item.transactionStatus}>
              {item.transactionStatus}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
