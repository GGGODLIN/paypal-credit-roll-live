export type CutVersion = 'v1' | 'v2';

export type ContractStatus = 'APPROVED' | 'PENDING' | 'DISPUTED' | 'NEEDS_REVIEW';

export type CutStatus = 'CREDITED' | 'GHOST_CUT' | 'ALIAS_AMBIGUOUS';

export type ReconciliationStatus = 'VERIFIED' | 'GHOST_CUT' | 'NEEDS_REVIEW';

export type SettlementBadgeStatus =
  | 'PAID'
  | 'PENDING'
  | 'UNPAID_GHOST'
  | 'NEEDS_REVIEW'
  | 'FAILED'
  | 'UNCLAIMED'
  | 'READY';

export type SettlementTransactionStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'UNCLAIMED'
  | 'FAILED'
  | 'UNPAID'
  | 'NEEDS_REVIEW';

export type CrewContractInput = {
  personId: string;
  legalName: string;
  stageName: string;
  verifiedAliases?: string[];
  role: string;
  department: string;
  contractId: string;
  contractStatus: ContractStatus;
  contractAmountCents: number;
  receiverEmail: string | null;
  whitelistedSandboxReceiver?: boolean;
};

export type CreditCueInput = {
  cueId?: string | null;
  creditedName?: string | null;
  stageName?: string | null;
  role?: string | null;
  department?: string | null;
  sceneTimestamp?: string | null;
  cueDescription?: string | null;
  appearsInCutV1?: boolean | null;
  appearsInCutV2?: boolean | null;
  verifiedPersonId?: string | null;
};

export type AiCandidateMappingInput = {
  cueId?: string | null;
  creditedName?: string | null;
  proposedPersonId?: string | null;
  proposedAmountCents?: number | null;
  proposedAmountUsd?: number | null;
  confidence?: number | null;
  evidenceCite?: string | null;
};

export type CreditRollScenarioInput = {
  projectId?: string;
  projectTitle?: string;
  cutVersion?: CutVersion;
  revision?: number;
  contracts: CrewContractInput[];
  cues: CreditCueInput[];
  aiCandidateMappings?: AiCandidateMappingInput[];
};

export type CrewMemberRow = {
  id: string;
  personId: string;
  legalName: string;
  stageName: string;
  role: string;
  department: string;
  contractId: string;
  contractStatus: ContractStatus;
  contractAmountCents: number;
  contractAmountUsd: number;
  receiverEmail: string | null;
  whitelistedSandboxReceiver: boolean;
};

export type CreditCueRow = {
  id: string;
  cueId: string;
  personId: string;
  creditedName: string;
  role: string;
  department: string;
  appearsInCutV1: boolean;
  appearsInCutV2: boolean;
  sceneTimestamp: string;
  cueDescription: string;
  reconciliationStatus: ReconciliationStatus;
  reviewReason: string | null;
};

export type CrewSettlementRow = {
  id: string;
  settlementId: string;
  personId: string;
  legalName: string;
  stageName: string;
  role: string;
  department: string;
  contractId: string;
  contractAmountCents: number;
  contractAmountUsd: number;
  cutStatus: CutStatus;
  reconciliationStatus: ReconciliationStatus;
  badgeStatus: SettlementBadgeStatus;
  eligibleForPayout: boolean;
  obligationRetained: boolean;
  discardedAiAmountOverride: boolean;
  receiverEmail: string | null;
  paypalPayoutBatchId: string | null;
  paypalPayoutItemId: string | null;
  paypalOrderId: string | null;
  paypalInvoiceId: string | null;
  transactionStatus: SettlementTransactionStatus;
  evidenceSummary: string;
  reviewReason: string | null;
};

export type DiscardedAiOverride = {
  personId: string;
  cueId: string;
  ignoredAiAmountCents: number;
  lockedContractAmountCents: number;
};

export type ReconciledCreditRollResult = {
  projectId: string;
  projectTitle: string;
  cutVersion: CutVersion;
  revision: number;
  crewMembers: CrewMemberRow[];
  creditCues: CreditCueRow[];
  crewSettlements: CrewSettlementRow[];
  discardedAiAmountOverrides: DiscardedAiOverride[];
};

export type ExecutablePayoutItem = {
  settlementId: string;
  personId: string;
  legalName: string;
  stageName: string;
  contractId: string;
  receiverEmail: string;
  amountCents: number;
  amountUsd: number;
  currency: 'USD';
  cutStatus: 'CREDITED' | 'GHOST_CUT';
  senderItemId: string;
  note: string;
};

