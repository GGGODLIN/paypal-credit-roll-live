# 03 — AG Studio Interactive Credit Roll Widgets & Agent Collaboration

**What to build:** Two native AG Studio Custom Widgets (`Interactive Credit Roll Stage` and `Ghost Diff & Identity Patchbay`) registered with `formatShape` and `ai` metadata, paired with a dedicated `CreditRoll Live` page in the default AG Studio report and domain-aware AI prompt starters/context so clicking any contributor or ghost credit cross-filters the companion AG Grid and drives real PayPal Sandbox actions.

**Blocked by:** 01 — CreditRoll Reconciler, Guardrails & Studio Relational Data, 02 — PayPal Sandbox Write & Read-Back Settlement Loop

**Status:** `done`

**Needs:** Local Next.js dev server and headless/live browser for UI and E2E verification

**Validation method:** Automated widget/state tests, `npm run build`, `npx -y react-doctor@latest . --offline --verbose --diff`, and browser verification of cross-filtering and PayPal Sandbox action execution

**Evidence required:** Zero build/lint errors, non-regressing `react-doctor` score, passing test suite, and live browser snapshot/screenshots showing the rolling credit roll, v1/v2 ghost credit highlight, AG Grid cross-filtering by `personId`, and real PayPal Sandbox settlement receipts

**Tests:** `required`

**Test seam:** Registered AG Studio custom widget definitions, default report state (`credit-roll` page), and interactive dashboard UI components

**Regression scope:** Existing dashboard pages (`revenue`, `receivables`, `cash`, `catalogue`), report switching, and localStorage persistence continue to render and function without errors

- [x] Both `credit-roll-stage` and `ghost-patchbay` custom widgets are registered via AG Studio's widget registration API with complete `formatShape` and `ai` metadata and appear on the `credit-roll` studio report page alongside relational AG Grid / KPI widgets — Source: Story 4, Story 8
- [x] Toggling between Cut v1 (Rough Cut) and Cut v2 (Director's Cut) in the Credit Roll Stage widget highlights cut contributors as translucent `UNPAID_GHOST` nodes ("Removed from Cut v2 · Contract Fee Still Owed") and clears any stale action error banner from the previous view — Source: Story 2 — Failure: F1
- [x] Clicking any contributor chip or ghost credit dispatches `toggleCrossFilter` for that contributor's `personId` (and clicking again clears the filter), synchronizing the AG Grid rows to that contributor's cues, contract, and PayPal receipts — Source: Story 4
- [x] In-flight PayPal Sandbox actions (BTS Order, Invoice + QR Code, Batch Payouts) disable duplicate submission buttons, display live progress, and upon completion render the read-back PayPal IDs, QR code, and per-item statuses (`SUCCESS`, `PENDING`, `UNCLAIMED`, `FAILED`) directly in the widget and grid — Source: Story 5, Story 7 — Failure: F1, F2
- [x] AG Studio AI prompt starters and assistant configuration allow users to query ghosted crew members and stage-name mappings while keeping all PayPal write mutations gated behind explicit user approval in the Patchbay widget — Source: Story 8 — Failure: F5

## Verification Log

- **2026-11-02 Ticket 03 Completed**: Worker `a0a9458330d31d553` delivered `ticket-03.patch` (`44,067` bytes) against `dispatch_base_sha=84bd77337ae20efa86ec5235191e842e6c49b4b3`. Verified RED → GREEN (`pass 17, fail 0` across all 3 test files), `npx next typegen && npx tsc --noEmit && npm run lint && npm run build` 0 errors, and `react-doctor` `100 / 100 Great` (0 errors, 0 warnings).

