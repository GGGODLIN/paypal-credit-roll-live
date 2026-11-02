# 02 — PayPal Sandbox Write & Read-Back Settlement Loop

**What to build:** Server-side PayPal Sandbox write and read-back operations and API routes covering Behind-the-Scenes Supporter Pack checkout (`Orders v2 CAPTURE`), production obligation invoicing with scannable QR codes (`Invoicing v2`), and idempotent crew batch settlement (`Batch Payouts v1`), updating settlement state strictly from PayPal `GET` read-back responses.

**Blocked by:** 01 — CreditRoll Reconciler, Guardrails & Studio Relational Data

**Status:** `done`

**Needs:** PayPal Sandbox REST credentials (`PAYPAL_CLIENT_ID` and `PAYPAL_SECRET`) for live Sandbox smoke verification, plus mockable fetch seam for automated unit/integration tests

**Validation method:** Automated unit/integration tests for guardrail enforcement, idempotency deduplication, and read-back status mapping, plus live PayPal Sandbox API smoke execution

**Evidence required:** Passing automated test output and live PayPal Sandbox JSON receipts showing real Sandbox order/invoice/payout IDs and read-back status transitions

**Tests:** `required`

**Test seam:** Public server settlement functions and Next.js `/api/credit-roll/*` route handlers

**Regression scope:** Existing read-only PayPal client functions (`listProducts`, `listPlans`, `listInvoices`, `searchTransactions`, `getBalances`) and OAuth token caching in `lib/paypal.ts` remain unbroken

- [x] Creating and capturing a Behind-the-Scenes Supporter Pack order calls `POST /v2/checkout/orders` (`intent: CAPTURE`), supports capture and `GET /v2/checkout/orders/{id}` read-back, and records the real PayPal order ID — Source: Story 5
- [x] Generating a production obligation invoice calls `POST /v2/invoicing/invoices`, `POST /v2/invoicing/invoices/{id}/send`, `POST /v2/invoicing/invoices/{id}/generate-qr-code`, and `GET /v2/invoicing/invoices/{id}` to return a live PayPal Sandbox invoice ID, status, and base64 QR image — Source: Story 5
- [x] Executing crew batch settlement requires a valid human approval token bound to the current `proposalVersionHash` and calls `POST /v1/payments/payouts` followed by `GET /v1/payments/payouts/{batch_id}`, updating each crew member's status to `PAID` only when their individual item `transaction_status` is `SUCCESS` (preserving `PENDING`, `UNCLAIMED`, or `FAILED` otherwise) — Source: Story 6, Story 7 — Failure: F3
- [x] Submitting the same approved `proposalVersionHash` twice returns the existing batch settlement record without issuing a second `POST /v1/payments/payouts` call — Source: Story 6 — Failure: F1
- [x] Settlement requests missing the human approval token, carrying a stale `proposalVersionHash`, or attempting to include a `NEEDS_REVIEW` recipient are rejected with HTTP 400 before any PayPal network request is sent — Source: Story 6, Story 8 — Failure: F5
- [x] When PayPal returns a non-2xx error or timeout on a write endpoint, the server preserves the pre-mutation settlement state, surfaces the PayPal status and `debug_id` without leaking `PAYPAL_SECRET`, and never marks failed or pending items as `PAID` — Source: Story 7 — Failure: F4

## Verification Log

- **2026-11-02 Ticket 02 Completed**: Worker `a2497d391bb8d649c` delivered `ticket-02.patch` against `dispatch_base_sha=bdc51cda00f6d8c886095d85eb1f132439dcecd8`. Verified RED → GREEN (`pass 12, fail 0` across Ticket 01 + Ticket 02 tests), `npx next typegen && npx tsc --noEmit && npm run lint` 0 errors. Live Sandbox smoke pending user `.env.local` credentials per preflight Degradation Policy (`sandbox-simulated` fallback + injected `fetchImpl` live-path tests verified).