export type SettlementProposal = {
  projectId: string;
  cutVersion: CutVersion;
  revision: number;
  proposalVersionHash: string;
  proposalVersionKey: string;
  senderBatchId: string;
  paypalRequestId: string;
  executableItems: ExecutablePayoutItem[];
  blockedItems: CrewSettlementRow[];
  totalExecutableCents: number;
  totalExecutableUsd: number;
  ghostCutObligationCents: number;
  creditedObligationCents: number;
  discardedAiOverrideCount: number;
};

export type SettlementApprovalRequest = {
  approvalToken?: string | null;
  approvedBy?: string | null;
  expectedProposalVersionHash?: string | null;
  requestedPersonIds?: string[];
  overrideAmountsCents?: Record<string, number>;
};

export type SettlementApprovalInput = SettlementApprovalRequest & {
  proposal: SettlementProposal;
};

export type SettlementApprovalValidation = {
  valid: boolean;
  statusCode: 200 | 400;
  errors: string[];
  proposalVersionHash: string;
  senderBatchId: string;
  paypalRequestId: string;
  approvedItems: ExecutablePayoutItem[];
  totalAmountCents: number;
};

const centsToUsd = (cents: number): number => Math.round(cents) / 100;

const nonEmpty = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normaliseToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const sanitizeIdSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();

