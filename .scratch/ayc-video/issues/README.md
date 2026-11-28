# Phase 5 (Video Courses) tickets

Spec: docs/specs/2026-10-29-ayc-v1.md, Phase 5 (stories 152–187, "Phase 5 planning decisions", "Phase 5 seams"). Decisions: ../grilling-notes.md. Video service: ADR 0013 (VdoCipher).

Branch: `feat/phase5-video`, created by ticket 01 from the tip of `feat/phase4-payments`. Every Phase 5 ticket shares it.

A linear chain; work top to bottom. The first five cover contract Milestone 4 (due 4 Dec 2026); Course selling comes last, so only it slips if time runs short.

| #   | Ticket                                | Blocked by |
| --- | ------------------------------------- | ---------- |
| 01  | Course builder                        | None       |
| 02  | Video service, uploads and publishing | 01         |
| 03  | Watching                              | 02         |
| 04  | Resume and progress                   | 03         |
| 05  | Security review                       | 04         |
| 06  | Selling a Course                      | 05         |
| 07  | After the sale                        | 06         |

Every ticket: happy and sad paths tested; e2e on the in-memory sample data with the video and payments fakes; database suites in CI only; executers never connect to the hosted project, PayMongo, VdoCipher or Vercel, and never commit. The user applies each migration to hosted after merging.
