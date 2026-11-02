# 01 — CreditRoll Reconciler, Guardrails & Studio Relational Data

**What to build:** End-to-end reconciliation and deterministic financial guardrail engine for film/game end-credits (`Cut v1` rough cut vs `Cut v2` director's cut, cue sheet manifest, and approved contract roster), wired into the AG Studio relational data source definition (`crewMembers`, `creditCues`, and `crewSettlements`).

**Blocked by:** None — can start immediately

**Status:** `done`

**Needs:** None — a worker can check every item unaided

**Validation method:** Automated unit and integration tests via `node --test` against the public reconciliation/guardrail API and `buildStudioData()` output

**Evidence required:** Passing test runner receipt showing `GHOST_CUT` obligation preservation, `NEEDS_REVIEW` blocking on ambiguous aliases, integer-cent sum enforcement, deterministic idempotency keys, and relational table presence in `buildStudioData()`

**Tests:** `required`

**Test seam:** Public reconciliation and guardrail engine functions (`reconcileCreditRoll`, `buildSettlementProposal`, `validateSettlementApproval`) and `buildStudioData()` relational data sources

**Regression scope:** Existing dashboard data tables (`customers`, `invoices`, `invoiceItems`, `invoicePayments`, `products`, `plans`, `transactions`, `payouts`, `balances`) and their relationships in `buildStudioData()` remain intact

- [x] Contributors present in Cut v1 with an approved fixed-fee contract whose scene cue is removed in Cut v2 are classified as `GHOST_CUT` and retain 100% of their approved contract payout obligation — Source: Story 2
- [x] Stage names with exact verified cue-sheet and contract aliases (such as `DJ Owl` and `Moth`) resolve to their verified `personId`, while homonymous or unverified aliases are classified as `NEEDS_REVIEW` and excluded from executable payout items — Source: Story 3
- [x] Monetary amounts are calculated strictly in integer cents from the locked contract table; if AI-supplied candidate mappings include altered or hallucinated fee values, the engine discards those numbers and uses the contract table rate — Source: Story 6 — Failure: F2
- [x] Re-running reconciliation or proposal generation on the same versioned inputs produces the exact same canonical `proposalVersionHash`, `senderBatchId`, and `PayPal-Request-Id` without duplicating settlement rows — Source: Story 6 — Failure: F1
- [x] Malformed, empty, or missing optional fields in credit cue inputs degrade gracefully to `NEEDS_REVIEW` without throwing unhandled exceptions — Source: Story 3 — Failure: F6
- [x] `buildStudioData()` exposes `crewMembers`, `creditCues`, and `crewSettlements` sources with valid `many-to-one` relationships on `personId` while preserving all existing PayPal data sources — Source: Story 4

## Verification Log

- **2026-11-02 Batch Kickoff**: Approved execution mode = `Subagent-Driven` (`1b`), testing mode = `tdd` (`2a`), PayPal Sandbox setup = `LCU browser + deterministic fallback seam` (`3a`); verbatim user choice: `"1b, 2a, 3a"`; covered tickets: `01`, `02`, `03`; `feature_base_sha`: `5de114eb4306e844396022f9ca0558a4937761e2`.
- **2026-11-02 Ticket 01 Completed**: Worker `af90ce248edc6151b` delivered patch `ticket-01.patch` against `dispatch_base_sha=ddad6e05ab729ee5c56497aaf3378254cddfe936`. Verified RED (`fail 6`) → GREEN (`pass 6, fail 0` in `tests/ticket-01-reconciler-and-studio-data.test.ts`), `npx tsc --noEmit` 0 errors, `npm run lint` 0 errors. `ticket-yagni` hook reported runner error (`no registered absolute ticket path for this worker`), recorded per `implement` Step 2 without retry.