export const DEFAULT_CREDIT_ROLL_SCENARIO: CreditRollScenarioInput = {
  projectId: 'NEON-NOCTURNE-2026',
  projectTitle: 'Neon Nocturne: Director Cut',
  cutVersion: 'v2',
  revision: 1,
  contracts: [
    {
      personId: 'crew-dj-owl',
      legalName: 'Aria Chen',
      stageName: 'DJ Owl',
      verifiedAliases: ['DJ Owl', 'Aria "DJ Owl" Chen', 'Aria Chen'],
      role: 'Lead Synth & Cue Composer',
      department: 'Audio & Score',
      contractId: 'CTR-2026-101',
      contractStatus: 'APPROVED',
      contractAmountCents: 185000,
      receiverEmail: 'aria.djowl.sandbox@creditroll.dev',
      whitelistedSandboxReceiver: true,
    },
    {
      personId: 'crew-moth',
      legalName: 'Marcus Vance',
      stageName: 'Moth',
      verifiedAliases: ['Moth', 'Marcus "Moth" Vance', 'Marcus Vance'],
      role: 'Foley & Creature Sound Designer',
      department: 'Sound Design',
      contractId: 'CTR-2026-102',
      contractStatus: 'APPROVED',
      contractAmountCents: 140000,
      receiverEmail: 'marcus.moth.sandbox@creditroll.dev',
      whitelistedSandboxReceiver: true,
    },
    {
      personId: 'crew-elena-rostova',
      legalName: 'Elena Rostova',
      stageName: 'Nyx Frame',
      verifiedAliases: ['Nyx Frame', 'Elena Rostova'],
      role: 'VFX Compositor — Subway Collapse',
      department: 'Visual Effects',
      contractId: 'CTR-2026-103',
      contractStatus: 'APPROVED',
      contractAmountCents: 220000,
      receiverEmail: 'elena.nyx.sandbox@creditroll.dev',
      whitelistedSandboxReceiver: true,
    },
    {
      personId: 'crew-hana-sato',
      legalName: 'Hana Sato',
      stageName: 'Hana Sato',
      verifiedAliases: ['Hana Sato', 'H. Sato'],
      role: 'DI Colorist & Finishing Artist',
      department: 'Color & Finishing',
      contractId: 'CTR-2026-104',
      contractStatus: 'APPROVED',
      contractAmountCents: 160000,
      receiverEmail: 'hana.sato.sandbox@creditroll.dev',
      whitelistedSandboxReceiver: true,
    },
    {
      personId: 'crew-alex-rivera-sound',
      legalName: 'Alexander Rivera',
      stageName: 'Alex Rivera',
      verifiedAliases: ['Alex Rivera'],
      role: 'Dialogue Editor (Unit A)',
      department: 'Audio Post',
      contractId: 'CTR-2026-201',
      contractStatus: 'APPROVED',
      contractAmountCents: 95000,
      receiverEmail: 'alex.rivera.a.sandbox@creditroll.dev',
      whitelistedSandboxReceiver: true,
    },
    {
      personId: 'crew-alex-rivera-lighting',
      legalName: 'Alexis Rivera',
      stageName: 'Alex Rivera',
      verifiedAliases: ['Alex Rivera'],
      role: 'Key Rigging Gaffer (Unit B)',
      department: 'Lighting & Grip',
      contractId: 'CTR-2026-202',
      contractStatus: 'APPROVED',
      contractAmountCents: 95000,
      receiverEmail: 'alex.rivera.b.sandbox@creditroll.dev',
      whitelistedSandboxReceiver: true,
    },
  ],
  cues: [
    {
      cueId: 'CUE-01',
      creditedName: 'DJ Owl',
      role: 'Lead Synth & Cue Composer',
      department: 'Audio & Score',
      sceneTimestamp: '00:04:12',
      cueDescription: 'Opening Rain Neon Chase — Modular Analog Score',
      appearsInCutV1: true,
      appearsInCutV2: true,
      verifiedPersonId: 'crew-dj-owl',
    },
    {
      cueId: 'CUE-02',
      creditedName: 'Moth',
      role: 'Foley & Creature Sound Designer',
      department: 'Sound Design',
      sceneTimestamp: '00:19:44',
      cueDescription: 'Abandoned Hangar Echoes (Trimmed in Director Cut v2)',
      appearsInCutV1: true,
      appearsInCutV2: false,
      verifiedPersonId: 'crew-moth',
    },
    {
      cueId: 'CUE-03',
      creditedName: 'Nyx Frame',
      role: 'VFX Compositor — Subway Collapse',
      department: 'Visual Effects',
      sceneTimestamp: '00:31:08',
      cueDescription: 'Subway Tunnel Hologram Shatter Sequence (Cut in v2)',
      appearsInCutV1: true,
      appearsInCutV2: false,
      verifiedPersonId: 'crew-elena-rostova',
    },
    {
      cueId: 'CUE-04',
      creditedName: 'Hana Sato',
      role: 'DI Colorist & Finishing Artist',
      department: 'Color & Finishing',
      sceneTimestamp: '00:48:00',
      cueDescription: 'Final Rooftop Sunrise HDR Grade & End Credits Master',
      appearsInCutV1: true,
      appearsInCutV2: true,
      verifiedPersonId: 'crew-hana-sato',
    },
    {
      cueId: 'CUE-05',
      creditedName: 'Alex Rivera',
      role: 'Additional Unit Contributor',
      department: 'Production Unit',
      sceneTimestamp: '00:52:15',
      cueDescription: 'End Roll Shared Credit — Homonymous Name Collision',
      appearsInCutV1: true,
      appearsInCutV2: true,
    },
  ],
  aiCandidateMappings: [
    {
      cueId: 'CUE-01',
      creditedName: 'DJ Owl',
      proposedPersonId: 'crew-dj-owl',
      proposedAmountCents: 185000,
      confidence: 0.99,
      evidenceCite: 'Cue Sheet CUE-01 + Contract CTR-2026-101 alias "DJ Owl"',
    },
    {
      cueId: 'CUE-02',
      creditedName: 'Moth',
      proposedPersonId: 'crew-moth',
      proposedAmountCents: 140000,
      confidence: 0.98,
      evidenceCite: 'Cue Sheet CUE-02 + Contract CTR-2026-102 alias "Moth" (Cut v1 scene trimmed in v2)',
    },
    {
      cueId: 'CUE-03',
      creditedName: 'Nyx Frame',
      proposedPersonId: 'crew-elena-rostova',
      proposedAmountCents: 220000,
      confidence: 0.97,
      evidenceCite: 'Cue Sheet CUE-03 + Contract CTR-2026-103 alias "Nyx Frame" (Cut v1 VFX trimmed in v2)',
    },
    {
      cueId: 'CUE-04',
      creditedName: 'Hana Sato',
      proposedPersonId: 'crew-hana-sato',
      proposedAmountCents: 160000,
      confidence: 0.99,
      evidenceCite: 'Cue Sheet CUE-04 + Contract CTR-2026-104 legal name match',
    },
  ],
};

function isReconciledResult(
  input: CreditRollScenarioInput | ReconciledCreditRollResult,
): input is ReconciledCreditRollResult {
  return 'crewSettlements' in input && Array.isArray(input.crewSettlements);
}

