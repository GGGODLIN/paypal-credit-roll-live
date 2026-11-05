// Everything the home page states about Neon Nocturne comes from the same reconciler the
// dashboard runs, so the figures on the landing page cannot drift from the ones in AG Studio.

import {
  DEFAULT_CREDIT_ROLL_SCENARIO,
  buildSettlementProposal,
  reconcileCreditRoll,
  type CreditCueRow,
  type CreditRollScenarioInput,
  type ReconciliationStatus,
} from '@/lib/credit-roll-reconciler';

export type CutPresence =
  | { kind: 'in-cut'; timestamp: string }
  | { kind: 'cut' }
  | { kind: 'absent' }
  | { kind: 'unresolved'; cueId: string };

export type DossierRow = {
  contractId: string;
  creditedAs: string;
  legalName: string;
  role: string;
  feeCents: number;
  roughCut: CutPresence;
  directorsCut: CutPresence;
  verdict: ReconciliationStatus;
  note: string;
};

export type RollCredit = {
  cueId: string;
  role: string;
  name: string;
  amountCents: number;
  tone: 'credited' | 'ghost' | 'hold';
};

export type Dossier = {
  projectId: string;
  projectTitle: string;
  revision: number;
  rows: DossierRow[];
  roll: RollCredit[];
  executableCents: number;
  executableCount: number;
  ghostCents: number;
  ghostNames: string[];
  heldAliases: string[];
  heldCandidateCount: number;
  proposalHash: string;
  senderBatchId: string;
};

const normalise = (value: string) => value.trim().toLowerCase();

function presenceIn(cues: CreditCueRow[], cut: 'v1' | 'v2'): CutPresence {
  const inCut = cues.find((cue) => (cut === 'v1' ? cue.appearsInCutV1 : cue.appearsInCutV2));
  if (inCut) return { kind: 'in-cut', timestamp: inCut.sceneTimestamp };
  if (cut === 'v2' && cues.some((cue) => cue.appearsInCutV1)) return { kind: 'cut' };
  return { kind: 'absent' };
}

export function buildDossier(scenario: CreditRollScenarioInput = DEFAULT_CREDIT_ROLL_SCENARIO): Dossier {
  const reconciled = reconcileCreditRoll(scenario);
  const proposal = buildSettlementProposal(reconciled);
  const contracts = scenario.contracts ?? [];

  const settlementByPerson = new Map(reconciled.crewSettlements.map((row) => [row.personId, row]));
  const contractsByStageName = new Map<string, number>();
  for (const contract of contracts) {
    const key = normalise(contract.stageName);
    contractsByStageName.set(key, (contractsByStageName.get(key) ?? 0) + 1);
  }

  const rows: DossierRow[] = contracts.map((contract) => {
    const settlement = settlementByPerson.get(contract.personId);
    const cues = reconciled.creditCues.filter((cue) => cue.personId === contract.personId);
    if (settlement) {
      const verdict = settlement.reconciliationStatus;
      return {
        contractId: contract.contractId,
        creditedAs: contract.stageName,
        legalName: contract.legalName,
        role: contract.role,
        feeCents: settlement.contractAmountCents,
        roughCut: presenceIn(cues, 'v1'),
        directorsCut: presenceIn(cues, 'v2'),
        verdict,
        note:
          verdict === 'GHOST_CUT'
            ? 'Cut from v2 · fixed fee still owed'
            : verdict === 'VERIFIED'
              ? normalise(contract.stageName) === normalise(contract.legalName)
                ? 'Credited under legal name · verified'
                : `“${contract.stageName}” verified as ${contract.legalName}`
              : settlement.reviewReason ?? 'Held for review',
      };
    }

    // No settlement row means the credit could not be pinned to this contract: the cue's name
    // matched more than one roster entry, so the reconciler held it rather than guess.
    const ambiguousCue = reconciled.creditCues.find(
      (cue) => cue.reconciliationStatus === 'NEEDS_REVIEW' && normalise(cue.creditedName) === normalise(contract.stageName),
    );
    const candidates = contractsByStageName.get(normalise(contract.stageName)) ?? 1;
    const presence: CutPresence = ambiguousCue ? { kind: 'unresolved', cueId: ambiguousCue.cueId } : { kind: 'absent' };
    return {
      contractId: contract.contractId,
      creditedAs: contract.stageName,
      legalName: contract.legalName,
      role: contract.role,
      feeCents: contract.contractAmountCents,
      roughCut: presence,
      directorsCut: presence,
      verdict: 'NEEDS_REVIEW',
      note: `“${contract.stageName}” matches ${candidates} contracts · held, not paid`,
    };
  });

  const roll: RollCredit[] = reconciled.creditCues.map((cue) => {
    const settlement = settlementByPerson.get(cue.personId);
    const tone: RollCredit['tone'] =
      cue.reconciliationStatus === 'NEEDS_REVIEW'
        ? 'hold'
        : cue.appearsInCutV1 && !cue.appearsInCutV2
          ? 'ghost'
          : 'credited';
    return {
      cueId: cue.cueId,
      role: tone === 'hold' ? 'Additional unit · name collision' : cue.role,
      name: cue.creditedName,
      amountCents: settlement?.contractAmountCents ?? 0,
      tone,
    };
  });

  const heldAliases = [...new Set(proposal.blockedItems.map((row) => row.stageName))];

  return {
    projectId: reconciled.projectId,
    projectTitle: reconciled.projectTitle,
    revision: reconciled.revision,
    rows,
    roll,
    executableCents: proposal.totalExecutableCents,
    executableCount: proposal.executableItems.length,
    ghostCents: proposal.ghostCutObligationCents,
    ghostNames: roll.filter((credit) => credit.tone === 'ghost').map((credit) => credit.name),
    heldAliases,
    heldCandidateCount: rows.filter((row) => row.verdict === 'NEEDS_REVIEW').length,
    proposalHash: proposal.proposalVersionHash,
    senderBatchId: proposal.senderBatchId,
  };
}
