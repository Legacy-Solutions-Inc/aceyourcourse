# Phase 4: Payments (tickets)

Branch: `feat/phase4-payments`. Every ticket shares it, with no new branch per ticket.

- **Spec:** docs/specs/2026-10-29-ayc-v1.md, Phase 4, including "Phase 4 planning decisions (added 2026-11-24)", stories 151a–151z and the "Phase 4 seams" in Testing Decisions.
- **Grilling notes:** `grilling-notes.md`.
- **Admin conventions:** reused from `.scratch/ayc-admin/CONVENTIONS.md` (the Staff Guard, sample, live and closed modes, Staff Activity, the conflict check).

Each ticket is a vertical slice: tables and migration, database plus sample-data arms, screens and tests. e2e runs on the in-memory sample data with the payments fake, and database suites run in CI. No ticket connects to the hosted project, PayMongo or Vercel. Apply each ticket's migration to hosted yourself after it merges. Setting the PayMongo keys and registering the webhook is your job (the runbook from ticket 04 lists the steps).

Run one executer at a time. Executers on the same working tree make each other's tests time out.

Suggested order: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 14, with 13 and 15 at any point.

| #   | Ticket                                  | Blocked by |
| --- | --------------------------------------- | ---------- |
| 01  | Plans & prices in the Admin             | —          |
| 02  | The Member's Plans page                 | 01         |
| 03  | Pay with the payments fake              | 02         |
| 04  | Real PayMongo checkout                  | 03         |
| 05  | The PayMongo webhook and Order expiry   | 04         |
| 06  | Billing and the Payment Acknowledgement | 03         |
| 07  | The Orders admin                        | 04         |
| 08  | Invoice Requests                        | 06, 07     |
| 09  | Refunds                                 | 05, 06, 07 |
| 10  | "End granted access"                    | 03         |
| 11  | Sales figures and Needs attention       | 08, 09     |
| 12  | Renewal banner and ended access         | 02         |
| 13  | Legal v2.1: payments and refunds        | —          |
| 14  | Deleting an account that has Orders     | 05         |
| 15  | Staff Activity list for Owners          | —          |

Prompts: `prompts/<NN>-<slug>.md`, one per ticket.