function matchContractsForCue(
  cue: CreditCueInput,
  contractsByPersonId: Map<string, CrewContractInput>,
  contractsByAlias: Map<string, CrewContractInput[]>,
): { matched: CrewContractInput | null; reviewReason: string | null } {
  const rawName = (cue.creditedName ?? cue.stageName ?? '').trim();
  if (!rawName) {
    return {
      matched: null,
      reviewReason: 'Missing or blank creditedName on credit cue entry.',
    };
  }

  const aliasMatches = contractsByAlias.get(normaliseToken(rawName)) ?? [];
  if (aliasMatches.length > 1) {
    const candidateIds = aliasMatches
      .map((c) => c.personId)
      .sort()
      .join(', ');
    return {
      matched: null,
      reviewReason: `Homonymous alias "${rawName}" matches multiple contracts (${candidateIds}); human disambiguation required.`,
    };
  }

  if (cue.verifiedPersonId) {
    const explicit = contractsByPersonId.get(cue.verifiedPersonId.trim());
    if (!explicit) {
      return {
        matched: null,
        reviewReason: `Cue references unverified personId "${cue.verifiedPersonId}".`,
      };
    }
    if (aliasMatches.length === 1 && aliasMatches[0]?.personId !== explicit.personId) {
      return {
        matched: null,
        reviewReason: `Cue stage name "${rawName}" conflicts with verifiedPersonId "${cue.verifiedPersonId}".`,
      };
    }
    return { matched: explicit, reviewReason: null };
  }

  if (aliasMatches.length === 1) {
    return { matched: aliasMatches[0] ?? null, reviewReason: null };
  }

  return {
    matched: null,
    reviewReason: `Stage name "${rawName}" has no verified contract alias match.`,
  };
}

