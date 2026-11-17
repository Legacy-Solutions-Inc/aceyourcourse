# Phase 3: Member App study core (tickets)

Branch: `feat/phase3-member-app`. Every ticket shares it, with no new branch per ticket.

- **Spec:** docs/specs/2026-10-29-ayc-v1.md, Phase 3, including "Phase 3 planning decisions (added 2026-11-17)" and the "Phase 3 seams" in Testing Decisions.
- **Grilling notes:** `grilling-notes.md`.
- **Admin conventions:** reused from `.scratch/ayc-admin/CONVENTIONS.md` (the Staff Guard, sample, live and closed modes, Staff Activity, the conflict check).

Each ticket is a vertical slice: tables and migration, database plus sample-data arms, screens and tests. e2e runs on the in-memory sample data, and database suites run in CI. Apply each ticket's migration to hosted yourself after it merges.

Run one executer at a time. Executers on the same working tree make each other's tests time out.

Suggested order: 01 → 02 → 04 → 03 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19

| #   | Ticket                                                        | Blocked by |
| --- | ------------------------------------------------------------- | ---------- |
| 01  | Member App shell, sign-in and the beta gate                   | —          |
| 02  | Consent and the Legal v2.0 draft                              | 01         |
| 03  | Onboarding and Target Exams                                   | 02         |
| 04  | Active Device                                                 | 01         |
| 05  | Content model, Topics editor, Library and the access decision | 03, 04     |
| 06  | Card import                                                   | 05         |
| 07  | Card editor in the Admin                                      | 05         |
| 08  | Flashcard study                                               | 05         |
| 09  | Quiz import and quiz settings                                 | 06         |
| 10  | Question editor                                               | 07, 09     |
| 11  | Quiz taking                                                   | 05         |
| 12  | Reviewer PDF upload and the processing job                    | 05         |
| 13  | Reviewer PDF placement, preview and publishing                | 12         |
| 14  | Reviewer PDF reader with stamped pages                        | 13         |
| 15  | Dashboard and progress                                        | 08, 11, 14 |
| 16  | Users list, Member detail and force sign-out                  | 04, 05     |
| 17  | Grant, extend and end access, with notices                    | 16         |
| 18  | Account, Support and Members' privacy requests                | 03         |
| 19  | Privacy Request fulfilment in the Admin                       | 16, 18     |

Prompts: `prompts/<NN>-<slug>.md`, one per ticket.