export function reconcileCreditRoll(
  input: CreditRollScenarioInput = DEFAULT_CREDIT_ROLL_SCENARIO,
): ReconciledCreditRollResult {
  const projectId = (input?.projectId ?? DEFAULT_CREDIT_ROLL_SCENARIO.projectId ?? 'CRLIVE-PROJECT').trim();
  const projectTitle = (
    input?.projectTitle ??
    DEFAULT_CREDIT_ROLL_SCENARIO.projectTitle ??
    'CreditRoll Live Production'
  ).trim();
  const cutVersion: CutVersion = input?.cutVersion ?? 'v2';
  const revision = Number.isSafeInteger(input?.revision) && (input?.revision ?? 0) > 0 ? (input.revision as number) : 1;

  const rawContracts = Array.isArray(input?.contracts) ? input.contracts : [];
  const sortedContracts = [...rawContracts]
    .filter((c): c is CrewContractInput => Boolean(c && typeof c.personId === 'string' && c.personId.trim()))
    .sort((a, b) => a.personId.localeCompare(b.personId));

  const contractsByPersonId = new Map<string, CrewContractInput>();
  const contractsByAlias = new Map<string, CrewContractInput[]>();

  for (const contract of sortedContracts) {
    if (contractsByPersonId.has(contract.personId)) continue;
    contractsByPersonId.set(contract.personId, contract);

    const candidateNames = new Set<string>([
      normaliseToken(contract.legalName ?? ''),
      normaliseToken(contract.stageName ?? ''),
      ...(contract.verifiedAliases ?? []).map((alias) => normaliseToken(alias ?? '')),
    ]);
    for (const token of candidateNames) {
      if (!token) continue;
      const existing = contractsByAlias.get(token) ?? [];
      existing.push(contract);
      contractsByAlias.set(token, existing);
    }
  }

  const aiMappings = Array.isArray(input?.aiCandidateMappings) ? input.aiCandidateMappings : [];

  const crewMembersById = new Map<string, CrewMemberRow>();
  for (const contract of contractsByPersonId.values()) {
    const lockedCents =
      Number.isFinite(contract.contractAmountCents) && contract.contractAmountCents >= 0
        ? Math.round(contract.contractAmountCents)
        : 0;
    crewMembersById.set(contract.personId, {
      id: contract.personId,
      personId: contract.personId,
      legalName: contract.legalName,
      stageName: contract.stageName,
      role: contract.role,
      department: contract.department,
      contractId: contract.contractId,
      contractStatus: contract.contractStatus,
      contractAmountCents: lockedCents,
      contractAmountUsd: centsToUsd(lockedCents),
      receiverEmail: contract.receiverEmail ?? null,
      whitelistedSandboxReceiver: Boolean(
        contract.whitelistedSandboxReceiver ?? (contract.receiverEmail && contract.receiverEmail.includes('@')),
      ),
    });
  }

  const rawCues = Array.isArray(input?.cues) ? input.cues : [];
  const normalizedCueEntries: { cue: CreditCueInput; fallbackIndex: number }[] = rawCues.map((entry, idx) => ({
    cue: entry && typeof entry === 'object' ? entry : {},
    fallbackIndex: idx + 1,
  }));

  const creditCues: CreditCueRow[] = [];
  const seenCueKeys = new Set<string>();
  const discardedAiAmountOverrides: DiscardedAiOverride[] = [];
  const discardedOverridePersonIds = new Set<string>();

  type AggregatedPersonCues = {
    contract: CrewContractInput;
    appearsInCutV1: boolean;
    appearsInCutV2: boolean;
    cueIds: string[];
  };
  const cuesByPersonId = new Map<string, AggregatedPersonCues>();
  const unresolvedSettlements = new Map<string, CrewSettlementRow>();

  let malformedCounter = 0;

  for (const { cue, fallbackIndex } of normalizedCueEntries) {
    const rawCueId = nonEmpty(cue.cueId);
    const rawCreditedName = nonEmpty(cue.creditedName ?? cue.stageName);
    const appearsInCutV1 = Boolean(cue.appearsInCutV1 ?? true);
    const appearsInCutV2 = Boolean(cue.appearsInCutV2 ?? false);
    const sceneTimestamp = nonEmpty(cue.sceneTimestamp) ?? '00:00:00';
    const cueDescription = nonEmpty(cue.cueDescription) ?? 'Unindexed credit cue entry';
    const role = nonEmpty(cue.role) ?? 'Unassigned Role';
    const department = nonEmpty(cue.department) ?? 'Unassigned Department';

    const { matched, reviewReason } = matchContractsForCue(
      cue,
      contractsByPersonId,
      contractsByAlias,
    );

    if (!matched) {
      malformedCounter += 1;
      const slug = nonEmpty(
        sanitizeIdSegment(rawCreditedName ?? rawCueId ?? `MALFORMED-${malformedCounter}`).toLowerCase(),
      );
      const reviewPersonId = `unverified-${slug ?? malformedCounter}`;
      const cueId = rawCueId ?? `CUE-REVIEW-${malformedCounter}`;
      const dedupeKey = `${cueId}::${reviewPersonId}`;
      if (seenCueKeys.has(dedupeKey)) continue;
      seenCueKeys.add(dedupeKey);

      if (!crewMembersById.has(reviewPersonId)) {
        crewMembersById.set(reviewPersonId, {
          id: reviewPersonId,
          personId: reviewPersonId,
          legalName: 'Unverified / Ambiguous Alias',
          stageName: rawCreditedName ?? `Malformed Cue #${fallbackIndex}`,
          role,
          department,
          contractId: 'UNBOUND-CONTRACT',
          contractStatus: 'NEEDS_REVIEW',
          contractAmountCents: 0,
          contractAmountUsd: 0,
          receiverEmail: null,
          whitelistedSandboxReceiver: false,
        });
      }

      creditCues.push({
        id: cueId,
        cueId,
        personId: reviewPersonId,
        creditedName: rawCreditedName ?? '(Empty Credit Entry)',
        role,
        department,
        appearsInCutV1,
        appearsInCutV2,
        sceneTimestamp,
        cueDescription,
        reconciliationStatus: 'NEEDS_REVIEW',
        reviewReason: reviewReason ?? 'Requires human review before settlement.',
      });

      if (!unresolvedSettlements.has(reviewPersonId)) {
        unresolvedSettlements.set(reviewPersonId, {
          id: `SET-${reviewPersonId}`,
          settlementId: `SET-${reviewPersonId}`,
          personId: reviewPersonId,
          legalName: 'Unverified / Ambiguous Alias',
          stageName: rawCreditedName ?? `Malformed Cue #${fallbackIndex}`,
          role,
          department,
          contractId: 'UNBOUND-CONTRACT',
          contractAmountCents: 0,
          contractAmountUsd: 0,
          cutStatus: 'ALIAS_AMBIGUOUS',
          reconciliationStatus: 'NEEDS_REVIEW',
          badgeStatus: 'NEEDS_REVIEW',
          eligibleForPayout: false,
          obligationRetained: false,
          discardedAiAmountOverride: false,
          receiverEmail: null,
          paypalPayoutBatchId: null,
          paypalPayoutItemId: null,
          paypalOrderId: null,
          paypalInvoiceId: null,
          transactionStatus: 'NEEDS_REVIEW',
          evidenceSummary: reviewReason ?? 'Unverified alias blocked by deterministic guardrail.',
          reviewReason: reviewReason ?? 'Unverified alias blocked by deterministic guardrail.',
        });
      }
      continue;
    }

    const cueId = rawCueId ?? `CUE-${matched.personId.toUpperCase()}`;
    const dedupeKey = `${cueId}::${matched.personId}`;
    if (seenCueKeys.has(dedupeKey)) continue;
    seenCueKeys.add(dedupeKey);

    const lockedCents = Math.round(matched.contractAmountCents);
    for (const aiItem of aiMappings) {
      if (!aiItem || typeof aiItem !== 'object') continue;
      const matchesThisCue =
        (typeof aiItem.cueId === 'string' && aiItem.cueId.trim() === cueId) ||
        (typeof aiItem.proposedPersonId === 'string' && aiItem.proposedPersonId.trim() === matched.personId) ||
        (typeof aiItem.creditedName === 'string' &&
          rawCreditedName !== null &&
          normaliseToken(aiItem.creditedName) === normaliseToken(rawCreditedName));
      if (!matchesThisCue) continue;

      const aiCents =
        typeof aiItem.proposedAmountCents === 'number' && Number.isFinite(aiItem.proposedAmountCents)
          ? Math.round(aiItem.proposedAmountCents)
          : typeof aiItem.proposedAmountUsd === 'number' && Number.isFinite(aiItem.proposedAmountUsd)
            ? Math.round(aiItem.proposedAmountUsd * 100)
            : null;

      if (aiCents !== null && aiCents !== lockedCents) {
        discardedOverridePersonIds.add(matched.personId);
        const alreadyLogged = discardedAiAmountOverrides.some(
          (entry) => entry.personId === matched.personId && entry.cueId === cueId,
        );
        if (!alreadyLogged) {
          discardedAiAmountOverrides.push({
            personId: matched.personId,
            cueId,
            ignoredAiAmountCents: aiCents,
            lockedContractAmountCents: lockedCents,
          });
        }
      }
    }

    const cueReconciliationStatus: ReconciliationStatus =
      appearsInCutV1 && !appearsInCutV2 ? 'GHOST_CUT' : 'VERIFIED';

    creditCues.push({
      id: cueId,
      cueId,
      personId: matched.personId,
      creditedName: rawCreditedName ?? matched.stageName,
      role: nonEmpty(cue.role) ?? matched.role,
      department: nonEmpty(cue.department) ?? matched.department,
      appearsInCutV1,
      appearsInCutV2,
      sceneTimestamp,
      cueDescription,
      reconciliationStatus: cueReconciliationStatus,
      reviewReason: null,
    });

    const existingAgg = cuesByPersonId.get(matched.personId);
    if (existingAgg) {
      existingAgg.appearsInCutV1 = existingAgg.appearsInCutV1 || appearsInCutV1;
      existingAgg.appearsInCutV2 = existingAgg.appearsInCutV2 || appearsInCutV2;
      if (!existingAgg.cueIds.includes(cueId)) {
        existingAgg.cueIds.push(cueId);
      }
    } else {
      cuesByPersonId.set(matched.personId, {
        contract: matched,
        appearsInCutV1,
        appearsInCutV2,
        cueIds: [cueId],
      });
    }
  }

  creditCues.sort((a, b) => a.cueId.localeCompare(b.cueId) || a.personId.localeCompare(b.personId));

  const crewSettlements: CrewSettlementRow[] = [];

  const sortedPersonIds = [...cuesByPersonId.keys()].sort((a, b) => a.localeCompare(b));
  for (const personId of sortedPersonIds) {
    const agg = cuesByPersonId.get(personId);
    if (!agg) continue;
    const { contract, appearsInCutV1, appearsInCutV2, cueIds } = agg;
    const sortedCueIds = [...cueIds].sort();
    const lockedCents = Math.round(contract.contractAmountCents);
    const isGhostCut = appearsInCutV1 && !appearsInCutV2;
    const cutStatus: CutStatus = isGhostCut ? 'GHOST_CUT' : 'CREDITED';
    const isApproved = contract.contractStatus === 'APPROVED';
    const hasVerifiedReceiver = Boolean(
      contract.receiverEmail &&
        contract.receiverEmail.includes('@') &&
        (contract.whitelistedSandboxReceiver ?? true),
    );
    const eligibleForPayout = isApproved && hasVerifiedReceiver && lockedCents > 0;
    const reconciliationStatus: ReconciliationStatus = !eligibleForPayout
      ? 'NEEDS_REVIEW'
      : isGhostCut
        ? 'GHOST_CUT'
        : 'VERIFIED';
    const badgeStatus: SettlementBadgeStatus = !eligibleForPayout
      ? 'NEEDS_REVIEW'
      : isGhostCut
        ? 'UNPAID_GHOST'
        : 'READY';

    crewSettlements.push({
      id: `SET-${personId}`,
      settlementId: `SET-${personId}`,
      personId,
      legalName: contract.legalName,
      stageName: contract.stageName,
      role: contract.role,
      department: contract.department,
      contractId: contract.contractId,
      contractAmountCents: lockedCents,
      contractAmountUsd: centsToUsd(lockedCents),
      cutStatus,
      reconciliationStatus,
      badgeStatus,
      eligibleForPayout,
      obligationRetained: isApproved && (appearsInCutV1 || appearsInCutV2),
      discardedAiAmountOverride: discardedOverridePersonIds.has(personId),
      receiverEmail: contract.receiverEmail ?? null,
      paypalPayoutBatchId: null,
      paypalPayoutItemId: null,
      paypalOrderId: null,
      paypalInvoiceId: null,
      transactionStatus: eligibleForPayout ? 'UNPAID' : 'NEEDS_REVIEW',
      evidenceSummary: isGhostCut
        ? `Cut in v2 (${sortedCueIds.join(', ')}) · Fixed contract ${contract.contractId} obligation retained (100%).`
        : `Verified stage name "${contract.stageName}" -> ${contract.legalName} (${contract.contractId}, ${sortedCueIds.join(', ')}).`,
      reviewReason: eligibleForPayout
        ? null
        : 'Contract not approved or missing whitelisted PayPal Sandbox receiver email.',
    });
  }

  const sortedUnresolvedIds = [...unresolvedSettlements.keys()].sort((a, b) => a.localeCompare(b));
  for (const unresolvedId of sortedUnresolvedIds) {
    const row = unresolvedSettlements.get(unresolvedId);
    if (row) crewSettlements.push(row);
  }

  discardedAiAmountOverrides.sort(
    (a, b) => a.personId.localeCompare(b.personId) || a.cueId.localeCompare(b.cueId),
  );

  const crewMembers = [...crewMembersById.values()].sort((a, b) =>
    a.personId.localeCompare(b.personId),
  );

  return {
    projectId,
    projectTitle,
    cutVersion,
    revision,
    crewMembers,
    creditCues,
    crewSettlements,
    discardedAiAmountOverrides,
  };
}

export function buildSettlementProposal(
  inputOrReconciled: CreditRollScenarioInput | ReconciledCreditRollResult = DEFAULT_CREDIT_ROLL_SCENARIO,
): SettlementProposal {
  const reconciled = isReconciledResult(inputOrReconciled)
    ? inputOrReconciled
    : reconcileCreditRoll(inputOrReconciled);

  const executableItems: ExecutablePayoutItem[] = [];
  const blockedItems: CrewSettlementRow[] = [];

  let totalExecutableCents = 0;
  let ghostCutObligationCents = 0;
  let creditedObligationCents = 0;

  const sortedSettlements = [...reconciled.crewSettlements].sort((a, b) =>
    a.personId.localeCompare(b.personId),
  );

  for (const row of sortedSettlements) {
    if (
      row.eligibleForPayout &&
      row.reconciliationStatus !== 'NEEDS_REVIEW' &&
      row.cutStatus !== 'ALIAS_AMBIGUOUS' &&
      row.receiverEmail &&
      Number.isSafeInteger(row.contractAmountCents) &&
      row.contractAmountCents > 0
    ) {
      const itemCutStatus: 'CREDITED' | 'GHOST_CUT' =
        row.cutStatus === 'GHOST_CUT' ? 'GHOST_CUT' : 'CREDITED';
      executableItems.push({
        settlementId: row.settlementId,
        personId: row.personId,
        legalName: row.legalName,
        stageName: row.stageName,
        contractId: row.contractId,
        receiverEmail: row.receiverEmail,
        amountCents: row.contractAmountCents,
        amountUsd: centsToUsd(row.contractAmountCents),
        currency: 'USD',
        cutStatus: itemCutStatus,
        senderItemId: `${sanitizeIdSegment(row.contractId)}-${sanitizeIdSegment(row.personId)}`,
        note:
          itemCutStatus === 'GHOST_CUT'
            ? `CreditRoll Live Ghost-Cut Settlement (${row.contractId}) for ${row.stageName}`
            : `CreditRoll Live Crew Settlement (${row.contractId}) for ${row.stageName}`,
      });
      totalExecutableCents += row.contractAmountCents;
      if (itemCutStatus === 'GHOST_CUT') {
        ghostCutObligationCents += row.contractAmountCents;
      } else {
        creditedObligationCents += row.contractAmountCents;
      }
    } else {
      blockedItems.push(row);
    }
  }

  const projectSlug = sanitizeIdSegment(nonEmpty(reconciled.projectId) ?? 'CRLIVE');
  const cutSlug = sanitizeIdSegment(nonEmpty(reconciled.cutVersion) ?? 'V2');
  const rosterDescriptor =
    nonEmpty(
      executableItems
        .map((item) => `${sanitizeIdSegment(item.personId)}:${item.amountCents}`)
        .join('_'),
    ) ?? 'EMPTY';

  const proposalVersionHash = `CRLIVE-${projectSlug}-${cutSlug}-REV${reconciled.revision}-${rosterDescriptor}-TOTAL${totalExecutableCents}`;
  const senderBatchId = `BATCH-${projectSlug}-${cutSlug}-R${reconciled.revision}-${executableItems.length}I-${totalExecutableCents}`;
  const paypalRequestId = `PPREQ-${projectSlug}-${cutSlug}-R${reconciled.revision}-${executableItems.length}I-${totalExecutableCents}`;

  return {
    projectId: reconciled.projectId,
    cutVersion: reconciled.cutVersion,
    revision: reconciled.revision,
    proposalVersionHash,
    proposalVersionKey: proposalVersionHash,
    senderBatchId,
    paypalRequestId,
    executableItems,
    blockedItems,
    totalExecutableCents,
    totalExecutableUsd: centsToUsd(totalExecutableCents),
    ghostCutObligationCents,
    creditedObligationCents,
    discardedAiOverrideCount: reconciled.discardedAiAmountOverrides.length,
  };
}

export function createHumanApprovalToken(
  proposalVersionHash: string,
  approvedBy = 'producer-patchbay',
): string {
  return `APPROVAL::${proposalVersionHash}::${sanitizeIdSegment(approvedBy)}`;
}

export function validateSettlementApproval(
  proposalOrInput: SettlementProposal | SettlementApprovalInput,
  maybeRequest?: SettlementApprovalRequest,
): SettlementApprovalValidation {
  const proposal = 'proposal' in proposalOrInput ? proposalOrInput.proposal : proposalOrInput;
  const request: SettlementApprovalRequest =
    'proposal' in proposalOrInput ? proposalOrInput : (maybeRequest ?? {});

  const errors: string[] = [];
  const token = (request.approvalToken ?? '').trim();

  if (!token) {
    errors.push('MISSING_HUMAN_APPROVAL_TOKEN');
  } else if (!token.includes(proposal.proposalVersionHash)) {
    errors.push('APPROVAL_TOKEN_HASH_MISMATCH');
  }

  if (
    request.expectedProposalVersionHash !== undefined &&
    request.expectedProposalVersionHash !== null &&
    request.expectedProposalVersionHash !== proposal.proposalVersionHash
  ) {
    errors.push('STALE_PROPOSAL_VERSION_HASH');
  }

  const executableByPersonId = new Map<string, ExecutablePayoutItem>(
    proposal.executableItems.map((item) => [item.personId, item]),
  );
  const blockedIds = new Set<string>(proposal.blockedItems.map((b) => b.personId));

  const targetPersonIds =
    request.requestedPersonIds && request.requestedPersonIds.length > 0
      ? request.requestedPersonIds
      : proposal.executableItems.map((item) => item.personId);

  if (targetPersonIds.length === 0) {
    errors.push('EMPTY_EXECUTABLE_SETTLEMENT');
  }

  const approvedItems: ExecutablePayoutItem[] = [];
  for (const personId of targetPersonIds) {
    if (blockedIds.has(personId)) {
      errors.push('NEEDS_REVIEW_RECIPIENT_BLOCKED');
      continue;
    }
    const executable = executableByPersonId.get(personId);
    if (!executable) {
      errors.push('UNVERIFIED_RECIPIENT_BLOCKED');
      continue;
    }
    if (request.overrideAmountsCents && personId in request.overrideAmountsCents) {
      const requestedCents = request.overrideAmountsCents[personId];
      if (
        typeof requestedCents !== 'number' ||
        !Number.isSafeInteger(requestedCents) ||
        requestedCents !== executable.amountCents
      ) {
        errors.push('CONTRACT_AMOUNT_MISMATCH');
        continue;
      }
    }
    approvedItems.push(executable);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      statusCode: 400,
      errors: [...new Set(errors)],
      proposalVersionHash: proposal.proposalVersionHash,
      senderBatchId: proposal.senderBatchId,
      paypalRequestId: proposal.paypalRequestId,
      approvedItems: [],
      totalAmountCents: 0,
    };
  }

  const totalAmountCents = approvedItems.reduce((sum, item) => sum + item.amountCents, 0);

  return {
    valid: true,
    statusCode: 200,
    errors: [],
    proposalVersionHash: proposal.proposalVersionHash,
    senderBatchId: proposal.senderBatchId,
    paypalRequestId: proposal.paypalRequestId,
    approvedItems,
    totalAmountCents,
  };
}
